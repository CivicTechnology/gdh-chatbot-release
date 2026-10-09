-- AlterTable
ALTER TABLE "User" ADD COLUMN     "entraOid" UUID,
ADD COLUMN     "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(320);

-- CreateIndex
CREATE UNIQUE INDEX "User_entraOid_key" ON "User"("entraOid");
