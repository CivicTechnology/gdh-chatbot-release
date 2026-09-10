/**
 * Cron-job: doe een HTTP HEAD op de bron-URL van iedere ACTIEF regeling.
 * - Tweemaal mislukken op rij -> audit DEAD_LINK + uitroepteken in beheerportaal.
 * - Wanneer een eerder dood lijkende URL weer werkt -> audit DEAD_LINK_RESOLVED.
 *
 * Bewust zonder e-mailnotificaties: signalering loopt via het beheerportaal.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");

if (!process.env.CI) {
	config({ path: path.join(monorepoRoot, ".env.local") });
}

const { findActiveForLinkCheck, recordDeadLinkCheck } = await import(
	"../src/domains/subsidieregeling/index.js"
);

const HEAD_TIMEOUT_MS = 8000;

async function isLinkAlive(url: string): Promise<boolean> {
	if (!url) return false;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
	try {
		const response = await fetch(url, { method: "HEAD", signal: controller.signal });
		if (response.status >= 200 && response.status < 400) {
			return true;
		}
		// Sommige servers ondersteunen geen HEAD - probeer GET als fallback.
		if (response.status === 405 || response.status === 501) {
			const getResp = await fetch(url, { method: "GET", signal: controller.signal });
			return getResp.status >= 200 && getResp.status < 400;
		}
		return false;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

async function main() {
	const regelingen = await findActiveForLinkCheck();
	console.log(
		`[cron-check-dead-links] ${new Date().toISOString()} - check op ${regelingen.length} regelingen`,
	);

	for (const regeling of regelingen) {
		const alive = await isLinkAlive(regeling.bronUrl);
		try {
			await recordDeadLinkCheck(regeling.id, regeling.deadLinkSince, !alive);
			if (!alive) {
				console.log(`  ! ${regeling.bronUrl} - onbereikbaar`);
			} else if (regeling.deadLinkSince) {
				console.log(`  ✔ ${regeling.bronUrl} - weer bereikbaar`);
			}
		} catch (error) {
			console.error(`  ! Fout bij ${regeling.bronUrl}:`, error);
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("[cron-check-dead-links] gefaald:", error);
		process.exit(1);
	});
