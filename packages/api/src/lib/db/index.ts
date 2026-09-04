// Re-export Prisma client
export { prisma } from "./prisma.js";

// Re-export Prisma types
export type {
  User,
  Session,
  Chat,
  Message as DBMessage,
  Vote,
  Stream,
  DocumentSource,
  DocumentChunk,
  DocumentEmbedding,
  CkanDataset,
  CkanRecord,
} from "@gdh-chatbot/api/prisma";

// Re-export local queries (API-specific implementations that use Prisma)
export * from "./queries.js";

// Re-export local utils
export * from "./utils.js";
