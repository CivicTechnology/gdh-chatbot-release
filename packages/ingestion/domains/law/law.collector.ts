/**
 * Law Collector
 * SRU 2.0 client for BWB (Basis Wetten Bestand) collection
 * Interacts with overheid.nl API to fetch legislation metadata and XML
 */

import {
	type XmlNode,
	findChild,
	getChildrenByName,
	getTextContent,
	parseXml,
} from "../../lib/xml.js";
import type { BwbManifest, BwbManifestVersion, BwbRecordMetadata } from "./law.types.js";

const SRU_BASE_URL = "http://zoekservice.overheid.nl/sru/Search";
const BWB_COLLECTION = "BWB";

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
	let lastError: Error | null = null;

	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			return await response.text();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (i < retries - 1) {
				await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
			}
		}
	}

	throw lastError ?? new Error("Failed to fetch");
}

function findNestedElement(node: XmlNode, ...names: string[]): XmlNode | undefined {
	let current: XmlNode | undefined = node;
	for (const name of names) {
		if (!current) return;
		current = findChild(current, name);
	}
	return current;
}

export async function fetchBwbRecordById(bwbId: string): Promise<BwbRecordMetadata | null> {
	const query = encodeURIComponent(`dcterms.identifier==${bwbId}`);
	const url = `${SRU_BASE_URL}?operation=searchRetrieve&version=1.2&x-connection=${BWB_COLLECTION}&query=${query}&maximumRecords=1`;

	const xml = await fetchWithRetry(url);
	const root = parseXml(xml);

	const recordsContainer = findChild(root, "records");
	if (!recordsContainer) {
		return null;
	}

	const records = getChildrenByName(recordsContainer, "record");
	if (records.length === 0) {
		return null;
	}

	const recordData = findChild(records[0], "recordData");
	if (!recordData) {
		return null;
	}

	const gzd = findChild(recordData, "gzd");
	if (!gzd) {
		return null;
	}

	const originalData = findChild(gzd, "originalData");
	const enrichedData = findChild(gzd, "enrichedData");

	const meta = findNestedElement(originalData ?? gzd, "meta");
	const owmskern = findChild(meta ?? originalData ?? gzd, "owmskern");

	const identifier =
		getTextContent(findChild(owmskern ?? gzd, "identifier") ?? gzd).trim() || bwbId;
	const title = getTextContent(findChild(owmskern ?? gzd, "title") ?? gzd).trim();
	const modified = getTextContent(findChild(owmskern ?? gzd, "modified") ?? gzd).trim();

	let preferredUrl = "";
	let toestandUrl: string | null = null;
	let manifestUrl: string | null = null;
	let wtiUrl: string | null = null;

	if (enrichedData) {
		toestandUrl =
			getTextContent(findChild(enrichedData, "locatie_toestand") ?? enrichedData).trim() ||
			null;
		manifestUrl =
			getTextContent(findChild(enrichedData, "locatie_manifest") ?? enrichedData).trim() ||
			null;
		wtiUrl =
			getTextContent(findChild(enrichedData, "locatie_wti") ?? enrichedData).trim() || null;
	}

	const bwbipm = findChild(meta ?? originalData ?? gzd, "bwbipm");
	if (bwbipm) {
		const toestand = getTextContent(findChild(bwbipm, "toestand") ?? bwbipm).trim();
		if (toestand) {
			preferredUrl = toestand.replace(
				"http://wetten.overheid.nl/id/",
				"https://wetten.overheid.nl/",
			);
		}
	}

	return {
		identifier,
		title,
		modified,
		preferredUrl,
		toestandUrl,
		manifestUrl,
		wtiUrl,
		items: [],
	};
}

export async function fetchBwbManifest(manifestUrl: string, bwbId: string): Promise<BwbManifest> {
	const xml = await fetchWithRetry(manifestUrl);
	const root = parseXml(xml);

	const versions: BwbManifestVersion[] = [];

	const expressions = getChildrenByName(root, "expression");
	for (const expr of expressions) {
		const exprLabel = expr.attributes.label || "";

		const manifestations = getChildrenByName(expr, "manifestation");
		const xmlManifestation = manifestations.find((m) => m.attributes.label === "xml");
		if (!xmlManifestation) continue;

		const item = findChild(xmlManifestation, "item");
		if (!item) continue;

		const itemLabel = item.attributes.label || "";
		if (!itemLabel.endsWith(".xml")) continue;

		const match = exprLabel.match(/^(\d{4}-\d{2}-\d{2})_/);
		const versionDate = match ? match[1] : "";

		const downloadUrl = `https://repository.officiele-overheidspublicaties.nl/bwb/${bwbId}/${exprLabel}/xml/${itemLabel}`;

		versions.push({
			versionDate,
			itemPath: `${exprLabel}/xml/${itemLabel}`,
			downloadUrl,
		});
	}

	versions.sort((a, b) => b.versionDate.localeCompare(a.versionDate));

	return {
		bwbId,
		versions,
		latestVersion: versions[0] ?? null,
	};
}

export async function downloadItem(url: string): Promise<string> {
	return fetchWithRetry(url);
}
