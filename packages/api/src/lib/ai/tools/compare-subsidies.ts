import { tool } from "ai";
import { z } from "zod";
import { findById } from "@/domains/subsidieregeling/subsidieregeling.repository.js";

export type ComparedRegeling = {
	id: string;
	naam: string;
	doel: string;
	doelgroepNaam: string;
	doelgroepCluster: string;
	maxBedragAanvrager: string | null;
	totaalSubsidiePlafond: string | null;
	plafonds: unknown;
	looptijdEind: string | null;
	vervaldatum: string | null;
	publicatieDatum: string | null;
	bronUrl: string;
	status: string;
	vervangenDoor: { naam: string; bronUrl: string } | null;
};

export type CompareOutput = {
	regelingen: ComparedRegeling[];
	gedropt: Array<{ id: string; reden: string }>;
};

export const compareSubsidies = tool({
	description: `Toon een side-by-side vergelijking van 2 tot 4 subsidieregelingen.

Gebruik dit wanneer de gebruiker regelingen wil vergelijken of een keuze wil maken
("vergelijk X en Y", "wat is het verschil tussen deze regelingen", "welke is het meest geschikt"),
en er minstens 2 regelingen uit eerdere \`findSubsidies\`-resultaten bekend zijn.

Geef de id's mee zoals teruggegeven door findSubsidies — geen URL's, geen namen.`,
	inputSchema: z.object({
		regelingIds: z
			.array(z.string().uuid())
			.min(2)
			.max(4)
			.describe("2-4 regeling-id's uit findSubsidies."),
	}),
	execute: async ({ regelingIds }): Promise<CompareOutput> => {
		const loaded = await Promise.all(
			regelingIds.map(async (id) => ({ id, regeling: await findById(id) })),
		);

		const regelingen: ComparedRegeling[] = [];
		const gedropt: Array<{ id: string; reden: string }> = [];

		for (const { id, regeling } of loaded) {
			if (!regeling) {
				gedropt.push({ id, reden: "niet gevonden" });
				continue;
			}
			const isAvailable =
				regeling.status === "ACTIEF" ||
				regeling.status === "GEARCHIVEERD_VERVANGEN";
			if (!isAvailable) {
				gedropt.push({ id, reden: "niet (meer) actief" });
				continue;
			}
			regelingen.push({
				id: regeling.id,
				naam: regeling.naam,
				doel: regeling.doel,
				doelgroepNaam: regeling.doelgroepNaam,
				doelgroepCluster: regeling.doelgroepCluster,
				maxBedragAanvrager: regeling.maxBedragAanvrager
					? regeling.maxBedragAanvrager.toString()
					: null,
				totaalSubsidiePlafond: regeling.totaalSubsidiePlafond
					? regeling.totaalSubsidiePlafond.toString()
					: null,
				plafonds: regeling.plafonds ?? null,
				looptijdEind: regeling.looptijdEind?.toISOString().slice(0, 10) ?? null,
				vervaldatum: regeling.vervaldatum?.toISOString().slice(0, 10) ?? null,
				publicatieDatum:
					regeling.publicatieDatum?.toISOString().slice(0, 10) ?? null,
				bronUrl: regeling.bronUrl,
				status: regeling.status,
				vervangenDoor: regeling.vervangenDoor
					? {
							naam: regeling.vervangenDoor.naam,
							bronUrl: regeling.vervangenDoor.bronUrl,
						}
					: null,
			});
		}

		return { regelingen, gedropt };
	},

	toModelOutput: (output) => {
		const o = output as CompareOutput;
		const value = JSON.stringify({
			vergeleken: o.regelingen.map((r) => r.naam),
			gedropt: o.gedropt.length,
			rendered: "comparison-ranked-cards",
		});
		return { type: "text" as const, value };
	},
});
