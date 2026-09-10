-- Subsidieregelingen: regelingen, versies, audit + User.role
-- Idempotent: safe to re-run.

-- AlterTable User: add role column (default "user")
DO $$ BEGIN
    ALTER TABLE "User" ADD COLUMN "role" VARCHAR(32) NOT NULL DEFAULT 'user';
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- CreateEnum SubsidieStatus
DO $$ BEGIN
    CREATE TYPE "SubsidieStatus" AS ENUM ('CONCEPT', 'ACTIEF', 'GEARCHIVEERD_VERVANGEN', 'VERLOPEN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum SubsidieBronType
DO $$ BEGIN
    CREATE TYPE "SubsidieBronType" AS ENUM ('LOKALEREGELGEVING', 'PDF', 'OVERIG');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum SubsidieDoelgroepCluster
DO $$ BEGIN
    CREATE TYPE "SubsidieDoelgroepCluster" AS ENUM ('PARTICULIER', 'BEDRIJF', 'MAATSCHAPPELIJK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum SubsidieAuditActie
DO $$ BEGIN
    CREATE TYPE "SubsidieAuditActie" AS ENUM ('CREATE', 'UPDATE', 'PUBLISH', 'PUBLISH_FAILED', 'ARCHIVE', 'REPLACE', 'EXPIRE', 'DEAD_LINK', 'DEAD_LINK_RESOLVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable SubsidieRegeling
CREATE TABLE IF NOT EXISTS "SubsidieRegeling" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "naam" TEXT NOT NULL,
    "doel" TEXT NOT NULL,
    "voorwaarden" TEXT NOT NULL,
    "aanvraagprocedure" TEXT NOT NULL,
    "looptijdStart" TIMESTAMP(3),
    "looptijdEind" TIMESTAMP(3),
    "maxBedragAanvrager" DECIMAL(12,2),
    "totaalSubsidiePlafond" DECIMAL(14,2),
    "vervaldatum" TIMESTAMP(3),
    "bronUrl" TEXT NOT NULL,
    "bronType" "SubsidieBronType" NOT NULL DEFAULT 'LOKALEREGELGEVING',
    "status" "SubsidieStatus" NOT NULL DEFAULT 'CONCEPT',
    "doelgroepNaam" TEXT NOT NULL,
    "doelgroepCluster" "SubsidieDoelgroepCluster" NOT NULL,
    "vervangenDoorId" UUID,
    "embedding" vector(1536),
    "embeddingModel" VARCHAR(64),
    "embeddedAt" TIMESTAMP(3),
    "lastDeadLinkCheckAt" TIMESTAMP(3),
    "deadLinkSince" TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubsidieRegeling_pkey" PRIMARY KEY ("id")
);

-- CreateTable SubsidieRegelingVersie
CREATE TABLE IF NOT EXISTS "SubsidieRegelingVersie" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "regelingId" UUID NOT NULL,
    "versienummer" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "gepubliceerdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gepubliceerdDoorUserId" UUID,
    CONSTRAINT "SubsidieRegelingVersie_pkey" PRIMARY KEY ("id")
);

-- CreateTable SubsidieRegelingAuditEvent
CREATE TABLE IF NOT EXISTS "SubsidieRegelingAuditEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "regelingId" UUID NOT NULL,
    "userId" UUID,
    "actie" "SubsidieAuditActie" NOT NULL,
    "diff" JSONB,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubsidieRegelingAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "SubsidieRegeling_status_idx" ON "SubsidieRegeling"("status");
CREATE INDEX IF NOT EXISTS "SubsidieRegeling_vervaldatum_idx" ON "SubsidieRegeling"("vervaldatum");
CREATE INDEX IF NOT EXISTS "SubsidieRegeling_doelgroepCluster_idx" ON "SubsidieRegeling"("doelgroepCluster");
CREATE UNIQUE INDEX IF NOT EXISTS "SubsidieRegelingVersie_regelingId_versienummer_key" ON "SubsidieRegelingVersie"("regelingId", "versienummer");
CREATE INDEX IF NOT EXISTS "SubsidieRegelingVersie_regelingId_idx" ON "SubsidieRegelingVersie"("regelingId");
CREATE INDEX IF NOT EXISTS "SubsidieRegelingAuditEvent_regelingId_idx" ON "SubsidieRegelingAuditEvent"("regelingId");
CREATE INDEX IF NOT EXISTS "SubsidieRegelingAuditEvent_createdAt_idx" ON "SubsidieRegelingAuditEvent"("createdAt");

-- ForeignKeys (drop-and-recreate idempotently)
DO $$ BEGIN
    ALTER TABLE "SubsidieRegeling" ADD CONSTRAINT "SubsidieRegeling_createdByUserId_fkey"
        FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "SubsidieRegeling" ADD CONSTRAINT "SubsidieRegeling_vervangenDoorId_fkey"
        FOREIGN KEY ("vervangenDoorId") REFERENCES "SubsidieRegeling"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "SubsidieRegelingVersie" ADD CONSTRAINT "SubsidieRegelingVersie_regelingId_fkey"
        FOREIGN KEY ("regelingId") REFERENCES "SubsidieRegeling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "SubsidieRegelingVersie" ADD CONSTRAINT "SubsidieRegelingVersie_gepubliceerdDoorUserId_fkey"
        FOREIGN KEY ("gepubliceerdDoorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "SubsidieRegelingAuditEvent" ADD CONSTRAINT "SubsidieRegelingAuditEvent_regelingId_fkey"
        FOREIGN KEY ("regelingId") REFERENCES "SubsidieRegeling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "SubsidieRegelingAuditEvent" ADD CONSTRAINT "SubsidieRegelingAuditEvent_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
