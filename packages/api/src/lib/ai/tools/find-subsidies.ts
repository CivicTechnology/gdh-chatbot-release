import { tool } from "ai";
import { z } from "zod";
import { searchActive } from "@/domains/subsidieregeling/subsidieregeling.repository.js";
import { createEmbedding } from "@/lib/ai/embeddings.js";
import { DOORVERWIJZING } from "@/lib/constants.js";

/**
 * Vector-similarity drempel (cosine distance) waaronder een regeling als
 * "passend" telt. Alles daarboven valt weg en triggert de noMatch-fallback.
 *
 * Gekalibreerd op de live productieset (121 actieve regelingen uit overheid.nl
 * / CVDR) met text-embedding-3-small. Gemeten top-1 distances:
 *   - legitieme, ook korte/vage, subsidievragen ("groene initiatief", "ik wil
 *     mijn huis verduurzamen", "hulp bij hoge energiekosten"): 0.47 tot 0.52
 *   - duidelijk off-topic vragen (weer, trein, parkeren, recept): 0.54 tot 0.68
 * 0.53 ligt in dat scheidingsvenster: het vangt de hele klasse korte/vage
 * groene- en energievragen die eerder onterecht als noMatch wegvielen, en
 * weert off-topic ruis. De assistent filtert daarna zelf per regeling op
 * relevantie, dus dit is een ondergrens, geen exacte relevantie-beslissing.
 *
 * De vorige lengte-afhankelijke split (0.44 kort / 0.48 lang) was op de
 * 8-rijige seed-set geijkt en gaf korte, vage vragen juist de STRENGSTE
 * drempel, precies verkeerd om. Herijk met een grotere gelabelde set via
 * `bun --filter @gdh-chatbot/api calibrate:threshold` na uitbreiding van de
 * regelingen-set of wisseling van embedding-model.
 */
const RETRIEVAL_THRESHOLD = 0.53;

export const findSubsidies = tool({
	description: `Zoek in de actieve subsidieregelingen van Gemeente Den Haag.
Gebruik dit ALTIJD wanneer de gebruiker een vraag stelt over subsidies — zowel bij korte zoektermen
("subsidies voor isolatie") als bij situatiebeschrijvingen ("ik wil met buren een geveltuin aanleggen").

Geeft een korte lijst terug met titel + samenvatting per regeling. Voor diepere informatie over
één specifieke regeling (exacte voorwaarden, aanvraagprocedure, bedragen) — roep daarna
\`getSubsidieDetail\` aan met de id.

Belangrijke regels:
- Zoekt over ALLE doelgroepen heen (particulier, bedrijf én maatschappelijk). Vraag de gebruiker
  NIET vooraf om zichzelf in te delen — haal gewoon breed op en bepaal zelf welke regelingen
  relevant zijn voor de situatie. Elke regeling komt met een 'doelgroepCluster' terug zodat je
  per regeling kunt zien voor wie die bedoeld is.
- Wanneer 'noMatch' true is: antwoord met "ik heb hier geen passende regeling voor gevonden", geef
  daarna alleen de doorverwijzing en stop. Voeg GEEN eigen tips, stappenplannen of alternatieve
  routes toe. Hetzelfde geldt als er wel regelingen terugkomen maar geen enkele bij de vraag past.
  Doorverwijzing: ${DOORVERWIJZING}
- Wanneer een resultaat een 'vervangenDoor' heeft: noem alleen de opvolger met een eenmalige
  melding "deze regeling is vervangen door [naam]".
- Heeft een regeling een gevulde 'plafonds'-lijst (verschillende bedragen per doelgroep), noem dan
  het bedrag dat past bij de doelgroep van de gebruiker, of som de bedragen per doelgroep kort op.
  Toon nooit zomaar één bedrag als de regeling per doelgroep verschilt.`,
	inputSchema: z.object({
		query: z
			.string()
			.min(2)
			.describe("De vraag, zoekterm of situatieschets van de gebruiker"),
		limit: z.number().int().min(1).max(10).default(5),
	}),
	execute: async ({ query, limit }) => {
		const embedding = await createEmbedding(query);
		const rows = await searchActive({ embedding, limit });

		const relevant = rows.filter(
			(row) => row.distance <= RETRIEVAL_THRESHOLD,
		);
		if (relevant.length === 0) {
			return {
				noMatch: true,
				suggestion: `Meld uitsluitend dat er geen passende regeling is gevonden en geef daarna de doorverwijzing. Geen eigen tips, geen stappenplan, geen alternatieve routes, geen extra bronnenlijst. Doorverwijzing: ${DOORVERWIJZING}`,
			};
		}

		return {
			noMatch: false,
			regelingen: relevant.map((row) => ({
				id: row.id,
				naam: row.naam,
				doel: row.doel,
				doelgroep: row.doelgroepNaam,
				doelgroepCluster: row.doelgroepCluster,
				maxBedragAanvrager: row.maxBedragAanvrager,
				plafonds: row.plafonds,
				vervaldatum: row.vervaldatum?.toISOString().slice(0, 10) ?? null,
				publicatieDatum: row.publicatieDatum?.toISOString().slice(0, 10) ?? null,
				bronGewijzigdOp: row.bronGewijzigdOp?.toISOString().slice(0, 10) ?? null,
				bronGecontroleerdOp:
					row.bronGecontroleerdOp?.toISOString().slice(0, 10) ?? null,
				thema: row.thema,
				bronUrl: row.bronUrl,
				vervangenDoor: row.vervangenDoorId
					? { naam: row.vervangenDoorNaam, bronUrl: row.vervangenDoorBronUrl }
					: null,
				relevantie: Math.round((1 - row.distance) * 100),
			})),
		};
	},
});
