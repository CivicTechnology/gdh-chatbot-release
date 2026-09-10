-- Voeg UNARCHIVE-actie toe aan SubsidieAuditActie-enum voor het terugzetten
-- van een GEARCHIVEERD-regeling naar ACTIEF.
ALTER TYPE "SubsidieAuditActie" ADD VALUE IF NOT EXISTS 'UNARCHIVE' AFTER 'ARCHIVE';
