import { ingestionConfig } from "@gdh-chatbot/shared";
import * as gdhDataportaalCollector from "./ckan.collector.js";
import * as gdhDataportaalRepository from "./ckan.repository.js";
import {
	buildGeometry,
	createGeoLookup,
	transformGeoJSON,
	type GeoJSONCollection,
	type GeoLookup,
} from "./ckan.transformer.js";
import { GDH_GEO_LOOKUP_DATASETS } from "./gdh-dataportaal-schemas.js";
import type { CkanConfig, DatasetInfo, ExistingDataset, SyncResult } from "./ckan.types.js";
import * as embeddingCollector from "../embedding/embedding.collector.js";

const ckanCollector = gdhDataportaalCollector;
const ckanRepository = gdhDataportaalRepository;

function chunk<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}

async function processWithConcurrency<T, R>(
	items: T[],
	processor: (item: T) => Promise<R>,
	concurrency: number,
): Promise<R[]> {
	const results: R[] = [];
	const executing: Promise<void>[] = [];

	for (const item of items) {
		const p = processor(item).then((result) => {
			results.push(result);
		});

		executing.push(p);

		if (executing.length >= concurrency) {
			await Promise.race(executing);
			for (let i = executing.length - 1; i >= 0; i--) {
				const status = await Promise.race([
					executing[i].then(() => "resolved"),
					Promise.resolve("pending"),
				]);
				if (status === "resolved") {
					executing.splice(i, 1);
				}
			}
		}
	}

	await Promise.all(executing);
	return results;
}

async function laadGdhGeoLookup(datasets: DatasetInfo[]): Promise<GeoLookup> {
	console.log("\nLaden van Haagse gebiedsindelingen voor geo-verrijking...");

	const geoDatasets = GDH_GEO_LOOKUP_DATASETS
		.map((name) => datasets.find((d) => d.name === name))
		.filter((d): d is DatasetInfo => d !== undefined);

	const geoResults = await Promise.all(
		geoDatasets.map(async (dataset) => {
			try {
				console.log(`  Downloading ${dataset.name}...`);
				return {
					name: dataset.name,
					data: await ckanCollector.downloadDataset(dataset.resourceUrl),
				};
			} catch (error) {
				console.log(`  Failed to download ${dataset.name}: ${error}`);
				return { name: dataset.name, data: null };
			}
		}),
	);

	const geoData: Record<string, GeoJSONCollection | null> = {
		wijken: null,
		buurten: null,
		stadsdelen: null,
	};
	for (const result of geoResults) {
		geoData[result.name] = result.data;
	}

	console.log("  Haagse gebiedsindelingen geladen\n");
	return createGeoLookup(geoData.wijken, geoData.buurten, geoData.stadsdelen);
}

const loadGeoLookup = laadGdhGeoLookup;

function filterDatasets(
	packages: Awaited<ReturnType<typeof ckanCollector.fetchPackages>>,
	config: CkanConfig,
): DatasetInfo[] {
	let filteredPackages = packages;

	if (config.datasets.include.length > 0) {
		filteredPackages = filteredPackages.filter((p) =>
			config.datasets.include.includes(p.name),
		);
		console.log(`Filtered to ${filteredPackages.length} packages (include list)`);
	}

	if (config.datasets.exclude.length > 0) {
		filteredPackages = filteredPackages.filter(
			(p) => !config.datasets.exclude.includes(p.name),
		);
		console.log(`Filtered to ${filteredPackages.length} packages (exclude list)`);
	}

	return ckanCollector.extractJsonDatasets(filteredPackages);
}

async function removeOrphanedDatasets(
	existing: ExistingDataset[],
	validDatasetNames: Set<string>,
): Promise<void> {
	const orphanedDatasets = existing.filter((d) => !validDatasetNames.has(d.name));

	if (orphanedDatasets.length > 0) {
		console.log(
			`\nRemoving ${orphanedDatasets.length} orphaned datasets (no longer in include/exclude config):`,
		);
		for (const dataset of orphanedDatasets) {
			console.log(`  - ${dataset.displayName} (${dataset.name})`);
			await ckanRepository.deleteDatasetById(dataset.id);
		}
		console.log("Orphaned datasets removed.\n");
	}
}

async function syncSingleDataset(
	dataset: DatasetInfo,
	existingId: string | null,
	geoLookup: GeoLookup,
	prefix: string,
): Promise<boolean> {
	try {
		const rawData = await ckanCollector.downloadDataset(dataset.resourceUrl);
		const { records, schema } = transformGeoJSON(rawData, dataset.name, geoLookup);

		const embeddingText = `${dataset.displayName} ${dataset.description}`.trim();
		const embedding = await embeddingCollector.generateEmbedding(embeddingText);

		const datasetId = await ckanRepository.upsertDatasetWithEmbedding(
			dataset,
			schema,
			records.length,
			embedding,
			existingId,
		);

		await ckanRepository.deleteRecordsByDatasetId(datasetId);

		const rows = records.map((record) => ({
			datasetId,
			data: record,
			geometry: buildGeometry(record),
		}));

		const BATCH_SIZE = ingestionConfig.database.batchSize;
		const batches = chunk(rows, BATCH_SIZE);

		for (const batch of batches) {
			await ckanRepository.bulkInsertRecordsWithGeometry(batch);
		}

		console.log(`${prefix} ✓ ${dataset.name} (${records.length} records)`);
		return true;
	} catch (error) {
		console.error(
			`${prefix} ✗ ${dataset.name}: ${error instanceof Error ? error.message : error}`,
		);
		return false;
	}
}

export type SyncOptions = {
	force?: boolean;
};

export async function syncAllDatasets(
	config: CkanConfig,
	options: SyncOptions = {},
): Promise<SyncResult> {
	const { force = false } = options;

	console.log(`Config: ${config.organization} @ ${config.apiBase}`);

	const packages = await ckanCollector.fetchPackages(config);
	const datasets = filterDatasets(packages, config);
	const validDatasetNames = new Set(datasets.map((d) => d.name));

	console.log("Fetching existing datasets from database...");
	const existingDatasets = await ckanRepository.findAllDatasets();
	console.log(`Found ${existingDatasets.length} existing datasets in database`);
	const existingByName = new Map(existingDatasets.map((d) => [d.name, d]));

	await removeOrphanedDatasets(existingDatasets, validDatasetNames);

	const geoLookup = await loadGeoLookup(datasets);

	const toSync: DatasetInfo[] = [];
	let skippedCount = 0;

	for (const dataset of datasets) {
		const existing = existingByName.get(dataset.name);
		if (!force && existing?.contentHash && existing.contentHash === dataset.contentHash) {
			skippedCount++;
			continue;
		}
		toSync.push(dataset);
	}

	console.log(`Datasets to sync: ${toSync.length}, skipped (unchanged): ${skippedCount}\n`);

	let syncedCount = 0;
	let errorCount = 0;
	const syncLock = { count: 0 };

	const processDataset = async (dataset: DatasetInfo): Promise<void> => {
		const existing = existingByName.get(dataset.name);
		const idx = ++syncLock.count;
		const prefix = `[${idx}/${toSync.length}]`;

		console.log(`${prefix} ${dataset.displayName} (${dataset.name})`);

		const success = await syncSingleDataset(
			dataset,
			existing?.id ?? null,
			geoLookup,
			prefix,
		);

		if (success) {
			syncedCount++;
		} else {
			errorCount++;
		}
	};

	await processWithConcurrency(
		toSync,
		processDataset,
		ingestionConfig.ckan.concurrencyLimit,
	);

	return {
		synced: syncedCount,
		skipped: skippedCount,
		errors: errorCount,
		total: datasets.length,
	};
}
