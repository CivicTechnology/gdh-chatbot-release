import { loadEnv } from "../lib/load-env.js";
import { disconnectPrisma, prisma } from "../lib/prisma.js";

loadEnv();

async function clearDocuments() {
  console.log("Clearing all document data from database...");

  if (!process.env.POSTGRES_URL) {
    console.error("ERROR: POSTGRES_URL environment variable is not set");
    process.exit(1);
  }

  try {
    // Delete in reverse order due to foreign key constraints
    const embeddingResult = await prisma.documentEmbedding.deleteMany();
    console.log(`   Deleted ${embeddingResult.count} DocumentEmbedding records`);

    const chunkResult = await prisma.documentChunk.deleteMany();
    console.log(`   Deleted ${chunkResult.count} DocumentChunk records`);

    const sourceResult = await prisma.documentSource.deleteMany();
    console.log(`   Deleted ${sourceResult.count} DocumentSource records`);

    console.log("\nDatabase cleared successfully!");
  } catch (error) {
    console.error("\nERROR: Failed to clear database:", error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

clearDocuments();
