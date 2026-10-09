/**
 * Eenmalig kalibratie-script voor RETRIEVAL_THRESHOLD in search-subsidies
 * en match-subsidies tools. Draait een set "relevante" en "irrelevante"
 * queries tegen de huidige actieve regelingen en print de distance-
 * verdeling per groep. Kies de threshold tussen de twee groepen in.
 *
 * Aanroep: bun --filter @gdh-chatbot/api calibrate:threshold
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");
if (!process.env.CI) {
	config({ path: path.join(monorepoRoot, ".env.local") });
}

const { searchActive } = await import("../src/domains/subsidieregeling/subsidieregeling.repository.js");
const { createEmbedding } = await import("../src/lib/ai/embeddings.js");

type Probe = { q: string; cluster?: "PARTICULIER" | "BEDRIJF" | "MAATSCHAPPELIJK"; expectMatch: boolean };

// Pas deze set aan naar wat representatief is voor echte gebruikers, liefst
// een gelabelde set uit de praktijk. Tot dan:
const PROBES: Probe[] = [
	// Relevant — moet matchen
	{ q: "Welke subsidie is er voor energie besparen in mijn huis?", cluster: "PARTICULIER", expectMatch: true },
	{ q: "Subsidie voor zonnepanelen op bedrijfspand", cluster: "BEDRIJF", expectMatch: true },
	{ q: "Geld voor een buurtinitiatief in mijn wijk", cluster: "MAATSCHAPPELIJK", expectMatch: true },
	{ q: "MKB verduurzaming Den Haag", cluster: "BEDRIJF", expectMatch: true },

	// Niet-relevant — moet NIET matchen (noMatch fallback verwacht)
	{ q: "Subsidie voor een elektrische auto", cluster: "PARTICULIER", expectMatch: false },
	{ q: "Tegemoetkoming voor kinderopvang", cluster: "PARTICULIER", expectMatch: false },
	{ q: "Subsidie voor het opzetten van een webshop", cluster: "BEDRIJF", expectMatch: false },
	{ q: "Vergoeding voor culturele evenementen", cluster: "MAATSCHAPPELIJK", expectMatch: false },
];

async function main() {
	console.log("query\texpect\ttop_distance\ttop_naam");
	const positives: number[] = [];
	const negatives: number[] = [];
	for (const p of PROBES) {
		const emb = await createEmbedding(p.q);
		const rows = await searchActive({ embedding: emb, limit: 1 });
		const top = rows[0];
		const dist = top?.distance ?? Number.NaN;
		console.log(`${p.q}\t${p.expectMatch}\t${dist.toFixed(3)}\t${top?.naam ?? "—"}`);
		(p.expectMatch ? positives : negatives).push(dist);
	}
	const maxPos = Math.max(...positives);
	const minNeg = Math.min(...negatives);
	console.log("\nKalibratie-resultaat:");
	console.log(`  max distance bij relevante queries: ${maxPos.toFixed(3)}`);
	console.log(`  min distance bij irrelevante queries: ${minNeg.toFixed(3)}`);
	if (minNeg > maxPos) {
		const suggested = ((maxPos + minNeg) / 2).toFixed(2);
		console.log(`  ✔ Veilige threshold: ${suggested} (midden tussen beide groepen)`);
	} else {
		console.log(
			`  ⚠ Overlap — geen veilige threshold uit deze set. Breid PROBES uit of accepteer dat sommige edge-cases handmatig gemarkeerd moeten worden.`,
		);
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
