/**
 * Law Sync Service
 * Business logic for synchronizing law documents
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as lawCollector from "./law.collector.js";
import { buildSectionPath, parseOmgevingswet, type OmgevingswetChunk } from "./law.parser.js";
import * as lawRepository from "./law.repository.js";
import type { LawConfig, LawSource, SyncLawOptions, SyncLawResult } from "./law.types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INGESTION_ROOT = path.resolve(__dirname, "../..");
const STORAGE_DIR = path.join(INGESTION_ROOT, "storage", "transformed", "law", "bwb");
const CHUNKS_DIR = path.join(INGESTION_ROOT, "storage", "transformed", "law", "chunks");

function simpleHash(content: string): string {
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16).padStart(8, "0");
}

async function ensureDirectories(): Promise<void> {
	await fs.mkdir(STORAGE_DIR, { recursive: true });
	await fs.mkdir(CHUNKS_DIR, { recursive: true });
}

async function syncSingleLawSource(
	source: LawSource,
	options: SyncLawOptions,
): Promise<boolean> {
	const bwbId = source.id;
	console.log(`\nImporting ${source.title} (${bwbId})...`);

	// Step 1: Fetch record metadata from SRU
	console.log("  Fetching BWB record metadata...");
	const record = await lawCollector.fetchBwbRecordById(bwbId);

	if (!record) {
		throw new Error(`No record found for BWB ID: ${bwbId}`);
	}

	console.log(`    Title: ${record.title}`);
	console.log(`    Modified: ${record.modified}`);

	// Step 2: Fetch manifest to get latest version
	if (!record.manifestUrl) {
		throw new Error("No manifest URL found in record");
	}

	console.log("  Fetching manifest...");
	const manifest = await lawCollector.fetchBwbManifest(record.manifestUrl, bwbId);

	if (!manifest.latestVersion) {
		throw new Error("No versions found in manifest");
	}

	const latestVersion = manifest.latestVersion;
	console.log(`    Latest version: ${latestVersion.versionDate}`);

	// Step 3: Download XML
	console.log("  Downloading XML...");
	const xmlContent = await lawCollector.downloadItem(latestVersion.downloadUrl);
	const contentHash = simpleHash(xmlContent);

	// Check if content has changed
	const existingHash = await lawRepository.findHashBySourceId(bwbId);

	if (!options.force && existingHash === contentHash) {
		console.log("  Content unchanged, skipping.");
		return false;
	}

	// Save XML locally for debugging/caching
	const xmlFilename = `${bwbId}_${latestVersion.versionDate}.xml`;
	const xmlPath = path.join(STORAGE_DIR, xmlFilename);
	await fs.writeFile(xmlPath, xmlContent, "utf-8");

	// Step 4: Parse XML into chunks
	console.log("  Parsing XML...");
	const chunks = parseOmgevingswet(xmlContent, {
		bwbId,
		preferredUrl: record.preferredUrl,
		versionDate: latestVersion.versionDate,
	});

	console.log(`    Parsed ${chunks.length} chunks`);

	// Save chunks to JSON for debugging
	const chunksPath = path.join(
		CHUNKS_DIR,
		`${bwbId}-${latestVersion.versionDate.replace(/-/g, "")}.json`,
	);
	await fs.writeFile(chunksPath, JSON.stringify(chunks, null, 2), "utf-8");

	// Step 5: Upsert document source
	console.log("  Updating database...");

	const sourceDbId = await lawRepository.upsertSource({
		sourceId: bwbId,
		title: record.title,
		url: record.preferredUrl,
		category: source.category,
		tags: source.tags,
		description: source.description,
		publishedAt: latestVersion.versionDate
			? new Date(`${latestVersion.versionDate}T00:00:00Z`)
			: null,
		sha256: contentHash,
		bytes: Buffer.byteLength(xmlContent, "utf-8"),
		pageCount: 0,
		manifest: {
			bwbId,
			versionDate: latestVersion.versionDate,
			itemPath: latestVersion.itemPath,
			modified: record.modified,
		},
	});

	// Step 6: Delete existing chunks
	await lawRepository.deleteChunksBySourceId(sourceDbId);

	// Step 7: Insert new chunks
	const chunkRows = chunks
		.filter((chunk: OmgevingswetChunk) => chunk.text.trim())
		.map((chunk: OmgevingswetChunk) => ({
			sourceId: sourceDbId,
			chunkId: `${bwbId}:${String(chunk.order).padStart(5, "0")}`,
			text: chunk.text,
			tokenCount: chunk.tokenCount,
			pageStart: 0,
			pageEnd: 0,
			chunkType: "law_article",
			sectionPath: buildSectionPath(chunk),
			isTable: false,
			tableId: null,
			viewerAnchor: chunk.metadata.articleAnchor ?? null,
			metadata: chunk.metadata,
			order: chunk.order,
		}));

	if (chunkRows.length > 0) {
		await lawRepository.bulkInsertChunks(chunkRows);
		console.log(`    Inserted ${chunkRows.length} chunks`);
	}

	return true;
}

export async function syncAllLawSources(
	config: LawConfig,
	options: SyncLawOptions,
): Promise<SyncLawResult> {
	console.log("Starting law import...");
	console.log(`Found ${config.sources.length} law source(s) in config`);

	await ensureDirectories();

	let imported = 0;
	let skipped = 0;
	let errors = 0;

	for (const source of config.sources) {
		try {
			const wasImported = await syncSingleLawSource(source, options);
			if (wasImported) {
				imported++;
			} else {
				skipped++;
			}
		} catch (error) {
			console.error(`  Error importing ${source.id}: ${error}`);
			errors++;
		}
	}

	console.log("\nImport complete!");
	console.log(`\nNext step: Run embedding script to generate embeddings:`);
	console.log("  bun run ingest process");

	return {
		imported,
		skipped,
		errors,
		total: config.sources.length,
	};
}
