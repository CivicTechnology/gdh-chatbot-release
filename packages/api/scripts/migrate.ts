/**
 * Migration Script
 *
 * Runs Prisma migrations with proper handling for Neon serverless.
 * The direct connection URL is configured in prisma.config.ts.
 *
 * Always runs the baseline SQL first (idempotent with IF NOT EXISTS),
 * then runs migrate deploy to apply any pending migrations.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const monorepoRoot = path.resolve(__dirname, "../../..");

// Load environment variables from root .env.local (local dev only)
if (!process.env.CI) {
	config({ path: path.join(monorepoRoot, ".env.local") });
}

const BASELINE_MIGRATION = "0_baseline";

const execOptions = {
	cwd: apiRoot,
	env: {
		...process.env,
		// Disable advisory lock for CI/CD: builds run sequentially so there's no
		// risk of concurrent migrations, and the 10s timeout is too short for
		// some cloud Postgres cold starts.
		// See: https://www.prisma.io/docs/orm/reference/environment-variables-reference
		PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "true",
	},
};

/**
 * Run the baseline SQL directly. This is idempotent (uses IF NOT EXISTS)
 * so it's safe to run every time.
 */
function ensureBaseline(): void {
	console.log("Ensuring baseline schema exists (idempotent)...\n");

	const baselineSqlPath = path.join(
		apiRoot,
		"prisma",
		"migrations",
		BASELINE_MIGRATION,
		"migration.sql",
	);

	try {
		execSync(`bunx prisma db execute --file "${baselineSqlPath}"`, {
			...execOptions,
			stdio: "inherit",
		});
		console.log("\nBaseline schema verified.\n");
	} catch (error) {
		console.error("Failed to apply baseline SQL:", error);
		throw error;
	}
}

/**
 * Mark baseline as applied if not already in migration history.
 * This prevents migrate deploy from trying to re-run it.
 */
function markBaselineApplied(): void {
	console.log(`Marking "${BASELINE_MIGRATION}" as applied (if needed)...\n`);
	try {
		execSync(`bunx prisma migrate resolve --applied "${BASELINE_MIGRATION}"`, {
			...execOptions,
			encoding: "utf-8",
			stdio: ["inherit", "pipe", "pipe"],
		});
		console.log("Baseline marked as applied.\n");
	} catch {
		// P3008: migration already applied - this is expected and fine
		console.log("(baseline already marked as applied)\n");
	}
}

/**
 * Run prisma migrate deploy to apply any pending migrations.
 */
function runMigrateDeploy(): void {
	console.log("Running prisma migrate deploy...\n");
	execSync("bunx prisma migrate deploy", {
		...execOptions,
		stdio: "inherit",
	});
}

if (!process.env.POSTGRES_URL) {
	console.error("POSTGRES_URL environment variable is not set");
	process.exit(1);
}

console.log("=== Prisma Migration ===\n");

try {
	// Step 1: Always run baseline SQL (idempotent, creates missing tables)
	ensureBaseline();

	// Step 2: Mark baseline as applied in migration history
	markBaselineApplied();

	// Step 3: Run migrate deploy for any additional migrations
	runMigrateDeploy();

	console.log("\n=== Migration Complete ===");
} catch (error) {
	console.error("\nMigration failed:", error);
	process.exit(1);
}
