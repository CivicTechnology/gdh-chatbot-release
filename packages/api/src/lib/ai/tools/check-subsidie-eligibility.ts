import { tool } from "ai";
import { z } from "zod";
import { findById } from "@/domains/subsidieregeling/subsidieregeling.repository.js";
import { DOORVERWIJZING } from "@/lib/constants.js";

export type EligibilityQuestion = {
	id: string;
	vraag: string;
	voorwaarde: string;
};

export type EligibilityOutput =
	| { notFound: true; suggestion: string }
	| { notFound: false; inactive: true; status: string; message: string }
	| {
			notFound: false;
			inactive: false;
			regeling: {
				id: string;
				naam: string;
				maxBedragAanvrager: string | null;
				vervaldatum: string | null;
				bronUrl: string;
				vervangenDoor: { naam: string; bronUrl: string } | null;
			};
			questions: EligibilityQuestion[];
	  };

export const checkSubsidieEligibility = tool({
	description: `Toon een interactieve "kom ik in aanmerking?"-beslisboom voor ÉÉN specifieke subsidieregeling.

Gebruik dit wanneer de gebruiker wil weten of hij/zij in aanmerking komt of aan de voorwaarden voldoet
voor een regeling die eerder uit \`findSubsidies\` kwam ("kom ik in aanmerking voor X?", "voldoe ik aan
de voorwaarden van X?"). Niet gebruiken voor eerste-orde zoekvragen (gebruik dan \`findSubsidies\`).

Je formuleert zelf 2 tot 5 korte ja/nee-vragen in spreektaal, STRIKT afgeleid uit de voorwaarden van
de regeling (gebruik desnoods eerst \`getSubsidieDetail\` om de exacte voorwaarden op te halen). Verzin
geen criteria die niet in de voorwaarden staan. Koppel elke vraag aan de bron-voorwaarde-tekst.

De gebruiker doorloopt de vragen zelf in de gerenderde widget; jij hoeft daarna geen tekstuele
vragenlijst meer te geven.`,
	inputSchema: z.object({
		regelingId: z
			.string()
			.uuid()
			.describe("De id zoals teruggegeven door findSubsidies. Geen URL, geen naam."),
		questions: z
			.array(
				z.object({
					id: z.string().describe("Stabiele id voor deze vraag, bv. 'q1'."),
					vraag: z
						.string()
						.describe("Korte ja/nee-vraag in spreektaal, bv. 'Is je woning ouder dan 1992?'"),
					voorwaarde: z
						.string()
						.describe("De bron-voorwaarde waar deze vraag op gebaseerd is."),
				}),
			)
			.min(1)
			.max(8)
			.describe("2-5 ja/nee-vragen, strikt afgeleid uit de voorwaarden van de regeling."),
	}),
	execute: async ({ regelingId, questions }): Promise<EligibilityOutput> => {
		const regeling = await findById(regelingId);
		if (!regeling) {
			return {
				notFound: true,
				suggestion: `Meld dat de regeling niet gevonden is en geef daarna de doorverwijzing. Verzin geen criteria en geen vervangende regeling. Doorverwijzing: ${DOORVERWIJZING}`,
			};
		}

		const isAvailable =
			regeling.status === "ACTIEF" || regeling.status === "GEARCHIVEERD_VERVANGEN";
		if (!isAvailable) {
			return {
				notFound: false,
				inactive: true,
				status: regeling.status,
				message:
					"Deze regeling is niet (meer) actief. Vertel dat aan de gebruiker en verwijs naar de actieve regelingen.",
			};
		}

		return {
			notFound: false,
			inactive: false,
			regeling: {
				id: regeling.id,
				naam: regeling.naam,
				maxBedragAanvrager: regeling.maxBedragAanvrager
					? regeling.maxBedragAanvrager.toString()
					: null,
				vervaldatum: regeling.vervaldatum?.toISOString().slice(0, 10) ?? null,
				bronUrl: regeling.bronUrl,
				vervangenDoor: regeling.vervangenDoor
					? { naam: regeling.vervangenDoor.naam, bronUrl: regeling.vervangenDoor.bronUrl }
					: null,
			},
			questions,
		};
	},

	toModelOutput: (output) => {
		const o = output as EligibilityOutput;
		if (o.notFound) {
			return { type: "text" as const, value: "Regeling niet gevonden." };
		}
		if (o.inactive) {
			return { type: "text" as const, value: `Regeling niet (meer) actief (status ${o.status}).` };
		}
		const value = JSON.stringify({
			naam: o.regeling.naam,
			aantalVragen: o.questions.length,
			rendered: "eligibility-stepper",
		});
		return { type: "text" as const, value };
	},
});
