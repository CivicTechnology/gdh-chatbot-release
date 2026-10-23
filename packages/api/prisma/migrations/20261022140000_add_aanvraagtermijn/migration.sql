-- Aanvraagtermijn uit de regelingstekst: een regeling kan formeel nog gelden
-- terwijl aanvragen al gesloten is.
ALTER TABLE "SubsidieRegeling" ADD COLUMN "aanvraagSluitingsdatum" TIMESTAMP(3);
ALTER TABLE "SubsidieRegeling" ADD COLUMN "aanvraagperiode" TEXT;
