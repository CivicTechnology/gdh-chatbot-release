import { tool } from "ai";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { createEmbedding } from "../embeddings.js";

// Cache for available datasets (refreshed periodically)
let cachedDatasets: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get available dataset names from the database
 * Results are cached for performance
 */
export async function getAvailableDatasets(): Promise<string[]> {
	const now = Date.now();

	// Return cached result if still valid
	if (cachedDatasets && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedDatasets;
	}

	const datasets = await prisma.ckanDataset.findMany({
		select: { name: true },
	});

	cachedDatasets = datasets.map((d) => d.name);
	cacheTimestamp = now;

	return cachedDatasets;
}

/**
 * Validate dataset name format for SQL safety
 * SECURITY: Only allows alphanumeric characters and underscores
 */
function isValidDatasetName(name: string): boolean {
	return /^[a-zA-Z0-9_]+$/.test(name);
}

/**
 * Validate that requested datasets exist in the database
 * Throws an error if any dataset is not found or has invalid format
 * SECURITY: Also validates dataset name format to prevent SQL injection
 */
export async function validateDatasets(datasets: string[]): Promise<void> {
	// First validate format to prevent SQL injection
	const invalidFormat = datasets.filter((d) => !isValidDatasetName(d));
	if (invalidFormat.length > 0) {
		throw new Error(
			`Ongeldige dataset naam(en): ${invalidFormat.join(", ")}. Alleen letters, cijfers en underscores zijn toegestaan.`,
		);
	}

	const available = await getAvailableDatasets();
	const invalid = datasets.filter((d) => !available.includes(d));

	if (invalid.length > 0) {
		throw new Error(
			`Onbekende dataset(s): ${invalid.join(", ")}. Beschikbare datasets: ${available.join(", ")}`,
		);
	}
}

/**
 * Validate that a query is read-only
 * SECURITY: Only allows SELECT queries, blocks all write operations
 */
function validateReadOnlyQuery(query: string): void {
	const normalized = query.trim().toLowerCase();

	// Must start with SELECT or WITH (CTEs)
	if (!normalized.startsWith("select") && !normalized.startsWith("with")) {
		throw new Error("Alleen SELECT queries zijn toegestaan");
	}

	// Block dangerous keywords
	// SECURITY: Extended blocklist to prevent SQL injection and DoS attacks
	const forbidden = [
		// Write operations
		"insert",
		"update",
		"delete",
		"drop",
		"alter",
		"create",
		"truncate",
		// Permission operations
		"grant",
		"revoke",
		// Execution operations
		"exec",
		"execute",
		"call",
		// File operations
		"into outfile",
		"into dumpfile",
		"load_file",
		"copy",
		// Dangerous PostgreSQL functions
		"pg_sleep",
		"pg_read_file",
		"pg_write_file",
		"pg_ls_dir",
		// Transaction/session manipulation
		"set role",
		"reset role",
		"set session",
		// Maintenance operations
		"vacuum",
		"analyze",
		"cluster",
		"reindex",
		// Procedural code
		"do",
		"prepare",
		"deallocate",
		// Transaction control (outside of our managed transaction)
		"begin",
		"commit",
		"rollback",
		"savepoint",
	];

	// Block anonymous code blocks ($$...$$)
	if (normalized.includes("$$")) {
		throw new Error("Anonymous code blocks ($$) zijn niet toegestaan");
	}

	for (const keyword of forbidden) {
		// Check for keyword as a separate word (not part of a column name)
		const regex = new RegExp(`\\b${keyword}\\b`, "i");
		if (regex.test(normalized)) {
			throw new Error(`Query bevat verboden keyword: ${keyword}`);
		}
	}
}

/**
 * Execute a read-only query against the CKAN data in PostgreSQL
 * SECURITY: Uses READ ONLY transaction mode and validates query
 */
export async function executeQuery(
	datasets: string[],
	query: string,
): Promise<unknown[]> {
	// Validate the query is read-only
	validateReadOnlyQuery(query);

	// Validate that all requested datasets exist
	await validateDatasets(datasets);

	// Execute in a read-only transaction with timeout
	const QUERY_TIMEOUT_SECONDS = 10;

	// Build the full query with CTEs upfront for better error logging
	let fullQuery = query;
	const ctes: string[] = [];
	for (const dataset of datasets) {
		ctes.push(`
			"${dataset}" AS (
				SELECT r.data::jsonb as data, r.geometry
				FROM "CkanRecord" r
				JOIN "CkanDataset" d ON r."datasetId" = d.id
				WHERE d.name = '${dataset}'
			)
		`);
	}

	if (ctes.length > 0) {
		const normalizedQuery = fullQuery.trim().toLowerCase();
		if (normalizedQuery.startsWith("select")) {
			fullQuery = `WITH ${ctes.join(", ")} ${fullQuery}`;
		} else if (normalizedQuery.startsWith("with")) {
			fullQuery = fullQuery.replace(/^with\s+/i, `WITH ${ctes.join(", ")}, `);
		}
	}

	try {
		return await prisma.$transaction(
			async (tx) => {
				// Set transaction to read-only mode and add timeout for expensive queries
				await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
				await tx.$executeRawUnsafe(
					`SET statement_timeout = '${QUERY_TIMEOUT_SECONDS}s'`,
				);

				// Execute the query
				const result = await tx.$queryRawUnsafe(fullQuery);
				// Convert BigInt values to numbers (PostgreSQL COUNT returns BigInt)
				return (result as unknown[]).map((row) => {
					if (typeof row !== "object" || row === null) return row;
					const converted: Record<string, unknown> = {};
					for (const [key, value] of Object.entries(row)) {
						converted[key] = typeof value === "bigint" ? Number(value) : value;
					}
					return converted;
				});
			},
			{
				// Increase Prisma transaction timeout to match PostgreSQL statement timeout
				timeout: (QUERY_TIMEOUT_SECONDS + 5) * 1000,
				isolationLevel: "ReadCommitted",
			},
		);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		const errorCode = (error as { code?: string }).code;
		const errorMeta = (error as { meta?: unknown }).meta;

		// Enhanced error logging
		console.error("[executeQuery] ========== QUERY FAILED ==========");
		console.error("[executeQuery] Timestamp:", new Date().toISOString());
		console.error("[executeQuery] Datasets:", datasets);
		console.error("[executeQuery] Original query:", query);
		console.error("[executeQuery] Full query with CTEs:", fullQuery);
		console.error("[executeQuery] Error code:", errorCode);
		console.error("[executeQuery] Error message:", errorMessage);
		console.error("[executeQuery] Error meta:", JSON.stringify(errorMeta, null, 2));
		console.error("[executeQuery] Full error:", error);
		console.error("[executeQuery] ================================");

		// Handle specific PostgreSQL errors with helpful messages
		if (errorCode === "22P02") {
			// Invalid input syntax for type json
			const detail = (error as { detail?: string }).detail ?? "";
			// Check if it's likely a polygon/json field issue
			const isPolygonQuery = query.toLowerCase().includes("polygon");
			const hint = isPolygonQuery
				? "Voor polygon velden: gebruik data->'polygon' (ENKELE pijl), NIET (data->>'polygon')::json"
				: "Zorg dat je JSONB syntax gebruikt: data->>'veldnaam' voor tekst, (data->>'veld')::float voor getallen, data->'veld' voor JSON objecten";
			throw new Error(
				`Query fout: ongeldige JSON syntax. ${hint}. ${detail ? `Detail: ${detail}` : ""} Query: ${query.slice(0, 200)}...`,
			);
		}

		if (errorCode === "XX000" && errorMessage.includes("coordinates")) {
			// PostGIS GeoJSON error
			throw new Error(
				"SQL fout: ongeldige GeoJSON coördinaten. De geometry data heeft een ongeldig formaat. Gebruik de 'polygon' veld uit de data kolom voor gebiedsgrenzen.",
			);
		}

		// Check if it's a timeout error
		if (
			errorMessage.includes("statement timeout") ||
			errorMessage.includes("canceling statement")
		) {
			throw new Error(
				`Query timeout na ${QUERY_TIMEOUT_SECONDS} seconden. De query is te zwaar.`,
			);
		}

		// Check for common SQL syntax errors
		if (errorCode === "42601" || errorCode === "42703") {
			throw new Error(
				`SQL syntax fout: ${errorMessage}. Controleer de veldnamen en query syntax.`,
			);
		}

		throw error;
	}
}

/**
 * Compact a JSON schema to just field names and types (no enum values)
 */
function compactSchema(schema: unknown): Record<string, string> | null {
	const s = schema as {
		items?: {
			properties?: Record<string, { type?: unknown; enum?: unknown[] }>;
		};
	} | null;

	if (!s?.items?.properties) return null;

	const compact: Record<string, string> = {};
	for (const [field, prop] of Object.entries(s.items.properties)) {
		const type = Array.isArray(prop.type)
			? prop.type.join(" | ")
			: String(prop.type ?? "unknown");
		// Add hint if field has enum values (but don't include all values)
		const hint = prop.enum ? ` (${prop.enum.length} mogelijke waarden)` : "";
		compact[field] = type + hint;
	}
	return compact;
}

/**
 * Tool to get CKAN dataset schema and field info
 * Call this AFTER searchCkanDatasets to get the schema for specific datasets
 */
export const getCkanInfo = tool({
	description: `STAP 2: Haal de veldnamen en schema op van specifieke CKAN datasets.

Roep dit aan NA searchCkanDatasets, VOOR queryCkan of showMap.

De response bevat per dataset:
- recordCount: aantal records
- fields: alle veldnamen met hun types

⚠️ BELANGRIJK: Veldnamen zijn CASE-SENSITIVE en vaak UPPERCASE (STADSDEEL, WIJKNAAM, BUURTNAAM).
Gebruik de exacte veldnamen uit deze response in je queries!`,

	inputSchema: z.object({
		description: z
			.string()
			.describe(
				"Korte, niet-technische beschrijving in gewone menselijke taal van wat er wordt opgezocht (bijv. 'Dataset-informatie ophalen', 'Veldnamen van bomen-dataset'). Wordt getoond aan de gebruiker.",
			),
		datasets: z
			.array(z.string())
			.min(1)
			.describe(
				"Dataset namen om schema van op te halen (uit searchCkanDatasets)",
			),
	}),

	execute: async ({ description, datasets }) => {
		// Validate datasets exist
		await validateDatasets(datasets);

		const result: Record<
			string,
			{
				recordCount: number;
				fields: Record<string, string> | null;
			}
		> = {};

		// Fetch only requested datasets
		const datasetInfos = await prisma.ckanDataset.findMany();

		const datasetMap = new Map(datasetInfos.map((d) => [d.name, d]));

		for (const name of datasets) {
			const info = datasetMap.get(name);
			result[name] = {
				recordCount: info?.recordCount ?? 0,
				fields: compactSchema(info?.schema),
			};
		}

		return { description, datasets: result };
	},
});

/**
 * Tool to query CKAN datasets with SQL
 */
export const queryCkan = tool({
	description: `Query gemeentelijke datasets van Den Haag met PostgreSQL.

⚠️ VEREISTE WORKFLOW - NIET OVERSLAAN:
1. EERST searchCkanDatasets() aanroepen om relevante datasets te vinden
2. DAN getCkanInfo() aanroepen om de exacte veldnamen te krijgen
3. PAS DAARNA deze tool gebruiken met de juiste veldnamen

⚠️ KRITIEK - JSONB SYNTAX IS VERPLICHT:
Alle velden zitten in de 'data' JSONB kolom. Je MOET de JSONB operators gebruiken:

❌ FOUT: SELECT naam, lat FROM stadslandbouw
✓ GOED: SELECT data->>'naam' as naam, (data->>'lat')::float as lat FROM stadslandbouw

JSONB operators:
- data->>'veldnaam' voor tekst (dubbele pijl >>)
- (data->>'veld')::float voor decimale getallen
- (data->>'veld')::int voor hele getallen
- data->'veld' voor JSON objecten (enkele pijl >)

⚠️ STRING CONCATENATIE - Gebruik CONCAT(), NIET ||:
❌ FOUT: 'Prefix: '||data->>'veld' (veroorzaakt JSON parse error)
✓ GOED: CONCAT('Prefix: ', data->>'veld')

Query voorbeelden:
- Tellen: SELECT COUNT(*) FROM stadslandbouw
- Filteren: SELECT data->>'naam' FROM stadslandbouw WHERE data->>'status' = 'Actief'
- Sorteren: SELECT data->>'naam', (data->>'oppervlakte')::int as opp FROM stadslandbouw ORDER BY opp DESC

⚠️ CTE BEPERKINGEN - Datasets zijn CTEs, geen echte tabellen:
- ❌ TABLESAMPLE werkt NIET: SELECT * FROM bomen TABLESAMPLE SYSTEM (10)
- ✓ Gebruik ORDER BY RANDOM() LIMIT n voor sampling: SELECT * FROM bomen ORDER BY RANDOM() LIMIT 100
- ✓ Of gebruik WHERE met RANDOM(): SELECT * FROM bomen WHERE RANDOM() < 0.01

BELANGRIJK:
- Veldnamen zijn CASE-SENSITIVE
- Verzin NOOIT data - rapporteer alleen wat in de resultaten staat`,

	inputSchema: z.object({
		datasets: z
			.array(z.string())
			.min(1)
			.describe(
				"De dataset(s) om te queryen (gebruik getCkanInfo om beschikbare datasets te zien). Gebruik meerdere voor JOINs.",
			),
		description: z
			.string()
			.describe(
				"Korte, niet-technische beschrijving in gewone menselijke taal van wat er wordt opgezocht (bijv. 'Bomen in Segbroek bekijken', 'Groengebieden in de stad'). Wordt getoond aan de gebruiker - vermijd technische termen zoals 'query', 'tellen', 'filteren', etc.",
			),
		query: z
			.string()
			.describe(
				"Volledige SELECT query met PostgreSQL JSONB syntax. Gebruik data->>'veldnaam' voor tekstvelden. GEEN newlines gebruiken - alles op één regel.",
			),
		outputLimit: z
			.number()
			.min(1)
			.max(100)
			.default(50)
			.describe(
				"Maximum aantal rijen in de output (voor token-besparing). Query draait op volledige dataset.",
			),
	}),

	execute: async ({ datasets, description, query, outputLimit }) => {
		try {
			const results = await executeQuery(datasets, query);

			// Get dataset counts from database
			const datasetInfos = await prisma.ckanDataset.findMany();
			const datasetMap = new Map(datasetInfos.map((d) => [d.name, d]));

			const totalResults = results.length;
			const truncated = totalResults > outputLimit;

			const result = {
				success: true,
				datasets,
				query,
				description,
				outputLimit,
				totalInDatasets: datasets.reduce(
					(acc, ds) => ({
						...acc,
						[ds]: datasetMap.get(ds)?.recordCount ?? 0,
					}),
					{} as Record<string, number>,
				),
				totalResults,
				resultsShown: Math.min(totalResults, outputLimit),
				truncated,
				results: results.slice(0, outputLimit),
				...(truncated && {
					hint: `Output afgekapt: ${totalResults - outputLimit} extra rijen niet getoond. Gebruik aggregatie (GROUP BY, COUNT) voor complete analyses.`,
				}),
			};

			return result;
		} catch (error) {
			console.error("[queryCkan] Error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				datasets,
				query,
				description,
				outputLimit,
			};
		}
	},

	// Return summary + limited results to the model
	// Full results are streamed to frontend, model gets enough to formulate response
	toModelOutput: (output) => {
		const typedOutput = output as {
			success: boolean;
			datasets: string[];
			query: string;
			description?: string;
			outputLimit?: number;
			totalInDatasets?: Record<string, number>;
			totalResults?: number;
			resultsShown?: number;
			truncated?: boolean;
			hint?: string;
			error?: string;
			results?: unknown[];
		};

		// Include up to 25 results for the model to interpret
		const modelResultLimit = 25;
		const resultsForModel =
			typedOutput.results?.slice(0, modelResultLimit) ?? [];

		const summary = JSON.stringify({
			success: typedOutput.success,
			datasets: typedOutput.datasets,
			query: typedOutput.query,
			description: typedOutput.description ?? null,
			outputLimit: typedOutput.outputLimit ?? null,
			totalInDatasets: typedOutput.totalInDatasets ?? null,
			totalResults: typedOutput.totalResults ?? null,
			resultsShown: typedOutput.resultsShown ?? null,
			truncated: typedOutput.truncated ?? false,
			hint: typedOutput.hint ?? null,
			error: typedOutput.error ?? null,
			results: resultsForModel,
			resultsInModelOutput: resultsForModel.length,
		});

		return { type: "text" as const, value: summary };
	},
});

/**
 * Tool to semantically search for relevant CKAN datasets
 * Returns lightweight results (no schema) for efficient dataset discovery
 */
export const searchCkanDatasets = tool({
	description: `STAP 1: Zoek semantisch naar relevante CKAN datasets van gemeente Den Haag.

Dit is de EERSTE stap voordat je data kunt queryen. Er zijn 140+ datasets beschikbaar.

De response bevat per dataset:
- name: technische naam (voor getCkanInfo en queryCkan)
- displayName: leesbare naam
- description: korte beschrijving
- recordCount: aantal records
- score: relevantie score

NA deze tool: roep getCkanInfo aan met de gevonden dataset naam(en) om de veldnamen te krijgen.`,

	inputSchema: z.object({
		description: z
			.string()
			.describe(
				"Korte, niet-technische beschrijving in gewone menselijke taal van wat er wordt opgezocht (bijv. 'Datasets over bomen', 'Data over parkeerplaatsen'). Wordt getoond aan de gebruiker.",
			),
		query: z
			.string()
			.describe("Zoekterm of vraag om relevante datasets te vinden"),
		limit: z
			.number()
			.min(1)
			.max(20)
			.default(10)
			.describe("Maximum aantal resultaten"),
	}),

	execute: async ({ description, query, limit }) => {
		try {
			const embedding = await createEmbedding(query);

			// Vector similarity search using pgvector
			type SearchResult = {
				name: string;
				displayName: string;
				description: string | null;
				recordCount: number;
				score: number;
			};

			const results = await prisma.$queryRawUnsafe<SearchResult[]>(`
				SELECT
					name,
					"displayName",
					description,
					"recordCount",
					1 - (embedding <=> '${JSON.stringify(embedding)}'::vector) as score
				FROM "CkanDataset"
				WHERE embedding IS NOT NULL
				ORDER BY embedding <=> '${JSON.stringify(embedding)}'::vector
				LIMIT ${limit}
			`);

			const datasets = results.map((r) => ({
				name: r.name,
				displayName: r.displayName,
				description: r.description,
				recordCount: r.recordCount,
				score: Math.round(Number(r.score) * 100) / 100,
			}));

			return {
				success: true,
				description,
				query,
				results: datasets,
				hint: "Gebruik getCkanInfo om het schema van een dataset op te halen voordat je queryCkan aanroept.",
			};
		} catch (error) {
			console.error("[searchCkanDatasets] Error:", error);
			return {
				success: false,
				description,
				query,
				error: error instanceof Error ? error.message : String(error),
				results: [],
			};
		}
	},
});
