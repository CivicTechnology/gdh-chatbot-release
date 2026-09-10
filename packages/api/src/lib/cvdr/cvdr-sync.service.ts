import { prisma } from "../db/prisma.js";
import { publishRegeling } from "@/domains/subsidieregeling/subsidieregeling.service.js";
import { SubsidieRegelingPublishableSchema } from "@/domains/subsidieregeling/subsidieregeling.types.js";
import {
	dedupeToLatestVersion,
	fetchAllRegelingen,
} from "./cvdr.collector.js";
import {
	extractFieldsFromXml,
	fetchCvdrXml,
} from "./cvdr.extractor.js";
import type { CvdrRegeling } from "./cvdr.types.js";
import type { CvdrSyncEvent, CvdrSyncMode } from "./cvdr-sync.events.js";

const PROCESSING_CONCURRENCY = 10;

export type CvdrSyncOptions = {
	modifiedSince?: string;
	/**
	 * "update" (default): sla regelingen over waarvan de CVDR-versie-id gelijk
	 * is aan wat we al opgeslagen hebben — geen XML-fetch, geen AI-extractie,
	 * geen re-publish. "reprocess": verwerk altijd alles opnieuw, ook als de
	 * versie identiek is. Bedoeld voor prompt-aanpassingen of veld-uitbreidingen.
	 */
	mode?: CvdrSyncMode;
	/**
	 * Annuleert de sync wanneer geaborteerd. De generator yieldt een `fatal`-
	 * event met message "geannuleerd" en returnt. In-flight fetch en AI-calls
	 * worden onderbroken via dezelfde signal.
	 */
	signal?: AbortSignal;
};

class SyncAbortedError extends Error {
	constructor() {
		super("geannuleerd");
		this.name = "SyncAbortedError";
	}
}

function checkAbort(signal: AbortSignal | undefined): void {
	if (signal?.aborted) throw new SyncAbortedError();
}

/**
 * Voer een CVDR → SubsidieRegeling sync uit. Yield events real-time tijdens
 * de run zodat zowel CLI (stdout) als SSE (browser) live voortgang kunnen
 * tonen. Mislukte records blokkeren de rest niet.
 *
 * Per regeling: XML downloaden → AI-extractie → DB-upsert, allemaal in
 * dezelfde worker. Workers draaien {@link PROCESSING_CONCURRENCY} parallel,
 * dus rijen verschijnen meteen in de admin-tabel zodra een regeling klaar is.
 *
 * `vervangenDoorId` wordt na de hoofdfase opgelost, omdat het opvolger-
 * record op het moment van upsert nog niet in de DB hoeft te staan.
 *
 * Modes:
 * - `update` (default): skip regelingen waarvan de SRU-versie-id niet
 *   veranderd is t.o.v. het opgeslagen `cvdrVersieId`. Snelle re-runs.
 * - `reprocess`: verwerk altijd alles, ook bij gelijke versie. Bedoeld voor
 *   prompt-aanpassingen of veld-uitbreidingen in de extractor.
 *
 * Status-mapping:
 * - Records met verstreken `uitwerkingtredingDatum` krijgen status `VERLOPEN`.
 * - Overige records komen binnen als `CONCEPT` (admin reviewt → ACTIEF).
 * - Bestaande gepubliceerde regelingen (ACTIEF/GEARCHIVEERD/GEARCHIVEERD_VERVANGEN)
 *   krijgen geen status-reset bij re-sync; alleen inhoudelijke velden updaten.
 */
export async function* runCvdrSync(
	options: CvdrSyncOptions = {},
): AsyncGenerator<CvdrSyncEvent> {
	const t0 = Date.now();
	const today = new Date().toISOString().slice(0, 10);
	const { signal } = options;
	const mode: CvdrSyncMode = options.mode ?? "update";

	try {
		yield { type: "start", today, modifiedSince: options.modifiedSince, mode };

		checkAbort(signal);
		const allVersies = await fetchAllRegelingen({
			modifiedSince: options.modifiedSince,
			signal,
		});
		checkAbort(signal);
		const werken = dedupeToLatestVersion(allVersies);
		yield {
			type: "fetched",
			versies: allVersies.length,
			werken: werken.length,
		};

		if (werken.length === 0) {
			yield buildCompleteEvent(t0, allVersies.length, 0, 0, 0, 0, 0, 0);
			return;
		}

		const stats = { created: 0, updated: 0, skipped: 0, failed: 0 };
		const opvolgerHints: Array<{ dbId: string; opvolgerVan: string }> = [];

		yield* streamProcessing(werken, today, mode, signal, (outcome) => {
			if (outcome.type === "success") {
				if (outcome.action === "created") stats.created++;
				else if (outcome.action === "updated") stats.updated++;
				else stats.skipped++;
				if (outcome.opvolgerVan) {
					opvolgerHints.push({
						dbId: outcome.dbId,
						opvolgerVan: outcome.opvolgerVan,
					});
				}
			} else {
				stats.failed++;
			}
		});

		const relStats = { resolved: 0, missingTarget: 0 };
		for (const { dbId, opvolgerVan } of opvolgerHints) {
			checkAbort(signal);
			const opvolger = await prisma.subsidieRegeling.findFirst({
				where: { bronUrl: workUrlForWerkId(opvolgerVan) },
				select: { id: true },
			});
			if (!opvolger) {
				relStats.missingTarget++;
				continue;
			}
			await prisma.subsidieRegeling.update({
				where: { id: dbId },
				data: { vervangenDoorId: opvolger.id },
			});
			relStats.resolved++;
		}
		yield {
			type: "vervangen-resolved",
			resolved: relStats.resolved,
			missingTarget: relStats.missingTarget,
		};

		yield buildCompleteEvent(
			t0,
			allVersies.length,
			werken.length,
			stats.created,
			stats.updated,
			stats.skipped,
			stats.failed,
			relStats.resolved,
		);
	} catch (error) {
		if (error instanceof SyncAbortedError) {
			yield {
				type: "fatal",
				message: "Synchronisatie geannuleerd door beheerder",
			};
			return;
		}
		throw error;
	}
}

type ProcessingOutcome =
	| {
			type: "success";
			record: CvdrRegeling;
			dbId: string;
			action: "created" | "updated" | "skipped";
			status: "CONCEPT" | "VERLOPEN" | "ACTIEF";
			opvolgerVan: string | null;
	  }
	| { type: "failure"; record: CvdrRegeling; error: Error };

/**
 * Verwerk records concurrent: per regeling extract + upsert binnen dezelfde
 * worker, en yield één `regeling-progress`-event zodra de regeling klaar is
 * (success of failure). Gebruikt een promise-queue zodat events in
 * voltooiingsvolgorde naar de consumer komen ipv per-worker.
 *
 * In `update`-mode wordt eerst gekeken of de SRU-versie-id al gelijk is aan
 * `cvdrVersieId` in de DB. Zo ja: skip — geen netwerk- of AI-calls.
 */
async function* streamProcessing(
	records: CvdrRegeling[],
	today: string,
	mode: CvdrSyncMode,
	signal: AbortSignal | undefined,
	onOutcome: (outcome: ProcessingOutcome) => void,
): AsyncGenerator<CvdrSyncEvent> {
	checkAbort(signal);
	const queue: ProcessingOutcome[] = [];
	let pendingResolve: (() => void) | null = null;

	function enqueue(outcome: ProcessingOutcome) {
		queue.push(outcome);
		pendingResolve?.();
		pendingResolve = null;
	}

	let cursor = 0;
	let inFlight = 0;
	const workers: Promise<void>[] = [];

	for (
		let i = 0;
		i < Math.min(PROCESSING_CONCURRENCY, records.length);
		i++
	) {
		workers.push(
			(async () => {
				while (cursor < records.length) {
					if (signal?.aborted) break;
					const record = records[cursor++];
					inFlight++;
					try {
						if (mode === "update") {
							const existing = await findExistingByWorkUrl(record.workUrl);
							if (existing && existing.cvdrVersieId === record.versieId) {
								// Versheids-stempel + metadata-backfill: deze velden komen
								// direct uit de SRU-respons, dus ook bij een skip (geen
								// XML-fetch of AI-extractie) houden we ze goedkoop bij.
								// Raw SQL zodat Prisma's @updatedAt niet bumpt op een
								// inhoudelijk onveranderde regeling.
								await touchBronMetadata(existing.id, record);
								enqueue({
									type: "success",
									record,
									dbId: existing.id,
									action: "skipped",
									status: existing.status,
									opvolgerVan: null,
								});
								inFlight--;
								continue;
							}
						}
						const xml = await fetchCvdrXml(record.xmlUrl, signal);
						const fields = await extractFieldsFromXml(xml, {
							titel: record.titel,
							signal,
						});
						const result = await upsertRegeling(record, fields, today);
						// Auto-publish: zet de regeling direct ACTIEF zodat hij meteen
						// zichtbaar is voor de chatbot. Valt terug op CONCEPT als de
						// AI-extractie niet aan de publish-validatie voldoet (bv. te
						// korte voorwaarden) of als de embedding-call faalt — die
						// regelingen blijven achter voor handmatige review.
						let finalStatus: "CONCEPT" | "VERLOPEN" | "ACTIEF" =
							result.status;
						if (result.status === "CONCEPT") {
							try {
								await publishRegeling(result.id, null);
								finalStatus = "ACTIEF";
							} catch {
								// publish faalde — record blijft CONCEPT
							}
						}
						enqueue({
							type: "success",
							record,
							dbId: result.id,
							action: result.action,
							status: finalStatus,
							opvolgerVan: record.opvolgerVan,
						});
					} catch (error) {
						enqueue({
							type: "failure",
							record,
							error: error instanceof Error ? error : new Error(String(error)),
						});
					}
					inFlight--;
				}
			})(),
		);
	}

	const allWorkersDone = Promise.all(workers).then(() => {
		pendingResolve?.();
		pendingResolve = null;
	});

	const abortHandler = () => {
		pendingResolve?.();
		pendingResolve = null;
	};
	signal?.addEventListener("abort", abortHandler, { once: true });

	let consumed = 0;

	try {
		while (consumed < records.length) {
			if (signal?.aborted && queue.length === 0 && inFlight === 0) break;
			if (queue.length === 0) {
				if (inFlight === 0 && cursor >= records.length) break;
				await new Promise<void>((resolve) => {
					pendingResolve = resolve;
				});
				continue;
			}
			const outcome = queue.shift()!;
			consumed++;
			onOutcome(outcome);
			if (outcome.type === "failure") {
				yield {
					type: "regeling-progress",
					werkId: outcome.record.werkId,
					titel: outcome.record.titel,
					done: consumed,
					total: records.length,
					outcome: "failed",
					error: outcome.error.message,
				};
			} else {
				yield {
					type: "regeling-progress",
					werkId: outcome.record.werkId,
					titel: outcome.record.titel,
					dbId: outcome.dbId,
					done: consumed,
					total: records.length,
					outcome: outcome.action,
					status: outcome.status,
				};
			}
		}
	} finally {
		signal?.removeEventListener("abort", abortHandler);
	}

	await allWorkersDone;
}

function buildCompleteEvent(
	t0: number,
	versies: number,
	werken: number,
	created: number,
	updated: number,
	skipped: number,
	failed: number,
	vervangenResolved: number,
): CvdrSyncEvent {
	return {
		type: "complete",
		stats: {
			versies,
			werken,
			created,
			updated,
			skipped,
			failed,
			vervangenResolved,
			totalMs: Date.now() - t0,
		},
	};
}

function isExpired(record: CvdrRegeling, today: string): boolean {
	return Boolean(
		record.uitwerkingtredingDatum && record.uitwerkingtredingDatum <= today,
	);
}

function workUrlForWerkId(werkId: string): string {
	return `https://lokaleregelgeving.overheid.nl/${werkId}`;
}

async function findExistingByWorkUrl(workUrl: string): Promise<{
	id: string;
	status: "CONCEPT" | "VERLOPEN" | "ACTIEF";
	cvdrVersieId: string | null;
} | null> {
	const row = await prisma.subsidieRegeling.findFirst({
		where: { bronUrl: workUrl },
		select: { id: true, status: true, cvdrVersieId: true },
	});
	if (!row) return null;
	// Skipped records moeten een chatbot-zichtbare status doorgeven; mapping
	// hieronder normaliseert de Prisma-enum naar het smallere event-type.
	const normalized: "CONCEPT" | "VERLOPEN" | "ACTIEF" =
		row.status === "ACTIEF" ||
		row.status === "GEARCHIVEERD" ||
		row.status === "GEARCHIVEERD_VERVANGEN"
			? "ACTIEF"
			: row.status === "VERLOPEN"
				? "VERLOPEN"
				: "CONCEPT";
	return { id: row.id, status: normalized, cvdrVersieId: row.cvdrVersieId };
}

/**
 * Skip-route van de update-sync: stempel `bronGecontroleerdOp` en vul
 * SRU-metadata aan waar die nog ontbreekt. Raw SQL i.p.v. Prisma-update
 * zodat `updatedAt` niet verschuift voor een inhoudelijk onveranderde
 * regeling (zie ook het advies over "laatst bijgewerkt"-semantiek).
 */
async function touchBronMetadata(
	id: string,
	record: CvdrRegeling,
): Promise<void> {
	const issued = record.issuedDate ? new Date(record.issuedDate) : null;
	const modified = record.modifiedDate ? new Date(record.modifiedDate) : null;
	const terugwerkend = record.terugwerkendekrachtDatum
		? new Date(record.terugwerkendekrachtDatum)
		: null;
	await prisma.$executeRaw`
		UPDATE "SubsidieRegeling" SET
			"bronGecontroleerdOp" = NOW(),
			"publicatieDatum" = COALESCE("publicatieDatum", ${issued}),
			"bronGewijzigdOp" = COALESCE("bronGewijzigdOp", ${modified}),
			"grondslag" = COALESCE("grondslag", ${record.grondslag}),
			"grondslagUrl" = COALESCE("grondslagUrl", ${record.grondslagUrl}),
			"bekendmakingKenmerk" = COALESCE("bekendmakingKenmerk", ${record.bekendmakingKenmerk}),
			"bekendmakingUrl" = COALESCE("bekendmakingUrl", ${record.bekendmakingUrl}),
			"betreft" = COALESCE("betreft", ${record.betreft}),
			"kenmerk" = COALESCE("kenmerk", ${record.kenmerk}),
			"thema" = COALESCE("thema", ${record.subject}),
			"vastgesteldDoor" = COALESCE("vastgesteldDoor", ${record.ratifier}),
			"terugwerkendeKrachtTot" = COALESCE("terugwerkendeKrachtTot", ${terugwerkend}),
			"externeBijlage" = COALESCE("externeBijlage", ${record.externeBijlage})
		WHERE "id" = ${id}::uuid
	`;
}

async function upsertRegeling(
	record: CvdrRegeling,
	fields: {
		doel: string;
		voorwaarden: string;
		aanvraagprocedure: string;
		doelgroepNaam: string;
		doelgroepCluster: "PARTICULIER" | "BEDRIJF" | "MAATSCHAPPELIJK";
		maxBedragAanvrager: number | null;
		totaalSubsidiePlafond: number | null;
		plafonds: Array<{
			doelgroepCluster: "PARTICULIER" | "BEDRIJF" | "MAATSCHAPPELIJK";
			doelgroepNaam: string;
			maxBedragAanvrager: number | null;
			totaalSubsidiePlafond: number | null;
			omschrijving: string;
		}>;
	},
	today: string,
): Promise<{
	id: string;
	action: "created" | "updated";
	status: "CONCEPT" | "VERLOPEN";
}> {
	const bronUrl = record.workUrl;
	const status: "CONCEPT" | "VERLOPEN" = isExpired(record, today)
		? "VERLOPEN"
		: "CONCEPT";

	const existing = await prisma.subsidieRegeling.findFirst({
		where: { bronUrl },
		select: { id: true, status: true, cvdrVersieId: true },
	});

	const looptijdStart = record.inwerkingtredingDatum
		? new Date(record.inwerkingtredingDatum)
		: null;
	const vervaldatum = record.uitwerkingtredingDatum
		? new Date(record.uitwerkingtredingDatum)
		: null;
	const publicatieDatum = record.issuedDate ? new Date(record.issuedDate) : null;

	// bronGewijzigdOp markeert een inhoudelijke wijziging bij de bron en
	// schuift alleen op bij een nieuwe CVDR-versie. Een reprocess van dezelfde
	// versie (bv. na prompt-aanpassing) laat hem staan.
	const versieChanged =
		!existing || existing.cvdrVersieId !== record.versieId;

	const data = {
		naam: record.titel,
		doel: fields.doel,
		voorwaarden: fields.voorwaarden,
		aanvraagprocedure: fields.aanvraagprocedure,
		bronUrl,
		bronType: "LOKALEREGELGEVING" as const,
		cvdrVersieId: record.versieId,
		doelgroepNaam: fields.doelgroepNaam,
		doelgroepCluster: fields.doelgroepCluster,
		maxBedragAanvrager: fields.maxBedragAanvrager,
		totaalSubsidiePlafond: fields.totaalSubsidiePlafond,
		plafonds: fields.plafonds,
		looptijdStart,
		vervaldatum,
		publicatieDatum,
		grondslag: record.grondslag,
		grondslagUrl: record.grondslagUrl,
		bekendmakingKenmerk: record.bekendmakingKenmerk,
		bekendmakingUrl: record.bekendmakingUrl,
		betreft: record.betreft,
		kenmerk: record.kenmerk,
		thema: record.subject,
		vastgesteldDoor: record.ratifier,
		terugwerkendeKrachtTot: record.terugwerkendekrachtDatum
			? new Date(record.terugwerkendekrachtDatum)
			: null,
		externeBijlage: record.externeBijlage,
		bronGecontroleerdOp: new Date(),
		...(versieChanged
			? {
					bronGewijzigdOp: record.modifiedDate
						? new Date(record.modifiedDate)
						: null,
				}
			: {}),
	};

	if (existing) {
		const isPublished =
			existing.status === "ACTIEF" ||
			existing.status === "GEARCHIVEERD" ||
			existing.status === "GEARCHIVEERD_VERVANGEN";
		// Een ACTIEF-regeling die door de nieuwe bron-data niet meer aan de
		// verplichte publicatie-velden voldoet gaat terug naar CONCEPT; anders
		// blijft er een onvolledige regeling zichtbaar voor de chatbot.
		const validation = SubsidieRegelingPublishableSchema.safeParse(data);
		const demoteToConcept = existing.status === "ACTIEF" && !validation.success;
		const updated = await prisma.subsidieRegeling.update({
			where: { id: existing.id },
			data: {
				...data,
				...(demoteToConcept
					? { status: "CONCEPT" as const }
					: isPublished
						? {}
						: { status }),
			},
		});
		await prisma.subsidieRegelingAuditEvent.create({
			data: {
				regelingId: updated.id,
				userId: null,
				actie: "UPDATE",
				message: demoteToConcept
					? `CVDR-sync ${record.versieId} — teruggezet naar concept: verplichte velden onvolledig`
					: `CVDR-sync ${record.versieId}`,
			},
		});
		return { id: updated.id, action: "updated", status };
	}

	const created = await prisma.subsidieRegeling.create({
		data: { ...data, status, createdByUserId: null },
	});
	await prisma.subsidieRegelingAuditEvent.create({
		data: {
			regelingId: created.id,
			userId: null,
			actie: "CREATE",
			message: `CVDR-sync import van ${record.versieId}`,
		},
	});
	return { id: created.id, action: "created", status };
}
