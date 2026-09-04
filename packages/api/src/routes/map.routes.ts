import { Router } from "express";
import { z } from "zod";
import { executeQuery } from "@/lib/ai/tools/query-ckan.js";

const router = Router();

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

/**
 * Helper to extract a value from either the row directly or from the data JSONB field
 */
function getValue(row: Record<string, unknown>, key: string): unknown {
	// First check if it's directly on the row
	if (key in row) {
		return row[key];
	}
	// Then check in the data JSONB field
	const data = row.data as Record<string, unknown> | undefined;
	if (data && typeof data === "object" && key in data) {
		return data[key];
	}
	return undefined;
}

/**
 * POST /api/map/ckan-query
 * Re-executes a stored CKAN query to fetch results
 * This is used when loading a saved chat that has stripped query results
 */
router.post("/ckan-query", async (req, res) => {
	const ckanQuerySchema = z.object({
		datasets: z.array(z.string()).min(1),
		query: z.string().min(1),
		outputLimit: z.number().min(1).max(100).default(50),
	});

	try {
		const parsed = ckanQuerySchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({ error: "Invalid query", details: parsed.error });
			return;
		}

		const { datasets, query, outputLimit } = parsed.data;

		// Execute the query (now async with PostgreSQL)
		const results = await executeQuery(datasets, query);
		const totalResults = results.length;
		const truncated = totalResults > outputLimit;

		res.json({
			success: true,
			totalResults,
			resultsShown: Math.min(totalResults, outputLimit),
			truncated,
			results: results.slice(0, outputLimit),
		});
	} catch (error) {
		console.error("[map/ckan-query] Error:", error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : "Query execution failed",
		});
	}
});

// Schema for the data query request
const dataQuerySchema = z.object({
	datasets: z.array(z.string()).min(1),
	sql: z.string().min(1),
	limit: z.number().min(1).optional(),
});

/**
 * POST /api/map/query
 * Re-executes a stored dataQuery to fetch map markers/polygons
 * This is used when loading a saved chat that has stripped marker data
 */
router.post("/query", async (req, res) => {
	try {
		const parsed = dataQuerySchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({ error: "Invalid query", details: parsed.error });
			return;
		}

		const { datasets, sql, limit } = parsed.data;

		// Execute the query (now async with PostgreSQL)
		const results = await executeQuery(datasets, sql);
		const totalResults = results.length;

		// Apply limit if specified
		const limitedResults = limit ? results.slice(0, limit) : results;

		// Type helper for row access
		type Row = Record<string, unknown>;

		// Convert results to markers (for rows with lat/lng within Netherlands)
		const markers = (limitedResults as Row[])
			.filter((row) => {
				const lat = getValue(row, "lat");
				const lng = getValue(row, "lng");
				if (lat == null || lng == null) return false;
				const latNum = Number(lat);
				const lngNum = Number(lng);
				if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return false;
				return isInNetherlands(latNum, lngNum);
			})
			.map((row) => ({
				lat: Number(getValue(row, "lat")),
				lng: Number(getValue(row, "lng")),
				label: getValue(row, "label") != null ? String(getValue(row, "label")) : undefined,
				description:
					getValue(row, "description") != null
						? String(getValue(row, "description"))
						: undefined,
				url: getValue(row, "url") != null ? String(getValue(row, "url")) : undefined,
				urlLabel:
					getValue(row, "urlLabel") != null ? String(getValue(row, "urlLabel")) : undefined,
				icon: getValue(row, "icon") != null ? String(getValue(row, "icon")) : "mapPin",
				color: getValue(row, "color") != null ? String(getValue(row, "color")) : "#ef4444",
			}));

		// Convert results to polygons (for rows with polygon field)
		const polygons = (limitedResults as Row[])
			.filter((row) => {
				const polygon = getValue(row, "polygon");
				return Array.isArray(polygon) && polygon.length > 0;
			})
			.map((row) => {
				const polygon = getValue(row, "polygon") as unknown[][];
				const firstRing = polygon[0];
				if (!Array.isArray(firstRing) || firstRing.length < 3) {
					return null;
				}
				const coordinates = firstRing
					.filter(
						(p): p is { lat: number; lng: number } =>
							p != null &&
							typeof p === "object" &&
							"lat" in p &&
							"lng" in p &&
							typeof (p as { lat: unknown }).lat === "number" &&
							typeof (p as { lng: unknown }).lng === "number",
					)
					.map((p) => ({ lat: p.lat, lng: p.lng }));

				if (coordinates.length < 3) {
					return null;
				}

				return {
					coordinates,
					label: getValue(row, "label") != null ? String(getValue(row, "label")) : undefined,
					fillColor:
						getValue(row, "color") != null ? String(getValue(row, "color")) : "#3b82f6",
					fillOpacity:
						typeof getValue(row, "opacity") === "number" ? getValue(row, "opacity") : 0.2,
				};
			})
			.filter((p) => p !== null);

		res.json({
			markers,
			polygons,
			queryInfo: {
				totalResults,
				shown: markers.length + polygons.length,
				truncated: limit != null && totalResults > limit,
			},
		});
	} catch (error) {
		console.error("[map/query] Error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Query execution failed";
		res.status(500).json({ error: errorMessage });
	}
});

export default router;
