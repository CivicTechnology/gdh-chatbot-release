/**
 * API Database Schema Types
 *
 * This module re-exports Prisma-generated types for backward compatibility.
 * The actual schema is defined in packages/api/prisma/schema.prisma
 *
 * Note: PostGIS geometry operations are handled via raw SQL queries
 * since Prisma uses Unsupported() type for geometry columns.
 */

// Re-export types from Prisma generated client
export type {
	User,
	Session,
	Chat,
	Message as DBMessage,
	MessageDeprecated,
	Vote,
	VoteDeprecated,
	Stream,
	DocumentSource,
	DocumentChunk,
	DocumentEmbedding,
	CkanDataset,
	CkanRecord,
	ChatVisibility,
} from "@gdh-chatbot/api/prisma";

// Note: Table references (user, session, chat, etc.) are no longer exported
// since Prisma uses a different pattern. Use prisma.user, prisma.session, etc.
// through the Prisma client instead.

// Note: PostGIS geometry is handled via raw SQL queries in the CKAN tools.
// The geometry column is defined as Unsupported("geometry(Geometry, 4326)")
// in the Prisma schema.
