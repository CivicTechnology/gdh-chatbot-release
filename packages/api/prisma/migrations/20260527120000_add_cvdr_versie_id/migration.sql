-- Sla de laatst-gesyncte CVDR-versie-id op per regeling, zodat de sync in
-- "update"-modus regelingen met onveranderde versie kan overslaan en de dure
-- XML-fetch + AI-extractie alleen draait voor daadwerkelijk gewijzigde records.
ALTER TABLE "SubsidieRegeling"
ADD COLUMN "cvdrVersieId" VARCHAR(128);
