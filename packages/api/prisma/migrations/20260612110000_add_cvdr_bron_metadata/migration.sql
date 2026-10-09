-- AlterTable
ALTER TABLE "SubsidieRegeling"
ADD COLUMN "bronGewijzigdOp" TIMESTAMP(3),
ADD COLUMN "bronGecontroleerdOp" TIMESTAMP(3),
ADD COLUMN "grondslag" TEXT,
ADD COLUMN "grondslagUrl" TEXT,
ADD COLUMN "bekendmakingKenmerk" TEXT,
ADD COLUMN "bekendmakingUrl" TEXT,
ADD COLUMN "betreft" TEXT,
ADD COLUMN "kenmerk" TEXT,
ADD COLUMN "thema" TEXT,
ADD COLUMN "vastgesteldDoor" TEXT,
ADD COLUMN "terugwerkendeKrachtTot" TIMESTAMP(3),
ADD COLUMN "externeBijlage" TEXT;
