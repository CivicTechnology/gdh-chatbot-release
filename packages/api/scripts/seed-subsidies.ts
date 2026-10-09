/**
 * Seed-script voor 5 voorbeeld-subsidieregelingen + een beheerder-account.
 * Bedoeld voor lokale ontwikkeling en demo's, niet voor productie:
 *   - 3 actieve regelingen verspreid over de doelgroepen
 *   - 1 concept (zichtbaar in beheer, niet in zoektool)
 *   - 1 gearchiveerd-vervangen met opvolger
 *   - 1 actieve regeling met vervaldatum binnen 30 dagen (dashboard-trigger)
 *
 * Bronnen zijn voorbeeld-URLs naar lokaleregelgeving.nl Den Haag; de echte
 * regelingen komen via de CVDR-synchronisatie in het beheerportaal binnen.
 *
 * Aanroepen: SEED_BEHEERDER_PASSWORD=... bun --filter @gdh-chatbot/api seed:subsidies
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { genSaltSync, hashSync } from "bcrypt-ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");

if (!process.env.CI) {
	config({ path: path.join(monorepoRoot, ".env.local") });
}

const { prisma } = await import("../src/lib/db/prisma.js");
const { publishRegeling, archiveAsReplacedBy } = await import("../src/domains/subsidieregeling/subsidieregeling.service.js");

const BEHEERDER_EMAIL = process.env.SEED_BEHEERDER_EMAIL ?? "beheerder@denhaag.nl";
const BEHEERDER_PASSWORD = process.env.SEED_BEHEERDER_PASSWORD;

async function ensureBeheerder(): Promise<string> {
	const existing = await prisma.user.findUnique({ where: { email: BEHEERDER_EMAIL } });
	if (existing) {
		if (existing.role !== "beheerder") {
			await prisma.user.update({
				where: { id: existing.id },
				data: { role: "beheerder" },
			});
		}
		return existing.id;
	}
	if (!BEHEERDER_PASSWORD) {
		throw new Error(
			"SEED_BEHEERDER_PASSWORD ontbreekt. Zet een wachtwoord in de omgeving voordat je seedt.",
		);
	}
	const password = hashSync(BEHEERDER_PASSWORD, genSaltSync(10));
	const user = await prisma.user.create({
		data: {
			email: BEHEERDER_EMAIL,
			password,
			role: "beheerder",
		},
	});
	return user.id;
}

const NOW = new Date("2026-05-22T12:00:00Z");

function plusDays(days: number): Date {
	return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

type SeedRegeling = {
	naam: string;
	doel: string;
	voorwaarden: string;
	aanvraagprocedure: string;
	bronUrl: string;
	doelgroepNaam: string;
	doelgroepCluster: "PARTICULIER" | "BEDRIJF" | "MAATSCHAPPELIJK";
	vervaldatum: Date;
	maxBedragAanvrager: number | null;
	totaalSubsidiePlafond: number | null;
};

const REGELINGEN: SeedRegeling[] = [
	{
		naam: "Buurtbudget 2026",
		doel:
			"Stimuleren van kleinschalige initiatieven die de leefbaarheid en sociale samenhang in een Haagse buurt versterken.",
		voorwaarden:
			"Het initiatief draagt aantoonbaar bij aan de leefbaarheid van de buurt. Aanvrager is een vrijwilligersorganisatie, stichting of buurtinitiatief gevestigd in Den Haag. Cofinanciering of bijdrage in natura is gewenst.",
		aanvraagprocedure:
			"Dien een aanvraag in via het loket Stadmakers met een korte projectbeschrijving, begroting en planning. Beslistermijn is acht weken.",
		bronUrl: "https://lokaleregelgeving.overheid.nl/CVDR/700001",
		doelgroepNaam: "Vrijwilligersorganisatie of buurtinitiatief",
		doelgroepCluster: "MAATSCHAPPELIJK",
		vervaldatum: new Date("2026-12-31T23:59:59Z"),
		maxBedragAanvrager: 5000,
		totaalSubsidiePlafond: 250000,
	},
	{
		naam: "Energiebespaarvoucher Den Haag",
		doel:
			"Bewoners van een eigen woning helpen om kleine energiebesparende maatregelen te nemen, zoals tochtstrips, radiatorfolie of een waterbesparende douchekop.",
		voorwaarden:
			"De aanvrager is woningeigenaar in Den Haag en de woning is hoofdverblijf. Per adres kan eenmalig een voucher worden aangevraagd.",
		aanvraagprocedure:
			"Vul het online formulier in op denhaag.nl/energiebespaarvoucher. De voucher wordt binnen tien werkdagen per e-mail verstrekt.",
		bronUrl: "https://lokaleregelgeving.overheid.nl/CVDR/700002",
		doelgroepNaam: "Woningbezitter",
		doelgroepCluster: "PARTICULIER",
		vervaldatum: plusDays(20),
		maxBedragAanvrager: 70,
		totaalSubsidiePlafond: 350000,
	},
	{
		naam: "Verduurzamingssubsidie MKB Den Haag 2026",
		doel:
			"Haagse MKB-ondernemers ondersteunen bij investeringen in energiebesparing, zonnepanelen en circulaire productieprocessen.",
		voorwaarden:
			"De onderneming is ingeschreven in Den Haag en heeft minder dan 250 medewerkers. Investering moet gericht zijn op CO2-reductie en aanvrager dient een onafhankelijk advies aan te leveren.",
		aanvraagprocedure:
			"Stuur een complete aanvraag (advies, offerte en investeringsplan) naar mkb-verduurzaming@denhaag.nl. Beoordeling binnen zes weken.",
		bronUrl: "https://lokaleregelgeving.overheid.nl/CVDR/700003",
		doelgroepNaam: "Ondernemer MKB",
		doelgroepCluster: "BEDRIJF",
		vervaldatum: new Date("2027-03-01T23:59:59Z"),
		maxBedragAanvrager: 15000,
		totaalSubsidiePlafond: 1500000,
	},
];

async function seed() {
	const beheerderId = await ensureBeheerder();
	console.log(`Beheerder ${BEHEERDER_EMAIL} aanwezig (id ${beheerderId})`);

	// Schoon de subsidieregelingen-tabel zodat de seed idempotent is.
	await prisma.subsidieRegelingAuditEvent.deleteMany({});
	await prisma.subsidieRegelingVersie.deleteMany({});
	await prisma.subsidieRegeling.deleteMany({});

	// 1, 2, 3: actieve regelingen.
	const aanwezig: Array<{ id: string; naam: string }> = [];
	for (const r of REGELINGEN) {
		const created = await prisma.subsidieRegeling.create({
			data: { ...r, status: "CONCEPT", createdByUserId: beheerderId },
		});
		try {
			await publishRegeling(created.id, beheerderId);
			console.log(`✔ Gepubliceerd (met embedding): ${r.naam}`);
		} catch (error) {
			// Bij ontbrekende OPENAI_API_KEY faalt de embedding-stap. Voor het UI-demo
			// forceren we de regeling toch op ACTIEF zonder embedding, zodat het
			// beheerportaal demoneerbaar is. De AI-zoektool vindt de regeling pas
			// nadat de seed opnieuw is gedraaid met een geldige API-key.
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`! ${r.naam}: embedding faalde (${message})`);
			await prisma.subsidieRegeling.update({
				where: { id: created.id },
				data: { status: "ACTIEF" },
			});
			await prisma.subsidieRegelingAuditEvent.create({
				data: {
					regelingId: created.id,
					userId: beheerderId,
					actie: "PUBLISH",
					message: "Geforceerd op ACTIEF zonder embedding (seed zonder API-key)",
				},
			});
			console.log(`✔ Geforceerd op ACTIEF zonder embedding: ${r.naam}`);
		}
		aanwezig.push({ id: created.id, naam: r.naam });
	}

	// 4: een concept-regeling.
	await prisma.subsidieRegeling.create({
		data: {
			naam: "Subsidie Zonnepanelen VvE 2026 (concept)",
			doel:
				"Verenigingen van Eigenaren ondersteunen bij gezamenlijke aanschaf en installatie van zonnepanelen op het dak.",
			voorwaarden: "",
			aanvraagprocedure: "",
			bronUrl: "",
			bronType: "LOKALEREGELGEVING",
			doelgroepNaam: "Vereniging van Eigenaren",
			doelgroepCluster: "MAATSCHAPPELIJK",
			vervaldatum: null,
			status: "CONCEPT",
			createdByUserId: beheerderId,
		},
	});
	console.log("✔ Concept regeling 'Zonnepanelen VvE 2026' aangemaakt");

	// 5: een gearchiveerde regeling die is vervangen door regeling 1 (Buurtbudget).
	//    Eerst als CONCEPT aanmaken, dan publiceren (krijgt embedding), dan
	//    archiveAsReplacedBy zodat status -> GEARCHIVEERD_VERVANGEN gaat.
	const oudeRegelingConcept = await prisma.subsidieRegeling.create({
		data: {
			naam: "Buurtfonds Den Haag 2024 (oud)",
			doel:
				"Voorganger van het huidige Buurtbudget. Stimuleerde initiatieven die bijdroegen aan de leefbaarheid.",
			voorwaarden: "Aanvrager is een vrijwilligersorganisatie of buurtinitiatief in Den Haag.",
			aanvraagprocedure: "Schriftelijk via het loket Stadmakers met projectbeschrijving en begroting.",
			bronUrl: "https://lokaleregelgeving.overheid.nl/CVDR/600099",
			bronType: "LOKALEREGELGEVING",
			doelgroepNaam: "Vrijwilligersorganisatie of buurtinitiatief",
			doelgroepCluster: "MAATSCHAPPELIJK",
			vervaldatum: new Date("2025-12-31T23:59:59Z"),
			status: "CONCEPT",
			createdByUserId: beheerderId,
		},
	});
	try {
		await publishRegeling(oudeRegelingConcept.id, beheerderId);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`! Buurtfonds 2024 (oud): publish faalde (${message}); forceer ACTIEF`);
		await prisma.subsidieRegeling.update({
			where: { id: oudeRegelingConcept.id },
			data: { status: "ACTIEF" },
		});
	}
	const opvolger = aanwezig.find((r) => r.naam === "Buurtbudget 2026");
	if (opvolger) {
		await archiveAsReplacedBy(oudeRegelingConcept.id, opvolger.id, beheerderId);
		console.log("✔ Gearchiveerd via archiveAsReplacedBy: 'Buurtfonds Den Haag 2024 (oud)' -> Buurtbudget 2026");
	}

	console.log("\n=== Seed Compleet ===");
	console.log(`Beheerder login: ${BEHEERDER_EMAIL} / ${BEHEERDER_PASSWORD}`);
}

seed()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Seed gefaald:", error);
		process.exit(1);
	});
