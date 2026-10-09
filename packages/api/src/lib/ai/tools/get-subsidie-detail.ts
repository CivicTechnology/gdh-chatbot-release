import { tool } from "ai";
import { z } from "zod";
import { findById } from "@/domains/subsidieregeling/subsidieregeling.repository.js";
import { DOORVERWIJZING } from "@/lib/constants.js";

/**
 * Detail-tool die complementair is aan `findSubsidies`: de zoektool levert
 * lichte snippets; deze tool laadt de complete regeling-data wanneer de
 * gebruiker doorvraagt over één specifieke regeling.
 *
 * Decimal-velden uit Prisma worden gestringified zodat het AI-model ze direct
 * kan weergeven zonder eigen number-formatting.
 */
export const getSubsidieDetail = tool({
	description: `Laad de volledige details van één subsidieregeling — voorwaarden, aanvraagprocedure,
exacte bedragen, looptijd en bron-URL. Gebruik dit ALLEEN wanneer de gebruiker doorvraagt over
een specifieke regeling die eerder uit \`findSubsidies\` kwam (bv. "wat zijn de exacte voorwaarden
van X?", "hoe vraag ik X aan?", "wat is het maximum bedrag voor X?"). Voor eerste-orde zoekvragen
gebruik je \`findSubsidies\`.`,
	inputSchema: z.object({
		id: z
			.string()
			.uuid()
			.describe(
				"De id zoals teruggegeven door findSubsidies (bv. `regelingen[i].id`). Geen URL, geen naam.",
			),
	}),
	execute: async ({ id }) => {
		const regeling = await findById(id);
		if (!regeling) {
			return {
				notFound: true,
				suggestion: `Vermeld dat de regeling niet meer beschikbaar is en geef daarna de doorverwijzing. Verzin geen vervangende regeling en vul het antwoord niet aan met algemene kennis. Doorverwijzing: ${DOORVERWIJZING}`,
			};
		}

		const isAvailable =
			regeling.status === "ACTIEF" ||
			regeling.status === "GEARCHIVEERD_VERVANGEN";
		if (!isAvailable) {
			return {
				notFound: false,
				status: regeling.status,
				message:
					"Deze regeling is niet (meer) actief. Vertel dat aan de gebruiker en verwijs naar de actieve regelingen.",
			};
		}

		return {
			notFound: false,
			id: regeling.id,
			naam: regeling.naam,
			doel: regeling.doel,
			voorwaarden: regeling.voorwaarden,
			aanvraagprocedure: regeling.aanvraagprocedure,
			doelgroep: regeling.doelgroepNaam,
			doelgroepCluster: regeling.doelgroepCluster,
			maxBedragAanvrager: regeling.maxBedragAanvrager
				? regeling.maxBedragAanvrager.toString()
				: null,
			totaalSubsidiePlafond: regeling.totaalSubsidiePlafond
				? regeling.totaalSubsidiePlafond.toString()
				: null,
			plafonds: regeling.plafonds ?? null,
			looptijdStart: regeling.looptijdStart?.toISOString().slice(0, 10) ?? null,
			looptijdEind: regeling.looptijdEind?.toISOString().slice(0, 10) ?? null,
			vervaldatum: regeling.vervaldatum?.toISOString().slice(0, 10) ?? null,
			publicatieDatum: regeling.publicatieDatum?.toISOString().slice(0, 10) ?? null,
			bronGewijzigdOp:
				regeling.bronGewijzigdOp?.toISOString().slice(0, 10) ?? null,
			bronGecontroleerdOp:
				regeling.bronGecontroleerdOp?.toISOString().slice(0, 10) ?? null,
			grondslag: regeling.grondslag,
			grondslagUrl: regeling.grondslagUrl,
			bekendmakingUrl: regeling.bekendmakingUrl,
			betreft: regeling.betreft,
			kenmerk: regeling.kenmerk,
			thema: regeling.thema,
			vastgesteldDoor: regeling.vastgesteldDoor,
			terugwerkendeKrachtTot:
				regeling.terugwerkendeKrachtTot?.toISOString().slice(0, 10) ?? null,
			bronUrl: regeling.bronUrl,
			bronType: regeling.bronType,
			vervangenDoor: regeling.vervangenDoor
				? {
						naam: regeling.vervangenDoor.naam,
						bronUrl: regeling.vervangenDoor.bronUrl,
					}
				: null,
		};
	},
});
