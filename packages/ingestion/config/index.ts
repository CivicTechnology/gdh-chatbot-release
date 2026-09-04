import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type SourceConfig,
  validateSources,
  sourceConfigSchema,
  ckanConfigSchema,
} from "./schema";

export type { SourceConfig } from "./schema";
export { validateSource, validateSources } from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads PDF source configurations.
 */
export async function loadPdfSources(): Promise<SourceConfig[]> {
  const filePath = path.join(__dirname, "pdf.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return validateSources(JSON.parse(raw));
}

/**
 * Loads web source configurations.
 */
export async function loadWebSources(): Promise<SourceConfig[]> {
  const filePath = path.join(__dirname, "web.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return validateSources(JSON.parse(raw));
}

/**
 * Loads PDF sources as a map keyed by source ID.
 */
export async function loadPdfSourcesMap(): Promise<Map<string, SourceConfig>> {
  const sources = await loadPdfSources();
  return new Map(sources.map((s) => [s.id, s]));
}

/**
 * Loads web sources as a map keyed by source ID.
 */
export async function loadWebSourcesMap(): Promise<Map<string, SourceConfig>> {
  const sources = await loadWebSources();
  return new Map(sources.map((s) => [s.id, s]));
}

/**
 * Returns the absolute path to the config directory.
 */
export function getConfigDir(): string {
  return __dirname;
}

/**
 * Returns the absolute path to a config file.
 */
export function getConfigPath(filename: string): string {
  return path.join(__dirname, filename);
}

export { sourceConfigSchema, ckanConfigSchema };
