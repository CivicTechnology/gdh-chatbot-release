/**
 * Web Database Schema
 *
 * This module re-exports the shared types for use in the web package.
 * All type definitions are centralized in the shared package.
 * Note: After the Prisma migration, we only export types (not Drizzle table schemas).
 */

// Re-export types (map Gdh-prefixed names back to web-friendly names)
export type {
  GdhBericht as DBMessage,
  GdhDataportaalDataset as CkanDataset,
  GdhDataportaalRecord as CkanRecord,
  GdhDocumentBron as DocumentSource,
  GdhEmbedding as DocumentEmbedding,
  GdhGebruiker as User,
  GdhGesprek as Chat,
  GdhKennisbankFragment as DocumentChunk,
  GdhSessie as Session,
  GdhStem as Vote,
  GdhStream as Stream,
  GdhZichtbaarheid as ChatVisibility,
  MessageDeprecated,
  VoteDeprecated,
} from "@gdh-chatbot/shared/db";
