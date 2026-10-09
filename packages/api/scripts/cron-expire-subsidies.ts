/**
 * Cron-job: zet alle ACTIEF regelingen wiens vervaldatum verstreken is op
 * status VERLOPEN en logt een EXPIRE audit-event.
 *
 * Lokale invocatie: bun --filter @gdh-chatbot/api cron:expire
 * In productie: dagelijks aanroepen via een externe scheduler.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");

if (!process.env.CI) {
	config({ path: path.join(monorepoRoot, ".env.local") });
}

const { findExpiredActive, markExpired } = await import("../src/domains/subsidieregeling/index.js");

async function main() {
	const now = new Date();
	const expired = await findExpiredActive(now);

	if (expired.length === 0) {
		console.log(`[cron-expire-subsidies] ${now.toISOString()} - geen regelingen verlopen`);
		return;
	}

	console.log(
		`[cron-expire-subsidies] ${now.toISOString()} - ${expired.length} regelingen worden gemarkeerd als VERLOPEN`,
	);

	for (const regeling of expired) {
		try {
			await markExpired(regeling.id);
			console.log(`  - ${regeling.naam} (vervaldatum ${regeling.vervaldatum?.toISOString()})`);
		} catch (error) {
			console.error(`  ! Fout bij markeren ${regeling.naam}:`, error);
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("[cron-expire-subsidies] gefaald:", error);
		process.exit(1);
	});
