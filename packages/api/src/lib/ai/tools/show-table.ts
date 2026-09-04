import { tool } from "ai";
import { z } from "zod";
import { executeQuery } from "./query-ckan.js";

const dataQuerySchema = z.object({
	datasets: z
		.array(z.string())
		.min(1)
		.describe("Dataset naam (uit getCkanInfo)"),
	sql: z.string().describe(`PostgreSQL query voor tabel data.

⚠️ KRITIEK - JSONB SYNTAX IS VERPLICHT:
Alle velden zitten in de 'data' JSONB kolom. Je MOET de JSONB operators gebruiken:
- data->>'veldnaam' voor tekst (dubbele pijl)
- (data->>'veld')::float voor decimale getallen
- (data->>'veld')::int voor hele getallen

⚠️ STRING CONCATENATIE - Gebruik CONCAT(), NIET ||:
❌ FOUT: 'Prefix: '||data->>'veld' (veroorzaakt JSON parse error)
✓ GOED: CONCAT('Prefix: ', data->>'veld')

❌ FOUT: SELECT naam, adres FROM dataset
✓ GOED: SELECT data->>'naam' as naam, data->>'adres' as adres FROM dataset

Geef kolommen duidelijke aliases met AS voor leesbare kolomnamen.`),
	limit: z
		.number()
		.min(1)
		.optional()
		.describe(
			"Maximum aantal rijen. Standaard geen limiet - alle resultaten worden getoond.",
		),
});

export type TableColumn = {
	key: string;
	name: string;
};

export type DataQuery = {
	datasets: string[];
	sql: string;
	limit?: number;
};

export type ShowTableOutput = {
	description: string;
	title?: string;
	sheetName?: string;
	columns: TableColumn[];
	rows: Array<Record<string, unknown>>;
	totalRows: number;
	truncated: boolean;
	queryError?: string;
	dataQuery?: DataQuery;
};

/**
 * Extract column definitions from query results
 */
function extractColumns(rows: Record<string, unknown>[]): TableColumn[] {
	if (rows.length === 0) return [];

	const firstRow = rows[0];
	return Object.keys(firstRow).map((key) => ({
		key,
		name: key,
	}));
}

/**
 * Tool to display query results in an interactive table
 */
export const showTable = tool({
	description: `Toon query resultaten in een interactieve tabel die de gebruiker kan sorteren en doorzoeken.

Gebruik deze tool wanneer:
- De gebruiker vraagt om "alle resultaten" of "een tabel" te zien
- De gebruiker data wil bestuderen of analyseren
- Er veel resultaten zijn die de gebruiker wil bekijken

De tabel ondersteunt:
- Sorteren per kolom (klik op kolomheader)
- Zoeken/filteren
- Virtualisatie voor grote datasets (duizenden rijen)

⚠️ LET OP: Alle velden zitten in de 'data' JSONB kolom!

Voorbeeld query:
dataQuery: {
  datasets: ["bomen"],
  sql: "SELECT data->>'soort' as soort, data->>'hoogte' as hoogte, data->>'adres' as adres FROM bomen"
}`,

	inputSchema: z.object({
		description: z
			.string()
			.describe(
				"Korte, niet-technische beschrijving van wat er wordt getoond (bijv. 'Alle bomen in Segbroek', 'Parkeerplaatsen in het centrum'). Wordt getoond aan de gebruiker.",
			),
		title: z
			.string()
			.optional()
			.describe("Optionele titel voor de tabel"),
		sheetName: z
			.string()
			.max(31)
			.optional()
			.describe(
				"Korte naam voor Excel sheet export (max 31 karakters). Bijv. 'Bomen Segbroek', 'Parkeerplaatsen'.",
			),
		dataQuery: dataQuerySchema.describe(
			"Query om data op te halen uit CKAN datasets",
		),
	}),

	execute: async ({ description, title, sheetName, dataQuery }) => {
		let rows: Record<string, unknown>[] = [];
		let totalRows = 0;
		let truncated = false;
		let queryError: string | undefined = undefined;

		try {
			const results = await executeQuery(dataQuery.datasets, dataQuery.sql);

			totalRows = results.length;
			rows = results as Record<string, unknown>[];
		} catch (error) {
			console.error("[showTable] Query error:", error);
			queryError =
				error instanceof Error ? error.message : "Query uitvoering mislukt";
			rows = [];
			totalRows = 0;
		}

		const columns = extractColumns(rows);

		const result: ShowTableOutput = {
			description,
			title,
			sheetName,
			columns,
			rows,
			totalRows,
			truncated,
			queryError,
			dataQuery: {
				datasets: dataQuery.datasets,
				sql: dataQuery.sql,
				limit: dataQuery.limit,
			},
		};

		return result;
	},

	// Return only a summary to the model (not the full rows array)
	// This prevents context length issues while still streaming full data to frontend
	toModelOutput: (output) => {
		const typedOutput = output as ShowTableOutput;
		const summary = JSON.stringify({
			description: typedOutput.description,
			title: typedOutput.title ?? null,
			columns: typedOutput.columns.map((col) => col.name),
			rowCount: typedOutput.rows.length,
			totalRows: typedOutput.totalRows,
			truncated: typedOutput.truncated,
			queryError: typedOutput.queryError ?? null,
		});
		return { type: "text" as const, value: summary };
	},
});
