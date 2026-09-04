-- Baseline migration for gdh-chatbot
-- Idempotent: safe to run on databases with partial schema

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "ChatVisibility" AS ENUM ('public', 'private');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(64) NOT NULL,
    "password" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(64),
    "userAgent" TEXT,
    "userId" UUID NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Chat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "visibility" "ChatVisibility" NOT NULL DEFAULT 'private',
    "lastContext" JSONB,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "role" VARCHAR NOT NULL,
    "parts" JSONB NOT NULL,
    "attachments" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Message_v2_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Vote_v2" (
    "chatId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "isUpvoted" BOOLEAN NOT NULL,
    CONSTRAINT "Vote_v2_pkey" PRIMARY KEY ("chatId","messageId")
);

CREATE TABLE IF NOT EXISTS "Stream" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceId" VARCHAR(128) NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "notes" TEXT,
    "sha256" VARCHAR(64) NOT NULL,
    "bytes" BIGINT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "manifest" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentChunk" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceId" UUID NOT NULL,
    "chunkId" VARCHAR(128) NOT NULL,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "chunkType" VARCHAR(32) NOT NULL,
    "sectionPath" JSONB,
    "isTable" BOOLEAN NOT NULL DEFAULT false,
    "tableId" TEXT,
    "viewerAnchor" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentEmbedding" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chunkId" UUID NOT NULL,
    "embeddingModel" VARCHAR(64) NOT NULL,
    "embeddedAt" TIMESTAMP(3) NOT NULL,
    "embedding" vector(1536) NOT NULL,
    CONSTRAINT "DocumentEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CkanDataset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(64) NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "sourceUrl" TEXT,
    "schema" JSONB,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" VARCHAR(64),
    "ckanResourceUrl" TEXT,
    "ckanPackageId" TEXT,
    "lastModified" TIMESTAMP(3),
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CkanDataset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CkanRecord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "datasetId" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "geometry" geometry(Geometry, 4326),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CkanRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "role" VARCHAR NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Vote" (
    "chatId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "isUpvoted" BOOLEAN NOT NULL,
    CONSTRAINT "Vote_pkey" PRIMARY KEY ("chatId","messageId")
);

-- Ensure columns exist on tables that may have been created before schema updates
-- This handles the case where tables exist but are missing newer columns

-- Fix vector columns with wrong dimensions (3072 -> 1536)
-- This will drop and recreate the columns, losing existing embeddings
DO $$
DECLARE
    col_dim integer;
BEGIN
    -- Check DocumentEmbedding.embedding dimensions
    SELECT atttypmod INTO col_dim
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'DocumentEmbedding' AND a.attname = 'embedding';

    IF col_dim IS NOT NULL AND col_dim != 1536 THEN
        RAISE NOTICE 'Recreating DocumentEmbedding.embedding with correct dimensions (was %, now 1536)', col_dim;
        -- Delete existing rows since embeddings will be invalid anyway
        DELETE FROM "DocumentEmbedding";
        ALTER TABLE "DocumentEmbedding" DROP COLUMN "embedding";
        ALTER TABLE "DocumentEmbedding" ADD COLUMN "embedding" vector(1536) NOT NULL;
    END IF;

    -- Check CkanDataset.embedding dimensions
    SELECT atttypmod INTO col_dim
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'CkanDataset' AND a.attname = 'embedding';

    IF col_dim IS NOT NULL AND col_dim != 1536 THEN
        RAISE NOTICE 'Recreating CkanDataset.embedding with correct dimensions (was %, now 1536)', col_dim;
        ALTER TABLE "CkanDataset" DROP COLUMN "embedding";
        ALTER TABLE "CkanDataset" ADD COLUMN "embedding" vector(1536);
    END IF;
END $$;

-- Chat table columns
DO $$ BEGIN
    ALTER TABLE "Chat" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Chat" ADD COLUMN "lastContext" JSONB;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Chat" ADD COLUMN "visibility" "ChatVisibility" NOT NULL DEFAULT 'private';
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Clean up duplicate emails before creating unique index
DELETE FROM "User" a USING "User" b
WHERE a.ctid < b.ctid AND a.email = b.email;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Chat_userId_idx" ON "Chat"("userId");
CREATE INDEX IF NOT EXISTS "Chat_createdAt_idx" ON "Chat"("createdAt");
CREATE INDEX IF NOT EXISTS "Message_v2_chatId_idx" ON "Message_v2"("chatId");
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentSource_sourceId_key" ON "DocumentSource"("sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentSource_url_key" ON "DocumentSource"("url");
CREATE INDEX IF NOT EXISTS "DocumentChunk_sourceId_idx" ON "DocumentChunk"("sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentChunk_sourceId_chunkId_key" ON "DocumentChunk"("sourceId", "chunkId");
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentChunk_sourceId_order_key" ON "DocumentChunk"("sourceId", "order");
CREATE INDEX IF NOT EXISTS "DocumentEmbedding_chunkId_idx" ON "DocumentEmbedding"("chunkId");
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentEmbedding_chunkId_embeddingModel_key" ON "DocumentEmbedding"("chunkId", "embeddingModel");
CREATE UNIQUE INDEX IF NOT EXISTS "CkanDataset_name_key" ON "CkanDataset"("name");
CREATE INDEX IF NOT EXISTS "CkanRecord_datasetId_idx" ON "CkanRecord"("datasetId");
-- Note: CkanRecord_geometry_idx is not created here as it was removed in a later migration
CREATE INDEX IF NOT EXISTS "Message_chatId_idx" ON "Message"("chatId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DocumentSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "DocumentEmbedding" ADD CONSTRAINT "DocumentEmbedding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "CkanRecord" ADD CONSTRAINT "CkanRecord_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CkanDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
