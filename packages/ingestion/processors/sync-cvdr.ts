/**
 * CLI runner voor CVDR sync. Consumeert events uit
 * `@gdh-chatbot/api`'s `runCvdrSync` en print compacte voortgang naar stdout.
 * De daadwerkelijke sync-logic + event-stream zit in api/lib/cvdr/ zodat
 * dezelfde stream ook door de admin-SSE-endpoint gebruikt kan worden.
 *
 * Aanroepen vanaf monorepo-root:
 *   bun --filter @gdh-chatbot/ingestion ingest pull cvdr
 *   bun --filter @gdh-chatbot/ingestion ingest pull cvdr --since 2026-05-01
 *   bun --filter @gdh-chatbot/ingestion ingest pull cvdr --reprocess
 */

import { loadEnv } from "../lib/load-env.js";
import { disconnectPrisma } from "../lib/prisma.js";

loadEnv();

const { runCvdrSync } = await import("@gdh-chatbot/api/lib/cvdr/sync");

type CliOptions = {
	modifiedSince?: string;
	mode: "update" | "reprocess";
};

function parseArgs(): CliOptions {
	const args = process.argv.slice(2);
	const options: CliOptions = { mode: "update" };
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--since" || args[i] === "-s") {
			options.modifiedSince = args[++i];
		} else if (args[i] === "--reprocess") {
			options.mode = "reprocess";
		}
	}
	return options;
}

async function main() {
	const options = parseArgs();
	console.log("CVDR sync — Den Haag subsidieregelingen");
	console.log(
		`Modus: ${options.mode === "reprocess" ? "alles opnieuw verwerken" : "alleen wijzigingen bijwerken"}`,
	);
	if (options.modifiedSince) console.log(`Incrementeel sinds ${options.modifiedSince}`);
	console.log("");

	for await (const event of runCvdrSync(options)) {
		switch (event.type) {
			case "start":
				console.log(`Peildatum: ${event.today}`);
				break;
			case "fetched":
				console.log(`Versies: ${event.versies}, unieke werken: ${event.werken}`);
				console.log("");
				console.log("Verwerken:");
				break;
			case "regeling-progress":
				if (event.outcome === "failed") {
					process.stdout.write(
						`\r  ${event.done}/${event.total}  FAIL: ${event.titel.slice(0, 50)}\n`,
					);
				} else if (event.done % 10 === 0 || event.done === event.total) {
					process.stdout.write(`\r  ${event.done}/${event.total}`);
				}
				break;
			case "vervangen-resolved":
				console.log(
					`\n  Vervangen-relaties: resolved=${event.resolved} missingTarget=${event.missingTarget}`,
				);
				break;
			case "cancelling":
				console.log("\n  Annuleren...");
				break;
			case "complete":
				console.log("\n=== Eindstatistiek ===");
				console.log(JSON.stringify(event.stats, null, 2));
				break;
			case "fatal":
				console.error(`FATAL: ${event.message}`);
				process.exitCode = 1;
				break;
		}
	}
}

main()
	.catch((error) => {
		console.error("CVDR sync gefaald:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await disconnectPrisma();
	});
