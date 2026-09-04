#!/usr/bin/env node
/**
 * Ingestion CLI - Unified interface for document ingestion pipeline
 *
 * Commands:
 *   ingest pull <source>  - Fetch documents from a source (pdf, web, ckan, law)
 *   ingest process        - Generate embeddings for all documents
 *   ingest reset          - Clear all document data from database
 *   ingest backup         - Export documents to seed file
 *   ingest restore        - Import documents from seed file
 */

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

// Helper to run a command and stream output
function runCommand(
  command: string,
  args: string[] = [],
  options: { cwd?: string } = {}
): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options.cwd || __dirname,
      stdio: "inherit",
      shell: process.platform === "win32", // Only use shell on Windows for PATH resolution
    });

    proc.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

// Helper to run TypeScript processors
async function runProcessor(script: string, args: string[] = []): Promise<void> {
  const scriptPath = resolve(__dirname, "processors", script);
  const code = await runCommand("npx", ["tsx", scriptPath, ...args]);
  if (code !== 0) {
    process.exit(code);
  }
}

// Helper to run Python collectors
async function runCollector(script: string, args: string[] = []): Promise<void> {
  const scriptPath = resolve(__dirname, "collectors", script);
  const code = await runCommand("python", [scriptPath, ...args]);
  if (code !== 0) {
    process.exit(code);
  }
}

program
  .name("ingest")
  .description("Document ingestion pipeline for GDH Chatbot")
  .version("1.0.0");

// Pull command with subcommands for each source
const pullCmd = program
  .command("pull <source>")
  .description("Fetch documents from a source")
  .option("-f, --force", "Force re-import even if content unchanged")
  .option("-s, --source <path>", "Path to source configuration file")
  .action(async (source: string, options: { force?: boolean; source?: string }) => {
    const args: string[] = [];
    if (options.force) args.push("--force");
    if (options.source) args.push("--source", options.source);

    switch (source.toLowerCase()) {
      case "pdf":
        console.log("Pulling documents from PDF sources...\n");
        await runCollector("pdf/ingest.py", args);
        break;

      case "web":
        console.log("Pulling documents from web sources...\n");
        await runCollector("web/scraper.py", args);
        break;

      case "ckan":
        console.log("Pulling documents from CKAN...\n");
        await runProcessor("sync-ckan.ts", args);
        break;

      case "law":
        console.log("Pulling documents from Dutch law (BWB)...\n");
        await runProcessor("sync-law.ts", args);
        break;

      default:
        console.error(`Unknown source: ${source}`);
        console.error("Available sources: pdf, web, ckan, law");
        process.exit(1);
    }
  });

pullCmd.addHelpText(
  "after",
  `
Sources:
  pdf   - Extract text from PDF documents
  web   - Scrape content from websites
  ckan  - Sync datasets from CKAN portal
  law   - Sync Dutch environmental law (Omgevingswet)

Examples:
  $ ingest pull pdf
  $ ingest pull web --source ./config/custom-sources.json
  $ ingest pull ckan --force
`
);

// Process command - generate embeddings
program
  .command("process")
  .description("Generate embeddings for all document chunks")
  .option("-f, --force", "Re-embed all chunks, even if already embedded")
  .action(async (options: { force?: boolean }) => {
    console.log("Processing document embeddings...\n");
    const args = options.force ? ["--force"] : [];
    await runProcessor("embed.ts", args);
  });

// Reset command - clear database
program
  .command("reset")
  .description("Clear all document data from database")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (options: { yes?: boolean }) => {
    if (!options.yes) {
      console.log("WARNING: This will delete ALL document data from the database.");
      console.log("Run with --yes to confirm.\n");
      process.exit(0);
    }

    console.log("Resetting document database...\n");
    await runProcessor("clear.ts");
  });

// Backup command - export seed
program
  .command("backup")
  .description("Export all documents to a compressed seed file")
  .action(async () => {
    console.log("Creating backup of document data...\n");
    await runProcessor("export-seed.ts");
  });

// Restore command - import seed
program
  .command("restore")
  .description("Restore documents from a seed file")
  .option("-f, --force", "Overwrite existing data")
  .action(async (options: { force?: boolean }) => {
    console.log("Restoring document data from backup...\n");
    const args = options.force ? ["--force"] : [];
    await runProcessor("import-seed.ts", args);
  });

// Status command - show current state
program
  .command("status")
  .description("Show current document counts and status")
  .action(async () => {
    await runProcessor("status.ts");
  });

// All command - run full pipeline
program
  .command("all")
  .description("Run full ingestion pipeline (pull all sources + process)")
  .option("--skip-pdf", "Skip PDF ingestion")
  .option("--skip-web", "Skip web scraping")
  .option("--skip-ckan", "Skip CKAN sync")
  .option("--skip-law", "Skip law sync")
  .option("--skip-embed", "Skip embedding generation")
  .option("-f, --force", "Force re-import and re-embed")
  .action(
    async (options: {
      skipPdf?: boolean;
      skipWeb?: boolean;
      skipCkan?: boolean;
      skipLaw?: boolean;
      skipEmbed?: boolean;
      force?: boolean;
    }) => {
      const args = options.force ? ["--force"] : [];
      const steps: { name: string; run: () => Promise<void> }[] = [];

      if (!options.skipPdf) {
        steps.push({
          name: "PDF documents",
          run: () => runCollector("pdf/ingest.py", args),
        });
      }

      if (!options.skipWeb) {
        steps.push({
          name: "Web sources",
          run: () => runCollector("web/scraper.py", args),
        });
      }

      if (!options.skipCkan) {
        steps.push({
          name: "CKAN datasets",
          run: () => runProcessor("sync-ckan.ts", args),
        });
      }

      if (!options.skipLaw) {
        steps.push({
          name: "Dutch law",
          run: () => runProcessor("sync-law.ts", args),
        });
      }

      if (!options.skipEmbed) {
        steps.push({
          name: "Embeddings",
          run: () => runProcessor("embed.ts", args),
        });
      }

      console.log(`Running full ingestion pipeline (${steps.length} steps)...\n`);

      for (const [index, step] of steps.entries()) {
        console.log(`\n[${index + 1}/${steps.length}] ${step.name}`);
        console.log("─".repeat(40));
        await step.run();
      }

      console.log("\n" + "═".repeat(40));
      console.log("Pipeline complete!");
      await runProcessor("status.ts");
    }
  );

program.parse();
