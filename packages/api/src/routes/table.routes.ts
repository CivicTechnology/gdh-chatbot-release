import { Router } from "express";
import { z } from "zod";
import { executeQuery } from "@/lib/ai/tools/query-ckan.js";

const router = Router();

// Schema for the data query request
const dataQuerySchema = z.object({
	datasets: z.array(z.string()).min(1),
	sql: z.string().min(1),
	limit: z.number().min(1).optional(),
});

/**
 * Extract column definitions from query results
 */
function extractColumns(
	rows: Record<string, unknown>[],
): Array<{ key: string; name: string }> {
	if (rows.length === 0) return [];

	const firstRow = rows[0];
	return Object.keys(firstRow).map((key) => ({
		key,
		name: key,
	}));
}

/**
 * POST /api/table/query
 * Re-executes a stored dataQuery to fetch table rows
 * This is used when loading a saved chat that has stripped row data
 */
router.post("/query", async (req, res) => {
	try {
		const parsed = dataQuerySchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({ error: "Invalid query", details: parsed.error });
			return;
		}

		const { datasets, sql, limit } = parsed.data;

		// Execute the query
		const results = await executeQuery(datasets, sql);
		const totalRows = results.length;

		// Apply limit if specified
		const rows = limit
			? (results.slice(0, limit) as Record<string, unknown>[])
			: (results as Record<string, unknown>[]);

		const columns = extractColumns(rows);
		const truncated = limit != null && totalRows > limit;

		res.json({
			columns,
			rows,
			totalRows,
			truncated,
		});
	} catch (error) {
		console.error("[table/query] Error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Query execution failed";
		res.status(500).json({ error: errorMessage });
	}
});

export default router;
