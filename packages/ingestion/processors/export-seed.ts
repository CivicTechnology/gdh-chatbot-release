import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import type {
  DocumentChunk,
  DocumentSource,
} from "@gdh-chatbot/shared/db";
import { loadEnv } from "../lib/load-env.js";
import { disconnectPrisma, prisma } from "../lib/prisma.js";

loadEnv();

const gzipAsync = promisify(gzip);

// Resolve paths relative to ingestion package root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INGESTION_ROOT = resolve(__dirname, "..");
const SEED_DIR = resolve(INGESTION_ROOT, "storage", "seed");

// Local type for embeddings since we fetch via raw SQL
type EmbeddingRecord = {
  id: string;
  chunkId: string;
  embeddingModel: string;
  embeddedAt: Date;
  embedding: number[];
};

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
  embeddings: EmbeddingRecord[];
};

type OptimizedEmbedding = Omit<EmbeddingRecord, "embedding"> & {
  embedding: string;
};

type OptimizedSeedData = Omit<SeedData, "embeddings"> & {
  embeddings: OptimizedEmbedding[];
};

function parseEmbeddingArray(
  embedding: unknown,
  chunkId: string
): number[] | null {
  if (!embedding) {
    return null;
  }

  let embArray = embedding;
  if (typeof embArray === "string") {
    try {
      embArray = JSON.parse(embArray);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(embArray)) {
    return null;
  }

  if (embArray.length === 0) {
    return null;
  }

  if (embArray.length !== 1536) {
    console.error(
      `ERROR: Embedding for chunk ${chunkId} has incorrect length: ${embArray.length} (expected 1536)`
    );
    return null;
  }

  return embArray;
}

function validateEmbeddings(
  embeddings: EmbeddingRecord[],
  chunkIds: Set<string>
): { valid: EmbeddingRecord[]; orphaned: number; emptyVectors: number } {
  console.log("\nValidating embeddings...");
  const valid: EmbeddingRecord[] = [];
  let orphaned = 0;
  let emptyVectors = 0;

  for (const emb of embeddings) {
    // Check if chunk exists
    if (!chunkIds.has(emb.chunkId)) {
      orphaned += 1;
      continue;
    }

    // Check if embedding vector is valid
    const embArray = parseEmbeddingArray(emb.embedding, emb.chunkId);
    if (embArray === null) {
      emptyVectors += 1;
      continue;
    }

    valid.push(emb);
  }

  if (orphaned > 0) {
    console.warn(
      `WARNING: Found ${orphaned} orphaned embeddings (referencing non-existent chunks). These will be excluded.`
    );
  }

  if (emptyVectors > 0) {
    console.error(
      `ERROR: Found ${emptyVectors} embeddings with empty or invalid vectors!`
    );
    console.error(
      "\nPlease run 'bun run ingest process' to generate missing embeddings before exporting."
    );
    process.exit(1);
  }

  return { valid, orphaned, emptyVectors };
}

function optimizeEmbeddings(seedData: SeedData): OptimizedSeedData {
  console.log("Optimizing embedding format...");
  return {
    ...seedData,
    embeddings: seedData.embeddings.map((emb) => {
      // Parse embedding if it's a string (from database)
      let embArray = emb.embedding;
      if (typeof embArray === "string") {
        try {
          embArray = JSON.parse(embArray);
        } catch (e) {
          throw new Error(
            `Failed to parse embedding for chunk ${emb.chunkId}: ${e}`
          );
        }
      }

      // Validate it's an array
      if (!Array.isArray(embArray) || embArray.length === 0) {
        throw new Error(`Invalid embedding for chunk ${emb.chunkId}`);
      }

      return {
        ...emb,
        // Convert embedding array to base64-encoded Float32Array for 50% size reduction
        embedding: Buffer.from(new Float32Array(embArray).buffer).toString(
          "base64"
        ),
      };
    }),
  };
}

async function exportSeedData() {
  console.log("Starting document seed data export...");

  if (!process.env.POSTGRES_URL) {
    console.error("ERROR: POSTGRES_URL environment variable is not set");
    process.exit(1);
  }

  try {
    // Query all document-related data
    console.log("Querying DocumentSource...");
    const sources = await prisma.documentSource.findMany();

    console.log("Querying DocumentChunk...");
    const chunks = await prisma.documentChunk.findMany();

    console.log("Querying DocumentEmbedding...");
    // Use raw SQL to fetch embeddings because Prisma doesn't support pgvector type
    const embeddings = await prisma.$queryRaw<EmbeddingRecord[]>`
      SELECT
        id,
        "chunkId",
        "embeddingModel",
        "embeddedAt",
        embedding::text::json as embedding
      FROM "DocumentEmbedding"
    `;

    // Get embedding model from first embedding (they should all be the same)
    const embeddingModel =
      embeddings.length > 0 ? embeddings[0].embeddingModel : "unknown";

    // Prepare seed data
    const seedData: SeedData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        embeddingModel,
        counts: {
          sources: sources.length,
          chunks: chunks.length,
          embeddings: embeddings.length,
        },
      },
      sources,
      chunks,
      embeddings,
    };

    console.log("\nExport Summary:");
    console.log(`  - DocumentSource: ${sources.length} records`);
    console.log(`  - DocumentChunk: ${chunks.length} records`);
    console.log(`  - DocumentEmbedding: ${embeddings.length} records`);
    console.log(`  - Embedding Model: ${embeddingModel}`);

    // Validate embeddings before optimization
    const chunkIds = new Set(chunks.map((c) => c.id));
    const { valid: validEmbeddings, orphaned } = validateEmbeddings(
      seedData.embeddings,
      chunkIds
    );

    // Update seed data with only valid embeddings
    seedData.embeddings = validEmbeddings;
    seedData.metadata.counts.embeddings = validEmbeddings.length;

    if (orphaned > 0) {
      console.log(
        `  - Valid embeddings after filtering: ${validEmbeddings.length}`
      );
    }

    // Convert embeddings to more efficient format
    const optimizedData = optimizeEmbeddings(seedData);

    // Convert to JSON with BigInt handling
    const jsonData = JSON.stringify(
      optimizedData,
      (_key, value) => (typeof value === "bigint" ? Number(value) : value),
      0
    ); // No indentation for smaller size
    const jsonSize = Buffer.byteLength(jsonData);

    // Compress with gzip
    console.log("Compressing data...");
    const compressed = await gzipAsync(jsonData, { level: 9 });
    const compressedSize = compressed.length;

    // Create output directory if it doesn't exist
    mkdirSync(SEED_DIR, { recursive: true });

    // Write compressed file
    const outputPath = resolve(SEED_DIR, "documents.json.gz");
    writeFileSync(outputPath, compressed);

    console.log("\nExport completed successfully!");
    console.log(`  - Output: ${outputPath}`);
    console.log(`  - Uncompressed: ${(jsonSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(
      `  - Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(
      `  - Compression ratio: ${((1 - compressedSize / jsonSize) * 100).toFixed(1)}%`
    );
  } catch (error) {
    console.error("\nERROR: Export failed:", error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

exportSeedData();
