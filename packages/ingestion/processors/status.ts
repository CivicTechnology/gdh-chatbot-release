import { loadEnv } from "../lib/load-env.js";
import { disconnectPrisma, prisma } from "../lib/prisma.js";

loadEnv();

async function showStatus() {
  if (!process.env.POSTGRES_URL) {
    console.log("Database: Not configured (POSTGRES_URL not set)");
    return;
  }

  try {
    const sources = await prisma.documentSource.count();
    const chunks = await prisma.documentChunk.count();
    const embeddings = await prisma.documentEmbedding.count();

    console.log("Document Status:");
    console.log(`  Sources:    ${sources}`);
    console.log(`  Chunks:     ${chunks}`);
    console.log(`  Embeddings: ${embeddings}`);

    if (chunks > 0 && embeddings < chunks) {
      console.log(
        `\nNote: ${chunks - embeddings} chunks need embedding. Run: ingest process`
      );
    }
  } catch (error) {
    console.error("Failed to get status:", error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

showStatus();
