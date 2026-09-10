import type { GeoJSONCollection } from "./ckan.transformer.js";
import type { CkanConfig, CkanPackage, CkanResource, DatasetInfo } from "./ckan.types.js";

// OpenDataSoft Explore API v2.1 dataset record (subset we use)
type OdsDatasetMetas = {
	title?: string;
	description?: string;
	modified?: string;
	data_processed?: string;
	records_count?: number;
};

type OdsDatasetRecord = {
	dataset_id: string;
	dataset_uid?: string;
	has_records?: boolean;
	features?: string[];
	metas?: { default?: OdsDatasetMetas };
};

type OdsCatalogResponse = {
	total_count: number;
	results: OdsDatasetRecord[];
};

const ODS_PAGE_SIZE = 100;
const DOWNLOAD_TIMEOUT_MS = 180_000;

const HTML_TAG = /<[^>]+>/g;
const WHITESPACE = /\s+/g;

function stripHtml(value: string): string {
	return value
		.replace(HTML_TAG, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(WHITESPACE, " ")
		.trim();
}

/**
 * Build the GeoJSON export URL for an ODS dataset.
 * epsg=28992 keeps the original RD New (Rijksdriehoek) coordinates, so the
 * RD->WGS84 conversion in the transformer stays valid.
 */
export function buildExportUrl(apiBase: string, datasetId: string): string {
	return `${apiBase}/catalog/datasets/${datasetId}/exports/geojson?epsg=28992`;
}

function isGeoDataset(record: OdsDatasetRecord): boolean {
	return Boolean(record.has_records) && Array.isArray(record.features) && record.features.includes("geo");
}

function odsRecordToPackage(config: CkanConfig, record: OdsDatasetRecord): CkanPackage {
	const metas = record.metas?.default ?? {};
	const changeMarker = metas.modified ?? metas.data_processed ?? "";

	const resources: CkanResource[] = isGeoDataset(record)
		? [
				{
					id: `${record.dataset_id}-geojson`,
					name: `${record.dataset_id} geojson`,
					format: "geojson",
					url: buildExportUrl(config.apiBase, record.dataset_id),
					hash: changeMarker,
					size: metas.records_count ?? 0,
					last_modified: metas.modified ?? metas.data_processed ?? "",
				},
			]
		: [];

	return {
		id: record.dataset_uid ?? record.dataset_id,
		name: record.dataset_id,
		title: metas.title ?? record.dataset_id,
		notes: stripHtml(metas.description ?? ""),
		resources,
	};
}

export async function fetchPackages(config: CkanConfig): Promise<CkanPackage[]> {
	console.log("Ophalen datasetlijst van Haags dataportaal (OpenDataSoft)...");

	const records: OdsDatasetRecord[] = [];
	let offset = 0;
	let totalCount = Number.POSITIVE_INFINITY;

	while (offset < totalCount) {
		const url = `${config.apiBase}/catalog/datasets?limit=${ODS_PAGE_SIZE}&offset=${offset}`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Dataportaal API fout: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as OdsCatalogResponse;
		totalCount = data.total_count;
		records.push(...data.results);

		if (data.results.length === 0) {
			break;
		}
		offset += ODS_PAGE_SIZE;
	}

	console.log(`${records.length} datasets gevonden`);
	return records.map((record) => odsRecordToPackage(config, record));
}

export async function downloadDataset(url: string): Promise<GeoJSONCollection> {
	if (!url.includes("opendatasoft.com")) {
		throw new Error(`Ongeldige dataset URL`);
	}

	const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });

	if (!response.ok) {
		throw new Error(`Download mislukt: ${response.status}`);
	}

	// Parse direct uit de response i.p.v. eerst de volledige body als string te
	// bufferen en die apart te JSON.parsen — dat hield twee volledige kopieën
	// tegelijk in geheugen (kritiek bij grote exports zoals bomen, 149k features).
	return (await response.json()) as GeoJSONCollection;
}

export function extractJsonDatasets(packages: CkanPackage[]): DatasetInfo[] {
	const datasets: DatasetInfo[] = [];

	for (const pkg of packages) {
		const geojsonResource = pkg.resources.find((r) => {
			const format = r.format?.toLowerCase() || "";
			return format === "geojson" || format === "json";
		});

		if (geojsonResource) {
			datasets.push({
				packageId: pkg.id,
				name: pkg.name.replace(/-/g, "_"),
				displayName: pkg.title,
				description: pkg.notes || "",
				resourceUrl: geojsonResource.url,
				contentHash: geojsonResource.hash || "",
				lastModified: geojsonResource.last_modified || "",
				format: geojsonResource.format.toLowerCase(),
			});
		}
	}

	console.log(`${datasets.length} datasets met GeoJSON export gevonden`);
	return datasets;
}
