import AdmZip from "adm-zip";
import type { GeoJSONCollection } from "./ckan.transformer.js";
import type { CkanConfig, CkanPackage, CkanResource, DatasetInfo } from "./ckan.types.js";

export async function fetchPackages(config: CkanConfig): Promise<CkanPackage[]> {
	console.log("Ophalen datasetlijst van Haags dataportaal...");

	const url = "https://ckan.dataplatform.nl/api/3/action/package_search?fq=organization:gemeente-den-haag&rows=500";
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Dataportaal API fout: ${response.status} ${response.statusText}`);
	}

	const data = (await response.json()) as { result: { results: CkanPackage[] } };
	const packages = data.result.results;

	console.log(`${packages.length} packages gevonden`);
	return packages;
}

export async function downloadDataset(url: string): Promise<GeoJSONCollection> {
	if (!url.includes("ckan.dataplatform.nl") && !url.includes("gemeente-den-haag")) {
		throw new Error(`Ongeldige dataset URL`);
	}

	const response = await fetch(url, { signal: AbortSignal.timeout(120000) });

	if (!response.ok) {
		throw new Error(`Download mislukt: ${response.status}`);
	}

	const buffer = await response.arrayBuffer();

	if (url.endsWith(".zip")) {
		const zip = new AdmZip(Buffer.from(buffer));
		const entries = zip.getEntries();
		const jsonEntry = entries.find(
			(e) => e.entryName.endsWith(".json") || e.entryName.endsWith(".geojson"),
		);
		if (!jsonEntry) {
			throw new Error("Geen JSON bestand gevonden in ZIP archief");
		}
		const content = zip.readAsText(jsonEntry);
		return JSON.parse(content);
	}

	const text = new TextDecoder().decode(buffer);
	return JSON.parse(text);
}

function isHaagseJsonResource(resource: CkanResource): boolean {
	const format = resource.format?.toLowerCase() || "";
	const url = resource.url?.toLowerCase() || "";
	const name = resource.name?.toLowerCase() || "";

	if (format === "json" || format === "geojson") {
		return true;
	}

	if (format === "zip" && (url.includes("-json") || name.includes("json"))) {
		return true;
	}

	return false;
}

export function extractJsonDatasets(packages: CkanPackage[]): DatasetInfo[] {
	const datasets: DatasetInfo[] = [];

	for (const pkg of packages) {
		const jsonResource = pkg.resources.find(isHaagseJsonResource);

		if (jsonResource) {
			datasets.push({
				packageId: pkg.id,
				name: pkg.name.replace(/-/g, "_"),
				displayName: pkg.title,
				description: pkg.notes || "",
				resourceUrl: jsonResource.url,
				contentHash: jsonResource.hash || "",
				lastModified: jsonResource.last_modified || "",
				format: jsonResource.format.toLowerCase(),
			});
		}
	}

	console.log(`${datasets.length} datasets met JSON/GeoJSON resources gevonden`);
	return datasets;
}
