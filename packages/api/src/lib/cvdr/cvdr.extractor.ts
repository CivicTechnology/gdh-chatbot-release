import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const EXTRACTION_MODEL = "gpt-4.1-mini";

/**
 * Coerce array-of-strings naar één string met newlines — gpt-4.1-mini geeft
 * `voorwaarden` soms als JSON-array terug ondanks instructie. Liever
 * normaliseren dan harde validatie-fout.
 */
const stringOrJoinedArray = z
	.union([z.string(), z.array(z.string())])
	.transform((value) => (Array.isArray(value) ? value.join("\n") : value));

const numberOrNull = z
	.union([z.number(), z.null(), z.string()])
	.transform((value) => {
		if (value === null || value === "") return null;
		const num = typeof value === "number" ? value : Number.parseFloat(value);
		return Number.isFinite(num) ? num : null;
	});

const ExtractedFieldsSchema = z.object({
	doel: stringOrJoinedArray,
	voorwaarden: stringOrJoinedArray,
	aanvraagprocedure: stringOrJoinedArray,
	doelgroepNaam: z.string(),
	doelgroepCluster: z.enum(["PARTICULIER", "BEDRIJF", "MAATSCHAPPELIJK"]),
	maxBedragAanvrager: numberOrNull.optional().default(null),
	totaalSubsidiePlafond: numberOrNull.optional().default(null),
	// Staffeling per doelgroep: alleen gevuld als de regeling verschillende
	// bedragen per doelgroep noemt. Anders leeg ([]) en gelden de losse bedragen.
	plafonds: z
		.array(
			z.object({
				doelgroepCluster: z.enum(["PARTICULIER", "BEDRIJF", "MAATSCHAPPELIJK"]),
				doelgroepNaam: z.string().optional().default(""),
				maxBedragAanvrager: numberOrNull.optional().default(null),
				totaalSubsidiePlafond: numberOrNull.optional().default(null),
				omschrijving: z.string().optional().default(""),
			}),
		)
		.optional()
		.default([]),
});

export type CvdrExtractedFields = z.infer<typeof ExtractedFieldsSchema>;

const xmlTextParser = new XMLParser({
	ignoreAttributes: true,
	removeNSPrefix: true,
	parseTagValue: false,
	textNodeName: "#text",
});

/**
 * Strip CVDR XML naar leesbare platte tekst zodat de LLM minimal tokens verbruikt.
 * Verwijdert XML-tags, behoudt artikel-/lid-structuur impliciet via newlines.
 */
function xmlToPlainText(xml: string): string {
	const parsed = xmlTextParser.parse(xml);
	return collectText(parsed).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function collectText(node: unknown): string {
	if (node === null || node === undefined) return "";
	if (typeof node === "string") return `${node} `;
	if (typeof node === "number" || typeof node === "boolean") return `${node} `;
	if (Array.isArray(node)) {
		return node.map(collectText).join("");
	}
	if (typeof node === "object") {
		const parts: string[] = [];
		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			if (key.startsWith("@_")) continue;
			parts.push(collectText(value));
			parts.push("\n");
		}
		return parts.join("");
	}
	return "";
}

/**
 * Extract gestructureerde subsidieregeling-velden uit CVDR-XML.
 *
 * We gebruiken `generateText` + handmatige JSON-parse ipv `generateObject`
 * omdat de AI-SDK's strict-output decoder onder concurrency intermitterende
 * "response did not match schema"-fouten geeft die niets met het model of
 * de content te maken hebben. `generateText` met een duidelijke
 * JSON-instructie + tolerante zod-schema (arrays worden gejoind naar strings,
 * bedrag-strings worden gecoerced) is robuust onder hoge parallelle load.
 */
export async function extractFieldsFromXml(
	xml: string,
	options: { apiKey?: string; titel?: string; signal?: AbortSignal } = {},
): Promise<CvdrExtractedFields> {
	const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY is niet gezet");

	const openai = createOpenAI({ apiKey });
	const plainText = xmlToPlainText(xml).slice(0, 24_000);

	const systemPrompt = `Je extraheert kerngegevens uit Nederlandse gemeentelijke subsidieregelingen voor een chatbot. Geef ALLEEN geldige JSON terug — geen markdown, geen toelichting.

Schrijfstijl:
- Klantvriendelijk, helder Nederlands. Geen juridisch jargon.
- "U" niet "je". Vermijd jargon zoals "aanvrager"; gebruik "u" of de doelgroep.
- Concrete getallen overnemen waar genoemd; nooit verzinnen.

Doelgroep-cluster:
- PARTICULIER: natuurlijk persoon, bewoner, huiseigenaar, huurder.
- BEDRIJF: onderneming, MKB, ondernemer, VvE met commercieel oogmerk.
- MAATSCHAPPELIJK: stichting, vereniging, buurtinitiatief, school, sportvereniging.
Kies de meest dominante cluster.

Bedragen: alleen invullen als de tekst expliciet een euro-bedrag noemt; anders null. Geen schattingen.

Plafonds (staffeling per doelgroep): noemt de regeling VERSCHILLENDE maxbedragen of subsidieplafonds voor verschillende doelgroepen (bv. particulier max 750 euro, stichting/organisatie max 5000 euro), zet die dan elk als los item in "plafonds" met de bijbehorende doelgroepCluster, doelgroepNaam en het bedrag. Geldt er maar één bedrag voor iedereen, laat "plafonds" dan leeg ([]) en gebruik alleen maxBedragAanvrager/totaalSubsidiePlafond.`;

	const userPrompt = `Extract de volgende velden als JSON:
{
  "doel": string (1-2 zinnen — voor wie en waarvoor),
  "voorwaarden": string (concrete voorwaarden in eigen woorden; gebruik \\n voor regelovergangen, NIET een array),
  "aanvraagprocedure": string (hoe u aanvraagt; gebruik \\n voor regelovergangen, NIET een array),
  "doelgroepNaam": string (korte aanduiding doelgroep),
  "doelgroepCluster": "PARTICULIER" | "BEDRIJF" | "MAATSCHAPPELIJK",
  "maxBedragAanvrager": number | null,
  "totaalSubsidiePlafond": number | null,
  "plafonds": [{ "doelgroepCluster": "PARTICULIER" | "BEDRIJF" | "MAATSCHAPPELIJK", "doelgroepNaam": string, "maxBedragAanvrager": number | null, "totaalSubsidiePlafond": number | null, "omschrijving": string }]
}

Subsidieregeling${options.titel ? ` "${options.titel}"` : ""}:

${plainText}`;

	const result = await generateText({
		model: openai.languageModel(EXTRACTION_MODEL),
		system: systemPrompt,
		prompt: userPrompt,
		// 6000 tokens dekt ook lange regelingen met uitgebreide voorwaarden +
		// aanvraagprocedure-tekst. 4000 was net te krap voor zo'n 2-3% van de
		// records (truncatie → onafgesloten string → parse-fail).
		maxOutputTokens: 6000,
		abortSignal: options.signal,
	});

	const parsed = parseJsonResponse(result.text);
	return ExtractedFieldsSchema.parse(parsed);
}

/**
 * Parse een JSON-response die in markdown-fences kan zitten of voorafgegaan
 * door uitleg-tekst. Vindt het eerste `{` en laatste `}` en parseert de slice
 * daartussen — robuust tegen kleine afwijkingen in modeloutput.
 */
function parseJsonResponse(text: string): unknown {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new Error(`Geen JSON-object gevonden in response: ${text.slice(0, 200)}`);
	}
	const jsonSlice = text.slice(start, end + 1);
	try {
		return JSON.parse(jsonSlice);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`JSON-parse faalde: ${message}. Tekst: ${jsonSlice.slice(0, 200)}`);
	}
}

/** Download een CVDR XML van repository.officiele-overheidspublicaties.nl. */
export async function fetchCvdrXml(
	xmlUrl: string,
	signal?: AbortSignal,
): Promise<string> {
	const signals: AbortSignal[] = [AbortSignal.timeout(30_000)];
	if (signal) signals.push(signal);
	const response = await fetch(xmlUrl, {
		signal: AbortSignal.any(signals),
		headers: { Accept: "application/xml" },
	});
	if (!response.ok) {
		throw new Error(`CVDR XML fetch faalde: ${response.status} ${xmlUrl}`);
	}
	return response.text();
}
