/**
 * CKAN Repository
 * Database operations for CkanDataset and CkanRecord
 */

import { prisma } from "../../lib/prisma.js";
import type { DatasetInfo } from "./ckan.types.js";

// ============================================================================
// CkanDataset Operations
// ============================================================================

export async function findAllDatasets() {
	return prisma.ckanDataset.findMany();
}

export async function findDatasetByName(name: string) {
	return prisma.ckanDataset.findFirst({ where: { name } });
}

export async function deleteDatasetById(id: string) {
	return prisma.ckanDataset.delete({ where: { id } });
}

export async function upsertDatasetWithEmbedding(
	dataset: DatasetInfo,
	schema: Record<string, unknown>,
	recordCount: number,
	embedding: number[],
	existingId: string | null,
): Promise<string> {
	const vectorLiteral = `[${embedding.join(",")}]`;

	if (existingId) {
		await prisma.$executeRawUnsafe(
			`
      UPDATE "CkanDataset"
      SET "displayName" = $1,
          "description" = $2,
          "sourceUrl" = $3,
          "schema" = $4,
          "recordCount" = $5,
          "contentHash" = $6,
          "ckanResourceUrl" = $7,
          "ckanPackageId" = $8,
          "lastModified" = $9,
          "embedding" = '${vectorLiteral}'::vector,
          "updatedAt" = NOW()
      WHERE "id" = $10
    `,
			dataset.displayName,
			dataset.description || null,
			dataset.resourceUrl,
			JSON.stringify(schema),
			recordCount,
			dataset.contentHash,
			dataset.resourceUrl,
			dataset.packageId,
			dataset.lastModified ? new Date(dataset.lastModified) : null,
			existingId,
		);
		return existingId;
	}

	const result = await prisma.$queryRawUnsafe<{ id: string }[]>(
		`
    INSERT INTO "CkanDataset" (
      "id", "name", "displayName", "description", "sourceUrl", "schema",
      "recordCount", "contentHash", "ckanResourceUrl", "ckanPackageId",
      "lastModified", "embedding", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      '${vectorLiteral}'::vector, NOW(), NOW()
    )
    RETURNING id
  `,
		dataset.name,
		dataset.displayName,
		dataset.description || null,
		dataset.resourceUrl,
		JSON.stringify(schema),
		recordCount,
		dataset.contentHash,
		dataset.resourceUrl,
		dataset.packageId,
		dataset.lastModified ? new Date(dataset.lastModified) : null,
	);

	return result[0].id;
}

// ============================================================================
// CkanRecord Operations
// ============================================================================

export async function deleteRecordsByDatasetId(datasetId: string) {
	return prisma.ckanRecord.deleteMany({ where: { datasetId } });
}

export async function bulkInsertRecordsWithGeometry(
	records: Array<{
		datasetId: string;
		data: Record<string, unknown>;
		geometry: string | null;
	}>,
) {
	if (records.length === 0) return;

	const values = records.map((row) => {
		const jsonData = JSON.stringify(row.data).replace(/'/g, "''");
		const geom = row.geometry
			? `ST_GeomFromEWKT('${row.geometry}')`
			: "NULL";
		return `('${row.datasetId}', '${jsonData}'::jsonb, ${geom}, NOW())`;
	});

	const insertSql = `
    INSERT INTO "CkanRecord" ("datasetId", "data", "geometry", "createdAt")
    VALUES ${values.join(",\n")}
  `;

	await prisma.$executeRawUnsafe(insertSql);
}
