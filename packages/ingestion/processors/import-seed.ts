import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { Prisma } from "@gdh-chatbot/api/prisma";
import type {
  DocumentChunk,
  DocumentEmbedding,
  DocumentSource,
} from "@gdh-chatbot/shared/db";
import { loadEnv } from "../lib/load-env.js";
import { disconnectPrisma, prisma } from "../lib/prisma.js";

loadEnv();

const gunzipAsync = promisify(gunzip);

// Resolve paths relative to ingestion package root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INGESTION_ROOT = resolve(__dirname, "..");
const SEED_FILE = resolve(INGESTION_ROOT, "storage", "seed", "documents.json.gz");

type SeedData = {
  metadata: {
    exportedAt: string;
    embeddingModel: string;
    counts: {
      sources: number;
      chunks: number;
      embeddings: number;
    };
  };
  sources: DocumentSource[];
  chunks: DocumentChunk[];
  embeddings: (Omit<DocumentEmbedding, "embedding"> & { embedding: number[] })[];
};

type OptimizedEmbedding = Omit<DocumentEmbedding, "embedding"> & {
  embedding: string;
};

type OptimizedSeedData = Omit<SeedData, "embeddings"> & {
  embeddings: OptimizedEmbedding[];
};

async function handleExistingData(forceImport: boolean): Promise<boolean> {
  const sourceCount = await prisma.documentSource.count();
  const chunkCount = await prisma.documentChunk.count();
  const embeddingCount = await prisma.documentEmbedding.count();

  const hasData = sourceCount > 0 || chunkCount > 0 || embeddingCount > 0;

  if (!hasData) {
    return true; // Continue with import
  }

  if (!forceImport) {
    console.log(
      "INFO: Database already contains document data. Skipping import."
    );
    console.log(`   - DocumentSource: ${sourceCount} records`);
    console.log(`   - DocumentChunk: ${chunkCount} records`);
    console.log(`   - DocumentEmbedding: ${embeddingCount} records`);
    console.log("   Use --force flag to overwrite existing data");
    return false; // Skip import
  }

  console.log("WARNING: --force flag detected. Deleting existing data...");
  console.log(`   - DocumentSource: ${sourceCount} records`);
  console.log(`   - DocumentChunk: ${chunkCount} records`);
  console.log(`   - DocumentEmbedding: ${embeddingCount} records`);

  // Delete in reverse order due to foreign key constraints
  await prisma.documentEmbedding.deleteMany();
  console.log("   - Deleted all DocumentEmbedding records");
  await prisma.documentChunk.deleteMany();
  console.log("   - Deleted all DocumentChunk records");
  await prisma.documentSource.deleteMany();
  console.log("   - Deleted all DocumentSource records");
  console.log("Database cleared. Proceeding with import...\n");

  return true; // Continue with import
}

async function importSeedData() {
  console.log("Starting document seed data import...");

  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL is not defined, skipping seed import (CI mode)");
    process.exit(0);
  }

  const forceImport = process.argv.includes("--force");

  // Check if seed file exists
  if (!existsSync(SEED_FILE)) {
    console.log("INFO: Seed file not found. Skipping import.");
    console.log(`   Expected: ${SEED_FILE}`);
    console.log("   Run 'bun run ingest backup' to create the seed file.");
    return;
  }

  try {
    // Check if database already has data and handle accordingly
    const shouldContinue = await handleExistingData(forceImport);
    if (!shouldContinue) {
      return;
    }

    // Read and decompress seed file
    console.log("Reading seed file...");
    const compressed = readFileSync(SEED_FILE);
    const decompressed = await gunzipAsync(compressed);
    const rawData = JSON.parse(decompressed.toString()) as OptimizedSeedData;

    // Convert embeddings back from optimized format
    console.log("Decoding embedding format...");
    const seedData: SeedData = {
      ...rawData,
      embeddings: rawData.embeddings.map((emb) => ({
        ...emb,
        // Convert base64 back to number array
        embedding: Array.from(
          new Float32Array(Buffer.from(emb.embedding, "base64").buffer)
        ),
      })),
    };

    // Convert timestamp strings to Date objects
    console.log("Converting timestamps...");
    seedData.sources = seedData.sources.map((source) => ({
      ...source,
      createdAt: new Date(source.createdAt),
      updatedAt: new Date(source.updatedAt),
      publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
      lastCheckedAt: source.lastCheckedAt
        ? new Date(source.lastCheckedAt)
        : null,
    }));

    seedData.chunks = seedData.chunks.map((chunk) => ({
      ...chunk,
      createdAt: new Date(chunk.createdAt),
    }));

    seedData.embeddings = seedData.embeddings.map((embedding) => ({
      ...embedding,
      embeddedAt: new Date(embedding.embeddedAt),
    }));

    console.log("\nSeed file metadata:");
    console.log(`  - Exported: ${seedData.metadata.exportedAt}`);
    console.log(`  - Embedding Model: ${seedData.metadata.embeddingModel}`);
    console.log(`  - Sources: ${seedData.metadata.counts.sources}`);
    console.log(`  - Chunks: ${seedData.metadata.counts.chunks}`);
    console.log(`  - Embeddings: ${seedData.metadata.counts.embeddings}`);

    // Import DocumentSource
    if (seedData.sources.length > 0) {
      console.log("\nImporting DocumentSource...");
      const batchSize = 100;
      for (let i = 0; i < seedData.sources.length; i += batchSize) {
        const batch = seedData.sources.slice(i, i + batchSize);
        // Cast JSON fields to satisfy Prisma's InputJsonValue type
        const typedBatch = batch.map((source) => ({
          ...source,
          tags: source.tags as Prisma.InputJsonValue,
          manifest: source.manifest as Prisma.InputJsonValue,
        }));
        await prisma.documentSource.createMany({ data: typedBatch });
        console.log(
          `  - Inserted ${Math.min(i + batchSize, seedData.sources.length)}/${seedData.sources.length}`
        );
      }
      console.log("DocumentSource imported");
    }

    // Import DocumentChunk
    if (seedData.chunks.length > 0) {
      console.log("\nImporting DocumentChunk...");
      const batchSize = 500;
      for (let i = 0; i < seedData.chunks.length; i += batchSize) {
        const batch = seedData.chunks.slice(i, i + batchSize);
        // Cast JSON fields to satisfy Prisma's InputJsonValue type
        const typedBatch = batch.map((chunk) => ({
          ...chunk,
          sectionPath: chunk.sectionPath as Prisma.InputJsonValue,
          metadata: chunk.metadata as Prisma.InputJsonValue,
        }));
        await prisma.documentChunk.createMany({ data: typedBatch });
        console.log(
          `  - Inserted ${Math.min(i + batchSize, seedData.chunks.length)}/${seedData.chunks.length}`
        );
      }
      console.log("DocumentChunk imported");
    }

    // Import DocumentEmbedding using raw SQL (Prisma doesn't support vector type in createMany)
    if (seedData.embeddings.length > 0) {
      console.log("\nImporting DocumentEmbedding...");

      // Filter out embeddings that reference non-existent chunks
      const importedChunkIds = new Set(seedData.chunks.map((c) => c.id));
      const validEmbeddings = seedData.embeddings.filter((emb) =>
        importedChunkIds.has(emb.chunkId)
      );
      const skippedCount = seedData.embeddings.length - validEmbeddings.length;

      if (skippedCount > 0) {
        console.warn(
          `  - WARNING: Skipping ${skippedCount} embeddings with missing chunk references`
        );
        console.log(
          `  - Valid embeddings to import: ${validEmbeddings.length}`
        );
      }

      const batchSize = 50; // Smaller batches for raw SQL with vectors
      for (let i = 0; i < validEmbeddings.length; i += batchSize) {
        const batch = validEmbeddings.slice(i, i + batchSize);
        const values = batch.map((emb) => {
          const vectorLiteral = `[${(emb.embedding as number[]).join(",")}]`;
          return Prisma.sql`(${emb.id}, ${emb.chunkId}, ${emb.embeddingModel}, ${emb.embeddedAt}, ${vectorLiteral}::vector)`;
        });
        await prisma.$executeRaw`
          INSERT INTO "DocumentEmbedding" (id, "chunkId", "embeddingModel", "embeddedAt", embedding)
          VALUES ${Prisma.join(values)}
        `;
        console.log(
          `  - Inserted ${Math.min(i + batchSize, validEmbeddings.length)}/${validEmbeddings.length}`
        );
      }
      console.log("DocumentEmbedding imported");
    }

    // Verify import
    const finalSourceCount = await prisma.documentSource.count();
    const finalChunkCount = await prisma.documentChunk.count();
    const finalEmbeddingCount = await prisma.documentEmbedding.count();

    console.log("\nImport completed successfully!");
    console.log("Final counts:");
    console.log(`  - DocumentSource: ${finalSourceCount}`);
    console.log(`  - DocumentChunk: ${finalChunkCount}`);
    console.log(`  - DocumentEmbedding: ${finalEmbeddingCount}`);
  } catch (error) {
    console.error("\nERROR: Import failed:", error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

importSeedData();
