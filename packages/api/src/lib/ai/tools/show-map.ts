import { tool } from "ai";
import { z } from "zod";
import { executeQuery } from "./query-ckan.js";

/**
 * Bounding box for the Netherlands to filter out invalid coordinates
 */
const NETHERLANDS_BOUNDS = {
	minLat: 50.75,
	maxLat: 53.55,
	minLng: 3.35,
	maxLng: 7.25,
};

/**
 * Check if coordinates are within the Netherlands bounding box
 */
function isInNetherlands(lat: number, lng: number): boolean {
	return (
		lat >= NETHERLANDS_BOUNDS.minLat &&
		lat <= NETHERLANDS_BOUNDS.maxLat &&
		lng >= NETHERLANDS_BOUNDS.minLng &&
		lng <= NETHERLANDS_BOUNDS.maxLng
	);
}

const MARKER_ICONS = [
	"mapPin",
	"tree",
	"trees",
	"leaf",
	"flower",
	"building",
	"home",
	"landmark",
	"store",
	"warehouse",
	"factory",
	"school",
	"hospital",
	"church",
	"park",
	"car",
	"bike",
	"bus",
	"train",
	"plane",
	"ship",
	"utensils",
	"coffee",
	"beer",
	"shoppingBag",
	"heart",
	"star",
	"flag",
	"info",
	"alertTriangle",
	"construction",
	"trash",
	"recycle",
	"droplet",
	"zap",
	"sun",
	"wind",
	"sprout",
	"carrot",
] as const;

const PRESET_COLORS = ["red", "blue", "green", "orange", "purple"] as const;
type MarkerIcon = (typeof MARKER_ICONS)[number];

// Color - prefer hex/rgb for precise colors
const colorSchema = z
	.string()
	.optional()
	.default("#ef4444")
	.describe(
		"Kleur van de marker. Gebruik bij voorkeur hex (#22c55e, #ef4444, #3b82f6) of rgb (rgb(255,85,0)) voor precieze kleuren. Presets (red, blue, green, orange, purple) zijn ook mogelijk maar hex/rgb heeft de voorkeur.",
	);

const markerSchema = z.object({
	lat: z.number().describe("Latitude van het punt"),
	lng: z.number().describe("Longitude van het punt"),
	label: z
		.string()
		.optional()
		.describe("Korte naam voor de legenda (bijv. 'Eikenboom', 'Locatie A')"),
	description: z
		.string()
		.optional()
		.describe("Beschrijving voor de popup (bijv. adres, details, kenmerken)"),
	url: z
		.string()
		.url()
		.optional()
		.describe("Optionele link URL voor meer informatie"),
	urlLabel: z
		.string()
		.optional()
		.describe("Label voor de link (bijv. 'Meer info', 'Website')"),
	icon: z
		.enum(MARKER_ICONS)
		.optional()
		.default("mapPin")
		.describe(
			"Lucide icon voor de marker. Kies een passend icon: tree/trees/leaf voor natuur, building/home voor gebouwen, store/coffee/utensils voor horeca, car/bike/bus voor vervoer, etc.",
		),
	color: colorSchema,
});

const STROKE_STYLES = ["solid", "dashed", "dotted"] as const;
const FILL_PATTERNS = ["solid", "stripes", "crosshatch", "dots"] as const;

const polygonSchema = z.object({
	coordinates: z
		.array(z.object({ lat: z.number(), lng: z.number() }))
		.min(3)
		.describe("Array van punten die het polygoon vormen (minimaal 3)"),
	label: z.string().optional().describe("Naam van het gebied"),
	// Fill properties
	fillColor: z
		.string()
		.optional()
		.default("#3b82f6")
		.describe("Vulkleur van het polygoon. Gebruik bij voorkeur hex (#3b82f6) of rgb."),
	fillOpacity: z
		.number()
		.min(0)
		.max(1)
		.optional()
		.default(0.2)
		.describe("Transparantie van de vulling (0-1). Gebruik 0 voor geen opvulling (alleen rand)."),
	fillPattern: z
		.enum(FILL_PATTERNS)
		.optional()
		.default("solid")
		.describe("Vulpatroon: solid (effen), stripes (diagonale strepen), crosshatch (kruisarcering), dots (stippen)"),
	// Stroke/outline properties
	strokeColor: z
		.string()
		.optional()
		.describe("Randkleur. Standaard dezelfde als fillColor. Gebruik hex (#22c55e) of rgb."),
	strokeWidth: z
		.number()
		.min(0)
		.max(10)
		.optional()
		.default(2)
		.describe("Randbreedte in pixels (0-10). Gebruik 0 voor geen rand."),
	strokeOpacity: z
		.number()
		.min(0)
		.max(1)
		.optional()
		.default(1)
		.describe("Transparantie van de rand (0-1)"),
	strokeStyle: z
		.enum(STROKE_STYLES)
		.optional()
		.default("solid")
		.describe("Randstijl: solid (doorgetrokken), dashed (gestreept), dotted (gestippeld)"),
});

const LINE_STYLES = ["solid", "dashed", "dotted"] as const;

const lineSchema = z.object({
	coordinates: z
		.array(z.object({ lat: z.number(), lng: z.number() }))
		.min(2)
		.describe("Array van punten die de lijn vormen (minimaal 2)"),
	label: z.string().optional().describe("Naam van de lijn"),
	strokeColor: z
		.string()
		.optional()
		.default("#3b82f6")
		.describe("Lijnkleur in hex (#3b82f6) of rgb formaat"),
	strokeWidth: z
		.number()
		.min(1)
		.max(10)
		.optional()
		.default(3)
		.describe("Lijndikte in pixels (1-10)"),
	strokeOpacity: z
		.number()
		.min(0)
		.max(1)
		.optional()
		.default(1)
		.describe("Transparantie van de lijn (0-1)"),
	strokeStyle: z
		.enum(LINE_STYLES)
		.optional()
		.default("solid")
		.describe("Lijnstijl: solid (doorgetrokken), dashed (gestreept), dotted (gestippeld)"),
});

const dataQuerySchema = z.object({
	datasets: z
		.array(z.string())
		.min(1)
		.describe("Dataset naam (uit getCkanInfo)"),
	sql: z.string().describe(`PostgreSQL query voor markers, polygons, of lines.

⚠️ KRITIEK - JSONB SYNTAX IS VERPLICHT:
Alle velden zitten in de 'data' JSONB kolom. Je MOET de JSONB operators gebruiken:
- data->>'veldnaam' voor tekst (dubbele pijl)
- (data->>'veld')::float voor decimale getallen
- (data->>'veld')::int voor hele getallen
- data->'polygon' of data->'line' voor JSON arrays (enkele pijl)

⚠️ STRING CONCATENATIE - Gebruik CONCAT(), NIET ||:
❌ FOUT: 'Prefix: '||data->>'veld' (veroorzaakt JSON parse error)
✓ GOED: CONCAT('Prefix: ', data->>'veld')

❌ FOUT: SELECT lat, lng FROM stadslandbouw
✓ GOED: SELECT (data->>'lat')::float as lat, (data->>'lng')::float as lng FROM stadslandbouw

⚠️ CTE BEPERKINGEN - Datasets zijn CTEs, geen echte tabellen:
- ❌ TABLESAMPLE werkt NIET op datasets
- ✓ Gebruik ORDER BY RANDOM() LIMIT n voor sampling

MARKERS query MOET bevatten:
- (data->>'lat')::float as lat
- (data->>'lng')::float as lng
- Optioneel: data->>'naam' as label, data->>'adres' as description

POLYGONS query MOET bevatten:
- data->'polygon' as polygon (ENKELE pijl voor JSON array)
- Optioneel: data->>'naam' as label
- STYLING (als literal strings/nummers):
  - 'stripes' as fillPattern (solid/stripes/crosshatch/dots)
  - '#ff0000' as fillColor, 0.3 as fillOpacity
  - '#000000' as strokeColor, 2 as strokeWidth, 'dashed' as strokeStyle

LINES query MOET bevatten:
- data->'line' as line (ENKELE pijl voor JSON array)
- Optioneel: data->>'naam' as label
- STYLING: '#22c55e' as strokeColor, 3 as strokeWidth, 'dashed' as strokeStyle`),
	limit: z
		.number()
		.min(1)
		.optional()
		.describe("Maximum aantal markers. BELANGRIJK: De kaart gebruikt WebGL en kan 10.000+ markers efficiënt renderen. Gebruik GEEN limit tenzij de gebruiker expliciet om een subset vraagt (bijv. 'toon de eerste 100'). Voor de meeste queries is geen limit nodig."),
});

const legendItemSchema = z.object({
	color: z.string().optional().describe("Kleur in hex formaat (#22c55e, #ef4444, etc.)"),
	icon: z.enum(MARKER_ICONS).optional(),
	label: z.string().describe("Wat deze kleur/icoon betekent"),
});

export type MapMarker = z.infer<typeof markerSchema>;
export type MapPolygon = z.infer<typeof polygonSchema>;
export type MapLine = z.infer<typeof lineSchema>;
export type LegendItem = z.infer<typeof legendItemSchema>;

export type DataQuery = {
	datasets: string[];
	sql: string;
	limit?: number;
};

export type ShowMapOutput = {
	description: string;
	center: { lat: number; lng: number };
	zoom: number;
	markers: MapMarker[];
	polygons: MapPolygon[];
	lines: MapLine[];
	legend: LegendItem[];
	title?: string;
	fitBounds: boolean;
	queryInfo?: {
		totalResults: number;
		shown: number;
		truncated: boolean;
	};
	queryError?: string;
	// Store the queries so data can be re-fetched on page load
	dataQueries?: DataQuery[];
};

/**
 * Get a property from a row case-insensitively.
 * PostgreSQL returns column names as lowercase, so 'fillPattern' becomes 'fillpattern'.
 */
function getRowProp(row: Record<string, unknown>, key: string): unknown {
	// Try exact key first
	if (key in row) return row[key];
	// Try lowercase
	const lowerKey = key.toLowerCase();
	if (lowerKey in row) return row[lowerKey];
	return undefined;
}

/**
 * Convert query result row to a MapMarker
 */
function rowToMarker(row: Record<string, unknown>): MapMarker | null {
	const lat = Number(row.lat);
	const lng = Number(row.lng);

	if (Number.isNaN(lat) || Number.isNaN(lng)) {
		return null;
	}

	// Filter out coordinates outside the Netherlands
	if (!isInNetherlands(lat, lng)) {
		return null;
	}

	// Validate icon
	let icon: MarkerIcon = "mapPin";
	if (row.icon && typeof row.icon === "string") {
		const iconLower = row.icon.toLowerCase();
		const matchedIcon = MARKER_ICONS.find((i) => i.toLowerCase() === iconLower);
		if (matchedIcon) {
			icon = matchedIcon;
		}
	}

	// Get color - prefer hex values
	let color: string = "#ef4444";
	if (row.color && typeof row.color === "string") {
		color = row.color;
	}

	return {
		lat,
		lng,
		label: row.label != null ? String(row.label) : undefined,
		description: row.description != null ? String(row.description) : undefined,
		url: row.url != null ? String(row.url) : undefined,
		urlLabel: row.urlLabel != null ? String(row.urlLabel) : undefined,
		icon,
		color,
	};
}

/**
 * Convert query result row to a MapPolygon
 */
function rowToPolygon(row: Record<string, unknown>): MapPolygon | null {
	// Check for polygon field (array of rings, each ring is array of {lat, lng})
	const polygon = row.polygon;
	if (!Array.isArray(polygon) || polygon.length === 0) {
		return null;
	}

	// Use first ring as the main polygon coordinates
	const firstRing = polygon[0];
	if (!Array.isArray(firstRing) || firstRing.length < 3) {
		return null;
	}

	// Validate coordinates
	const coordinates = firstRing
		.filter((p: unknown) =>
			p && typeof p === "object" &&
			"lat" in p && "lng" in p &&
			typeof (p as {lat: unknown}).lat === "number" &&
			typeof (p as {lng: unknown}).lng === "number"
		)
		.map((p: unknown) => ({
			lat: (p as {lat: number}).lat,
			lng: (p as {lng: number}).lng,
		}));

	if (coordinates.length < 3) {
		return null;
	}

	// Get fill color - prefer hex values (case-insensitive)
	let fillColor: string = "#3b82f6";
	const colorProp = getRowProp(row, "color");
	if (colorProp && typeof colorProp === "string") {
		fillColor = colorProp;
	}
	const fillColorProp = getRowProp(row, "fillColor");
	if (fillColorProp && typeof fillColorProp === "string") {
		fillColor = fillColorProp;
	}

	// Get stroke color (case-insensitive, defaults to fillColor if not specified)
	let strokeColor: string | undefined;
	const strokeColorProp = getRowProp(row, "strokeColor");
	if (strokeColorProp && typeof strokeColorProp === "string") {
		strokeColor = strokeColorProp;
	}

	// Get stroke style (case-insensitive)
	let strokeStyle: "solid" | "dashed" | "dotted" = "solid";
	const strokeStyleProp = getRowProp(row, "strokeStyle");
	if (strokeStyleProp && typeof strokeStyleProp === "string") {
		const style = strokeStyleProp.toLowerCase();
		if (style === "dashed" || style === "dotted") {
			strokeStyle = style;
		}
	}

	// Get fill pattern (case-insensitive)
	let fillPattern: "solid" | "stripes" | "crosshatch" | "dots" = "solid";
	const fillPatternProp = getRowProp(row, "fillPattern");
	if (fillPatternProp && typeof fillPatternProp === "string") {
		const pattern = fillPatternProp.toLowerCase();
		if (pattern === "stripes" || pattern === "crosshatch" || pattern === "dots") {
			fillPattern = pattern;
		}
	}

	// Get numeric properties (case-insensitive)
	const fillOpacityProp = getRowProp(row, "fillOpacity");
	const opacityProp = getRowProp(row, "opacity");
	const strokeWidthProp = getRowProp(row, "strokeWidth");
	const strokeOpacityProp = getRowProp(row, "strokeOpacity");

	return {
		coordinates,
		label: row.label != null ? String(row.label) : undefined,
		fillColor,
		fillOpacity: typeof fillOpacityProp === "number" ? fillOpacityProp : (typeof opacityProp === "number" ? opacityProp : 0.2),
		fillPattern,
		strokeColor,
		strokeWidth: typeof strokeWidthProp === "number" ? strokeWidthProp : 2,
		strokeOpacity: typeof strokeOpacityProp === "number" ? strokeOpacityProp : 1,
		strokeStyle,
	};
}

/**
 * Convert query result row to a MapLine
 */
function rowToLine(row: Record<string, unknown>): MapLine | null {
	// Check for line field (array of lines, each line is array of {lat, lng})
	const line = row.line;
	if (!Array.isArray(line) || line.length === 0) {
		return null;
	}

	// Use first line segment
	const firstLine = line[0];
	if (!Array.isArray(firstLine) || firstLine.length < 2) {
		return null;
	}

	// Validate coordinates
	const coordinates = firstLine
		.filter((p: unknown) =>
			p && typeof p === "object" &&
			"lat" in p && "lng" in p &&
			typeof (p as {lat: unknown}).lat === "number" &&
			typeof (p as {lng: unknown}).lng === "number"
		)
		.map((p: unknown) => ({
			lat: (p as {lat: number}).lat,
			lng: (p as {lng: number}).lng,
		}));

	if (coordinates.length < 2) {
		return null;
	}

	// Get color - prefer hex values (case-insensitive)
	let strokeColor: string = "#3b82f6";
	const colorProp = getRowProp(row, "color");
	if (colorProp && typeof colorProp === "string") {
		strokeColor = colorProp;
	}
	const strokeColorProp = getRowProp(row, "strokeColor");
	if (strokeColorProp && typeof strokeColorProp === "string") {
		strokeColor = strokeColorProp;
	}

	// Get stroke style (case-insensitive)
	let strokeStyle: "solid" | "dashed" | "dotted" = "solid";
	const strokeStyleProp = getRowProp(row, "strokeStyle");
	if (strokeStyleProp && typeof strokeStyleProp === "string") {
		const style = strokeStyleProp.toLowerCase();
		if (style === "dashed" || style === "dotted") {
			strokeStyle = style;
		}
	}

	// Get numeric properties (case-insensitive)
	const strokeWidthProp = getRowProp(row, "strokeWidth");
	const opacityProp = getRowProp(row, "opacity");
	const strokeOpacityProp = getRowProp(row, "strokeOpacity");

	return {
		coordinates,
		label: row.label != null ? String(row.label) : undefined,
		strokeColor,
		strokeWidth: typeof strokeWidthProp === "number" ? strokeWidthProp : 3,
		strokeOpacity: typeof strokeOpacityProp === "number" ? strokeOpacityProp : (typeof opacityProp === "number" ? opacityProp : 1),
		strokeStyle,
	};
}

/**
 * Tool to display a map with markers, polygons, and lines
 */
export const showMap = tool({
	description: `Toon een interactieve kaart met markers/punten, polygonen (gebieden), en/of lijnen.

PERFORMANCE: De kaart gebruikt WebGL en kan 10.000+ elementen efficiënt renderen. Beperk data NIET onnodig - toon alle relevante resultaten tenzij de gebruiker expliciet om minder vraagt.

MEERDERE DATASETS COMBINEREN:
Gebruik dataQueries (array) om data uit meerdere datasets te combineren in één kaart.
Elke query kan markers (lat/lng), polygonen (polygon veld), of lijnen (line veld) opleveren.

⚠️ LET OP: Alle velden zitten in de 'data' JSONB kolom!

Voorbeeld - ecozones + ecobomenrijen in één kaart:
dataQueries: [
  {
    datasets: ["ecozones"],
    sql: "SELECT data->'polygon' as polygon, data->>'NAAM' as label, '#22c55e' as color FROM ecozones"
  },
  {
    datasets: ["ecobomenrijen"],
    sql: "SELECT data->'line' as line, data->>'NAAM' as label, '#15803d' as color, 'dashed' as strokeStyle FROM ecobomenrijen"
  }
]

❌ FOUT: SELECT lat, lng, naam FROM stadslandbouw
✓ GOED: SELECT (data->>'lat')::float as lat, (data->>'lng')::float as lng, data->>'naam' as label FROM stadslandbouw

HANDMATIGE MARKERS/LINES:
Gebruik markers/lines array voor individuele elementen die niet uit een dataset komen.

LIJNSTIJLEN: solid (doorgetrokken), dashed (gestreept), dotted (gestippeld)

De kaart zoomt automatisch in zodat alle elementen zichtbaar zijn.
Voor Den Haag is het centrum ongeveer: lat 52.07, lng 4.30`,

	inputSchema: z.object({
		description: z
			.string()
			.describe(
				"Korte, niet-technische beschrijving in gewone menselijke taal van wat er wordt getoond (bijv. 'Bomen in Segbroek', 'Parkeerplaatsen in het centrum'). Wordt getoond aan de gebruiker.",
			),
		dataQueries: z
			.array(dataQuerySchema)
			.optional()
			.describe("Array van queries om markers/polygonen te genereren vanuit CKAN data. Gebruik dit om meerdere datasets te combineren."),
		markers: z
			.array(markerSchema)
			.default([])
			.describe("Handmatige markers om op de kaart te tonen"),
		polygons: z
			.array(polygonSchema)
			.default([])
			.describe("Array van polygonen (gebieden) om op de kaart te tonen"),
		lines: z
			.array(lineSchema)
			.default([])
			.describe("Array van lijnen om op de kaart te tonen (bijv. bomenrijen, paden)"),
		center: z
			.object({
				lat: z.number(),
				lng: z.number(),
			})
			.optional()
			.describe(
				"Optioneel centrum van de kaart. Als niet opgegeven wordt automatisch berekend.",
			),
		zoom: z
			.number()
			.min(1)
			.max(20)
			.optional()
			.describe(
				"Zoom niveau (1-20). Als niet opgegeven wordt automatisch berekend om alles te tonen.",
			),
		fitBounds: z
			.boolean()
			.optional()
			.default(true)
			.describe(
				"Automatisch inzoomen zodat alle markers/polygonen zichtbaar zijn (default: true)",
			),
		legend: z
			.array(legendItemSchema)
			.default([])
			.describe(
				"Legenda die uitlegt wat de kleuren en iconen betekenen. Geef voor elke unieke kleur/icoon combinatie een uitleg. Voorbeeld: [{ color: '#22c55e', label: 'Actief' }, { color: '#f97316', label: 'Gestopt' }, { icon: 'sprout', label: 'Moestuin' }]",
			),
		title: z.string().optional().describe("Optionele titel voor de kaart"),
	}),

	execute: async ({
		description,
		dataQueries,
		markers,
		polygons,
		lines,
		center,
		zoom,
		fitBounds,
		legend,
		title,
	}) => {
			let allMarkers: MapMarker[] = [...markers];
		let allPolygons: MapPolygon[] = [...polygons];
		let allLines: MapLine[] = [...lines];
		let totalResults = 0;
		let totalShown = 0;
		let queryError: string | undefined = undefined;

		// Execute all data queries if provided
		if (dataQueries && dataQueries.length > 0) {
			for (const dataQuery of dataQueries) {
				try {
					const results = await executeQuery(dataQuery.datasets, dataQuery.sql);

					const queryTotalResults = results.length;
					totalResults += queryTotalResults;

					// Convert results to markers (for rows with lat/lng)
					const queryMarkers = results
						.map((row: unknown) => rowToMarker(row as Record<string, unknown>))
						.filter((m): m is MapMarker => m !== null);

					// Convert results to polygons (for rows with polygon field)
					const queryPolygons = results
						.map((row: unknown) => rowToPolygon(row as Record<string, unknown>))
						.filter((p): p is MapPolygon => p !== null);

					// Convert results to lines (for rows with line field)
					const queryLines = results
						.map((row: unknown) => rowToLine(row as Record<string, unknown>))
						.filter((l): l is MapLine => l !== null);

					allMarkers = [...allMarkers, ...queryMarkers];
					allPolygons = [...allPolygons, ...queryPolygons];
					allLines = [...allLines, ...queryLines];
					totalShown += queryMarkers.length + queryPolygons.length + queryLines.length;
				} catch (error) {
					// On any error, clear all data and stop processing
					console.error("[showMap] Query error:", error);
					queryError = error instanceof Error ? error.message : "Query uitvoering mislukt";
					allMarkers = [...markers]; // Reset to only manual markers
					allPolygons = [...polygons]; // Reset to only manual polygons
					allLines = [...lines]; // Reset to only manual lines
					totalResults = 0;
					totalShown = 0;
					break; // Stop processing further queries
				}
			}
		}

		const queryInfo: ShowMapOutput["queryInfo"] = (dataQueries && dataQueries.length > 0)
			? { totalResults, shown: totalShown, truncated: false }
			: undefined;

		// Get all coordinates for center calculation
		const allCoords = [
			...allMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
			...allPolygons.flatMap((p) => p.coordinates),
			...allLines.flatMap((l) => l.coordinates),
		];

		// Calculate center if not provided
		const calculatedCenter =
			center ??
			(allCoords.length > 0
				? {
						lat:
							allCoords.reduce((sum, c) => sum + c.lat, 0) / allCoords.length,
						lng:
							allCoords.reduce((sum, c) => sum + c.lng, 0) / allCoords.length,
					}
				: { lat: 52.07, lng: 4.3 }); // Default to Den Haag

		const result = {
			description,
			center: calculatedCenter,
			zoom: zoom ?? 13,
			fitBounds: fitBounds ?? true,
			markers: allMarkers.map((m) => ({
				lat: m.lat,
				lng: m.lng,
				label: m.label,
				description: m.description,
				url: m.url,
				urlLabel: m.urlLabel,
				icon: m.icon ?? "mapPin",
				color: m.color ?? "#ef4444",
			})),
			polygons: allPolygons.map((p) => ({
				coordinates: p.coordinates,
				label: p.label,
				fillColor: p.fillColor ?? "#3b82f6",
				fillOpacity: p.fillOpacity ?? 0.2,
				fillPattern: p.fillPattern ?? "solid",
				strokeColor: p.strokeColor,
				strokeWidth: p.strokeWidth ?? 2,
				strokeOpacity: p.strokeOpacity ?? 1,
				strokeStyle: p.strokeStyle ?? "solid",
			})),
			lines: allLines.map((l) => ({
				coordinates: l.coordinates,
				label: l.label,
				strokeColor: l.strokeColor ?? "#3b82f6",
				strokeWidth: l.strokeWidth ?? 3,
				strokeOpacity: l.strokeOpacity ?? 1,
				strokeStyle: l.strokeStyle ?? "solid",
			})),
			legend,
			title,
			queryInfo,
			queryError,
			// Store the queries so data can be re-fetched on page reload
			dataQueries: dataQueries?.map((q) => ({
				datasets: q.datasets,
				sql: q.sql,
				limit: q.limit,
			})),
		} satisfies ShowMapOutput;

		return result;
	},

	// Return only a summary to the model (not the full markers/polygons/lines arrays)
	// This prevents context length issues while still streaming full data to frontend
	toModelOutput: (output) => {
		// Build a JSON-safe summary (no undefined values)
		const typedOutput = output as ShowMapOutput;
		const summary = JSON.stringify({
			description: typedOutput.description,
			title: typedOutput.title ?? null,
			center: typedOutput.center,
			zoom: typedOutput.zoom,
			fitBounds: typedOutput.fitBounds,
			markersCount: typedOutput.markers?.length ?? 0,
			polygonsCount: typedOutput.polygons?.length ?? 0,
			linesCount: typedOutput.lines?.length ?? 0,
			legend: typedOutput.legend.map((item) => ({
				label: item.label,
				icon: item.icon ?? null,
				color: item.color ?? null,
			})),
			queryInfo: typedOutput.queryInfo ?? null,
			queryError: typedOutput.queryError ?? null,
			// Include dataQueries so it can be re-fetched on page reload
			dataQueries: typedOutput.dataQueries ?? null,
		});
		return { type: "text" as const, value: summary };
	},
});
