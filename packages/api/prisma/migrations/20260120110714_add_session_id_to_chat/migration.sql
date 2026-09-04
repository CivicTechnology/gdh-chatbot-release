-- DropIndex (idempotent)
DROP INDEX IF EXISTS "CkanRecord_geometry_idx";

-- AlterTable (idempotent)
DO $$ BEGIN
    ALTER TABLE "Chat" ADD COLUMN "sessionId" UUID;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Chat" ALTER COLUMN "userId" DROP NOT NULL;
EXCEPTION WHEN others THEN null; END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Chat_sessionId_idx" ON "Chat"("sessionId");
