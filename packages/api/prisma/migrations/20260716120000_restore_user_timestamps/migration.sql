-- Herstel van schema-drift uit het Drizzle-tijdperk: oudere databases missen
-- User.createdAt/updatedAt terwijl de baseline en het Prisma-schema ze wel
-- kennen. Elke prisma.user-query crasht daardoor zodra auth actief wordt.
-- Idempotent: no-op op databases die vers vanaf de baseline zijn opgebouwd.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
