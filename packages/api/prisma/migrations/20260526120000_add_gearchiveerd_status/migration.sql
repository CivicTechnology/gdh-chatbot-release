-- Add GEARCHIVEERD value to SubsidieStatus enum (handmatige archivering, los van
-- GEARCHIVEERD_VERVANGEN-flow waar een opvolger is opgegeven).
ALTER TYPE "SubsidieStatus" ADD VALUE IF NOT EXISTS 'GEARCHIVEERD' BEFORE 'GEARCHIVEERD_VERVANGEN';
