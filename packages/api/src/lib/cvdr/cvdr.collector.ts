import { XMLParser } from "fast-xml-parser";
import type { CvdrCollectorOptions, CvdrRegeling } from "./cvdr.types.js";

const SRU_ENDPOINT = "https://zoekservice.overheid.nl/sru/Search";
const DEFAULT_GEMEENTE = "'s-Gravenhage";
const DEFAULT_TITLE_TERM = "subsidieregeling";
const DEFAULT_PAGE_SIZE = 100;

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	textNodeName: "#text",
	removeNSPrefix: true,
	parseTagValue: false,
	parseAttributeValue: false,
});

type SruRecord = {
	recordData?: {
		gzd?: {
			originalData?: {
				meta?: {
					owmskern?: Record<string, unknown>;
					owmsmantel?: Record<string, unknown>;
					cvdripm?: Record<string, unknown>;
				};
			};
			enrichedData?: Record<string, unknown>;
		};
	};
};

type SruResponse = {
	searchRetrieveResponse?: {
		numberOfRecords?: string;
		records?: { record?: SruRecord | SruRecord[] };
	};
};

/**
 * Fetch alle Den Haag subsidieregelingen uit KOOP SRU (CVDR-database).
 *
 * Geeft alle versies terug zoals SRU ze publiceert; deduplicatie naar werk-id
 * gebeurt in {@link dedupeToLatestVersion}.
 */
export async function fetchAllRegelingen(
	options: CvdrCollectorOptions & { signal?: AbortSignal } = {},
): Promise<CvdrRegeling[]> {
	const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
	const gemeente = options.gemeente ?? DEFAULT_GEMEENTE;
	const titleTerm = options.titleTerm ?? DEFAULT_TITLE_TERM;

	const queryParts = [
		`gemeente="${gemeente}"`,
		`dcterms.title any "${titleTerm}"`,
	];
	if (options.modifiedSince) {
		queryParts.push(`dcterms.modified >= "${options.modifiedSince}"`);
	}
	const cqlQuery = queryParts.join(" AND ");

	const all: CvdrRegeling[] = [];
	let startRecord = 1;

	while (true) {
		const url = buildSruUrl(cqlQuery, startRecord, pageSize);
		const signals: AbortSignal[] = [AbortSignal.timeout(60_000)];
		if (options.signal) signals.push(options.signal);
		const response = await fetch(url, {
			signal: AbortSignal.any(signals),
			headers: { Accept: "application/xml" },
		});
		if (!response.ok) {
			throw new Error(`SRU fetch failed: ${response.status} ${response.statusText}`);
		}
		const xml = await response.text();
		const parsed = xmlParser.parse(xml) as SruResponse;
		const responseBody = parsed.searchRetrieveResponse;
		const total = Number.parseInt(responseBody?.numberOfRecords ?? "0", 10);
		if (total === 0) break;

		const rawRecords = responseBody?.records?.record;
		const records: SruRecord[] = Array.isArray(rawRecords)
			? rawRecords
			: rawRecords
				? [rawRecords]
				: [];

		for (const record of records) {
			const parsedRecord = parseRecord(record);
			if (parsedRecord) all.push(parsedRecord);
		}

		if (records.length === 0) break;
		startRecord += records.length;
		if (startRecord > total) break;
	}

	return all;
}

/**
 * Dedup naar werk-niveau: voor elke `werkId` blijft de versie met het hoogste
 * `versienummer` over. CVDR markeert het werk-id stabiel; nieuwe versies
 * krijgen alleen een hoger suffix.
 */
export function dedupeToLatestVersion(records: CvdrRegeling[]): CvdrRegeling[] {
	const byWerk = new Map<string, CvdrRegeling>();
	for (const record of records) {
		const existing = byWerk.get(record.werkId);
		if (!existing || record.versienummer > existing.versienummer) {
			byWerk.set(record.werkId, record);
		}
	}
	return [...byWerk.values()];
}

/**
 * Filter op regelingen die op `peilDatum` (ISO-datum) van kracht zijn.
 *
 * Geldig = inwerkingtreding <= peilDatum EN (geen uitwerking OR uitwerking > peilDatum).
 * Records zonder inwerkingtredingDatum worden conservatief uitgesloten.
 */
export function filterActiveOn(
	records: CvdrRegeling[],
	peilDatum: string,
): CvdrRegeling[] {
	return records.filter((record) => {
		if (!record.inwerkingtredingDatum) return false;
		if (record.inwerkingtredingDatum > peilDatum) return false;
		if (record.uitwerkingtredingDatum && record.uitwerkingtredingDatum <= peilDatum) {
			return false;
		}
		return true;
	});
}

function buildSruUrl(query: string, startRecord: number, maximumRecords: number): string {
	const params = new URLSearchParams({
		"x-connection": "cvdr",
		operation: "searchRetrieve",
		version: "2.0",
		query,
		startRecord: String(startRecord),
		maximumRecords: String(maximumRecords),
	});
	return `${SRU_ENDPOINT}?${params.toString()}`;
}

function parseRecord(record: SruRecord): CvdrRegeling | null {
	const meta = record.recordData?.gzd?.originalData?.meta;
	const enriched = record.recordData?.gzd?.enrichedData;
	if (!meta) return null;

	const owmskern = meta.owmskern ?? {};
	const owmsmantel = meta.owmsmantel ?? {};
	const cvdripm = meta.cvdripm ?? {};

	const versieId = stringField(owmskern, "identifier");
	const titel = stringField(owmskern, "title");
	const creator = stringField(owmskern, "creator");
	if (!versieId || !titel || !creator) return null;

	const { werkId, versienummer } = splitVersieId(versieId);
	if (!werkId) return null;

	const htmlUrl = stringField(enriched ?? {}, "preferred_url") ?? "";
	const workUrl =
		stringField(enriched ?? {}, "preferred_work_url") ??
		`https://lokaleregelgeving.overheid.nl/${werkId}`;
	const xmlUrl = stringField(enriched ?? {}, "publicatieurl_xml") ?? "";

	return {
		werkId,
		versieId,
		versienummer,
		titel,
		creator,
		ratifier: stringField(owmsmantel, "isRatifiedBy"),
		subject: stringField(owmsmantel, "subject"),
		issuedDate: stringField(owmsmantel, "issued"),
		modifiedDate: stringField(owmskern, "modified"),
		inwerkingtredingDatum: stringField(cvdripm, "inwerkingtredingDatum"),
		uitwerkingtredingDatum: stringField(cvdripm, "uitwerkingtredingDatum"),
		opvolgerVan: stringField(cvdripm, "opvolgerVan"),
		grondslag: stringField(owmsmantel, "source"),
		grondslagUrl: attrField(owmsmantel, "source", "resourceIdentifier"),
		bekendmakingKenmerk: stringField(owmsmantel, "isFormatOf"),
		bekendmakingUrl: attrField(owmsmantel, "isFormatOf", "resourceIdentifier"),
		betreft: stringField(cvdripm, "betreft"),
		kenmerk: stringField(cvdripm, "kenmerk"),
		terugwerkendekrachtDatum: stringField(cvdripm, "terugwerkendekrachtDatum"),
		externeBijlage: stringField(cvdripm, "externeBijlage"),
		xmlUrl,
		htmlUrl,
		workUrl,
	};
}

function stringField(obj: Record<string, unknown>, key: string): string | null {
	// Meervoudige elementen (bv. meerdere dcterms.source-grondslagen) komen uit
	// de XML-parser als array; we nemen dan de eerste.
	const value = Array.isArray(obj[key]) ? obj[key][0] : obj[key];
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (value && typeof value === "object") {
		const text = (value as Record<string, unknown>)["#text"];
		if (typeof text === "string") {
			const trimmed = text.trim();
			return trimmed.length > 0 ? trimmed : null;
		}
	}
	return null;
}

/** Lees een XML-attribuut (bv. resourceIdentifier) van een element. */
function attrField(
	obj: Record<string, unknown>,
	key: string,
	attr: string,
): string | null {
	const value = Array.isArray(obj[key]) ? obj[key][0] : obj[key];
	if (value && typeof value === "object") {
		const raw = (value as Record<string, unknown>)[`@_${attr}`];
		if (typeof raw === "string") {
			const trimmed = raw.trim();
			return trimmed.length > 0 ? trimmed : null;
		}
	}
	return null;
}

function splitVersieId(versieId: string): { werkId: string; versienummer: number } {
	const match = versieId.match(/^(.+?)_(\d+)$/);
	if (!match) return { werkId: versieId, versienummer: 1 };
	return { werkId: match[1], versienummer: Number.parseInt(match[2], 10) };
}
