import type { Prisma } from "@/generated/prisma/index.js";
import { createEmbedding } from "@/lib/ai/embeddings.js";
import { ChatSDKError } from "@/lib/errors.js";
import * as repo from "./subsidieregeling.repository.js";
import {
	SubsidieRegelingConceptSchema,
	SubsidieRegelingPublishableSchema,
	type SubsidieRegelingConceptInput,
	type SubsidieRegelingUpdateInput,
	type SubsidieRegelingListQuery,
} from "./subsidieregeling.types.js";

const EMBEDDING_MODEL_NAME = "text-embedding-3-small";

/** Resterende dagen-drempels voor het vervaldatum-dashboard. */
const DASHBOARD_THRESHOLDS = [
	{ key: "binnen7", days: 7 },
	{ key: "binnen30", days: 30 },
	{ key: "binnen90", days: 90 },
] as const;

export async function getById(id: string) {
	const regeling = await repo.findById(id);
	if (!regeling) {
		throw new ChatSDKError("not_found:document", "Subsidieregeling niet gevonden");
	}
	return regeling;
}

export function list(query: SubsidieRegelingListQuery) {
	return repo.findManyForAdmin(query);
}

export async function createConcept(
	input: SubsidieRegelingConceptInput,
	userId: string | null,
) {
	const parsed = SubsidieRegelingConceptSchema.parse(input);
	const regeling = await repo.create({ ...parsed, createdByUserId: userId });
	await repo.addAuditEvent({
		regelingId: regeling.id,
		userId,
		actie: "CREATE",
		message: "Regeling aangemaakt als concept",
	});
	return regeling;
}

export async function updateRegeling(
	id: string,
	input: SubsidieRegelingUpdateInput,
	userId: string | null,
) {
	const existing = await getById(id);
	if (existing.status === "VERLOPEN" || existing.status === "GEARCHIVEERD_VERVANGEN") {
		throw new ChatSDKError(
			"bad_request:api",
			"Verlopen of gearchiveerde regelingen kunnen niet meer worden bewerkt",
		);
	}
	const updated = await repo.updateFields(id, input);
	await repo.addAuditEvent({
		regelingId: id,
		userId,
		actie: "UPDATE",
		diff: toJsonInput(input),
	});

	// Een gepubliceerde regeling die door deze update niet meer aan de
	// verplichte publicatie-velden voldoet mag niet ACTIEF blijven: terug
	// naar concept zodat een beheerder hem eerst compleet maakt.
	if (existing.status === "ACTIEF") {
		const validation = SubsidieRegelingPublishableSchema.safeParse(updated);
		if (!validation.success) {
			const ontbrekend = validation.error.issues
				.map((issue) => issue.path.join("."))
				.join(", ");
			await repo.setStatus(id, "CONCEPT");
			await repo.addAuditEvent({
				regelingId: id,
				userId,
				actie: "UPDATE",
				message: `Teruggezet naar concept — verplichte velden onvolledig: ${ontbrekend}`,
			});
			return { ...updated, status: "CONCEPT" as const };
		}
	}

	return updated;
}

/**
 * Verwijder een concept definitief. Alleen status CONCEPT is verwijderbaar:
 * gepubliceerde of gearchiveerde regelingen hebben versie- en audit-historie
 * die bewaard moet blijven (daarvoor bestaat archiveren). Versies en
 * audit-events cascaden mee via het schema. Een concept dat uit de CVDR-sync
 * kwam, komt bij de volgende sync-run terug — geaccepteerd gedrag.
 */
export async function deleteConcept(id: string) {
	const existing = await getById(id);
	if (existing.status !== "CONCEPT") {
		throw new ChatSDKError(
			"bad_request:api",
			"Alleen concepten kunnen worden verwijderd; gebruik archiveren voor gepubliceerde regelingen",
		);
	}
	await repo.deleteById(id);
}

/**
 * Publiceer een regeling. Doorloopt:
 *   1. Verplichte-veldenvalidatie.
 *   2. Embedding berekenen. Faalt deze: niets in DB
 *      aangepast, audit PUBLISH_FAILED, status blijft CONCEPT.
 *   3. Snapshot in SubsidieRegelingVersie.
 *   4. Status -> ACTIEF.
 *   5. Embedding opslaan + audit PUBLISH.
 *
 * Halve publicaties zijn niet mogelijk: versie-record en ACTIEF-status
 * worden alleen geschreven na succesvolle embedding.
 */
/**
 * Publiceer een concept. Bij optionele `vervangtId` wordt de oude regeling
 * direct na succesvolle publicatie van de nieuwe gearchiveerd met
 * vervangenDoorId, zodat beheerders de "deze vervangt X"-link al bij creatie
 * kunnen opgeven ipv achteraf op de oude regeling te moeten klikken.
 */
export async function publishRegeling(
	id: string,
	userId: string | null,
	vervangtId?: string,
) {
	const existing = await getById(id);
	const validation = SubsidieRegelingPublishableSchema.safeParse(existing);
	if (!validation.success) {
		throw new ChatSDKError(
			"bad_request:api",
			`Niet publiceerbaar - ontbrekende velden: ${validation.error.issues
				.map((i) => i.path.join("."))
				.join(", ")}`,
		);
	}

	// 1. Probeer eerst de embedding (externe call). Faalt deze: niets in DB
	//    aangepast, simpele audit + rethrow. Geen versie-record, geen
	//    status-flap, geen rollback nodig.
	let embedding: number[];
	try {
		embedding = await createEmbedding(buildEmbeddingText(existing));
	} catch (error) {
		await repo.addAuditEvent({
			regelingId: id,
			userId,
			actie: "PUBLISH_FAILED",
			message:
				error instanceof Error
					? `Embedding-stap faalde: ${error.message}`
					: "Embedding-stap faalde",
		});
		throw new ChatSDKError(
			"bad_request:api",
			"Embedding-stap faalde; regeling blijft in concept",
		);
	}

	// 2. Embedding gelukt — alle resterende stappen zijn DB-only. Partial
	//    failure tussen addVersie/setStatus/setEmbedding zou nog steeds een
	//    orphan kunnen creëren bij DB-uitval, maar dat is een infra-issue
	//    (monitorbaar) en geen externe-call latency-issue zoals daarvoor.
	const versienummer = await repo.nextVersienummer(id);
	await repo.addVersie({
		regelingId: id,
		versienummer,
		payload: toJsonInput(snapshotPayload(existing)),
		gepubliceerdDoorUserId: userId,
	});
	await repo.setStatus(id, "ACTIEF");
	await repo.setEmbedding(id, embedding, EMBEDDING_MODEL_NAME);
	await repo.addAuditEvent({
		regelingId: id,
		userId,
		actie: "PUBLISH",
		message: `Versie ${versienummer} gepubliceerd`,
	});

	// 3. Optionele "vervangt"-relatie: archiveer de aangewezen oude regeling
	//    nu de nieuwe ACTIEF is. Faalt deze stap, dan blijft de nieuwe gewoon
	//    actief en gooien we de fout door — beheerder kan handmatig de oude
	//    archiveren of opnieuw proberen.
	if (vervangtId && vervangtId !== id) {
		await archiveAsReplacedBy(vervangtId, id, userId);
	}

	return repo.findById(id);
}

export async function archiveAsReplacedBy(
	id: string,
	opvolgerId: string,
	userId: string | null,
) {
	if (id === opvolgerId) {
		throw new ChatSDKError("bad_request:api", "Opvolger kan niet dezelfde regeling zijn");
	}
	const opvolger = await repo.findById(opvolgerId);
	if (!opvolger) {
		throw new ChatSDKError("not_found:document", "Opvolger-regeling niet gevonden");
	}
	if (opvolger.status !== "ACTIEF") {
		throw new ChatSDKError(
			"bad_request:api",
			"Opvolger moet status ACTIEF hebben",
		);
	}
	// Zorg dat de te-archiveren regeling bestaat en een embedding heeft.
	// Zonder embedding wordt zij niet meer teruggevonden door searchActive
	// en kan de "vervangen door"-melding nooit triggeren bij vragen naar
	// deze oude regeling.
	const teArchiveren = await repo.findById(id);
	if (!teArchiveren) {
		throw new ChatSDKError("not_found:document", "Te-archiveren regeling niet gevonden");
	}
	if (!teArchiveren.embeddedAt) {
		const embedding = await createEmbedding(buildEmbeddingText(teArchiveren));
		await repo.setEmbedding(id, embedding, EMBEDDING_MODEL_NAME);
	}

	await repo.setVervangenDoor(id, opvolgerId);
	await repo.addAuditEvent({
		regelingId: id,
		userId,
		actie: "REPLACE",
		message: `Vervangen door ${opvolger.naam}`,
		diff: { vervangenDoorId: opvolgerId },
	});
	return repo.findById(id);
}

export async function markExpired(id: string) {
	const updated = await repo.setStatus(id, "VERLOPEN");
	await repo.addAuditEvent({
		regelingId: id,
		userId: null,
		actie: "EXPIRE",
		message: "Automatisch verlopen na vervaldatum",
	});
	return updated;
}

/**
 * Handmatig archiveren door een beheerder (geen opvolger). Sluit de regeling
 * uit van searchActive zonder verloopdatum af te wachten. Gebruik
 * archiveAsReplacedBy als er wél een opvolger is.
 */
export async function archiveRegeling(id: string, userId: string | null) {
	const existing = await getById(id);
	if (existing.status === "GEARCHIVEERD" || existing.status === "GEARCHIVEERD_VERVANGEN") {
		throw new ChatSDKError("bad_request:api", "Regeling is al gearchiveerd");
	}
	await repo.setStatus(id, "GEARCHIVEERD");
	await repo.addAuditEvent({
		regelingId: id,
		userId,
		actie: "ARCHIVE",
		message: "Handmatig gearchiveerd door beheerder",
	});
	return repo.findById(id);
}

/**
 * Heractiveer een handmatig gearchiveerde regeling. Geldt alleen voor
 * status GEARCHIVEERD; GEARCHIVEERD_VERVANGEN draaien we niet terug omdat
 * de opvolger-relatie en bijbehorende chat-melding verwarrend zouden blijven
 * hangen. Embedding blijft staan — geen herberekening nodig.
 */
export async function unarchiveRegeling(id: string, userId: string | null) {
	const existing = await getById(id);
	if (existing.status !== "GEARCHIVEERD") {
		throw new ChatSDKError(
			"bad_request:api",
			"Alleen handmatig gearchiveerde regelingen kunnen worden heractiveerd",
		);
	}
	await repo.setStatus(id, "ACTIEF");
	await repo.addAuditEvent({
		regelingId: id,
		userId,
		actie: "UNARCHIVE",
		message: "Uit archief gehaald door beheerder",
	});
	return repo.findById(id);
}

export async function recordDeadLinkCheck(
	regelingId: string,
	currentDeadLinkSince: Date | null,
	failed: boolean,
) {
	const now = new Date();
	if (failed) {
		if (!currentDeadLinkSince) {
			await repo.setDeadLinkState(regelingId, {
				deadLinkSince: now,
				lastDeadLinkCheckAt: now,
			});
			await repo.addAuditEvent({
				regelingId,
				userId: null,
				actie: "DEAD_LINK",
				message: "Bron-URL onbereikbaar",
			});
		} else {
			await repo.setDeadLinkState(regelingId, {
				deadLinkSince: currentDeadLinkSince,
				lastDeadLinkCheckAt: now,
			});
		}
		return;
	}
	if (currentDeadLinkSince) {
		await repo.setDeadLinkState(regelingId, {
			deadLinkSince: null,
			lastDeadLinkCheckAt: now,
		});
		await repo.addAuditEvent({
			regelingId,
			userId: null,
			actie: "DEAD_LINK_RESOLVED",
			message: "Bron-URL weer bereikbaar",
		});
	} else {
		await repo.setDeadLinkState(regelingId, {
			deadLinkSince: null,
			lastDeadLinkCheckAt: now,
		});
	}
}

export async function getHistory(id: string) {
	const regeling = await getById(id);
	const [versies, auditEvents] = await Promise.all([
		repo.listVersies(id),
		repo.listAuditEvents(id),
	]);
	return { regeling, versies, auditEvents };
}

export async function getDashboard() {
	const regelingen = await repo.findActiveForDashboard();
	const now = new Date();
	const buckets: Record<string, typeof regelingen> = {
		binnen7: [],
		binnen30: [],
		binnen90: [],
	};
	const deadLinks: typeof regelingen = [];
	for (const r of regelingen) {
		if (r.deadLinkSince) {
			deadLinks.push(r);
		}
		if (!r.vervaldatum) continue;
		const daysRemaining = Math.ceil(
			(r.vervaldatum.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		);
		for (const threshold of DASHBOARD_THRESHOLDS) {
			if (daysRemaining <= threshold.days) {
				buckets[threshold.key].push(r);
				break;
			}
		}
	}
	return { ...buckets, deadLinks };
}

/** Coerce naar Prisma's strikte JSON-input type via een veilige round-trip. */
function toJsonInput(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function snapshotPayload(
	regeling: Awaited<ReturnType<typeof repo.findById>>,
): Record<string, unknown> {
	if (!regeling) return {};
	return {
		naam: regeling.naam,
		doel: regeling.doel,
		voorwaarden: regeling.voorwaarden,
		aanvraagprocedure: regeling.aanvraagprocedure,
		bronUrl: regeling.bronUrl,
		bronType: regeling.bronType,
		doelgroepNaam: regeling.doelgroepNaam,
		doelgroepCluster: regeling.doelgroepCluster,
		vervaldatum: regeling.vervaldatum?.toISOString() ?? null,
		looptijdStart: regeling.looptijdStart?.toISOString() ?? null,
		looptijdEind: regeling.looptijdEind?.toISOString() ?? null,
		maxBedragAanvrager: regeling.maxBedragAanvrager?.toString() ?? null,
		totaalSubsidiePlafond: regeling.totaalSubsidiePlafond?.toString() ?? null,
		plafonds: regeling.plafonds ?? null,
	};
}

/**
 * Tekstuele samenvatting van de regeling voor embedding. Bevat alle
 * inhoudelijke velden zodat zowel doelgroep-vragen als situatiebeschrijvingen
 * goed gematcht worden.
 */
function buildEmbeddingText(regeling: NonNullable<Awaited<ReturnType<typeof repo.findById>>>) {
	const onderdelen = [
		`Regeling: ${regeling.naam}`,
		`Doelgroep: ${regeling.doelgroepNaam} (${regeling.doelgroepCluster})`,
		`Doel: ${regeling.doel}`,
		`Voorwaarden: ${regeling.voorwaarden}`,
		`Aanvraagprocedure: ${regeling.aanvraagprocedure}`,
	];
	if (regeling.maxBedragAanvrager) {
		onderdelen.push(`Max. per aanvrager: ${regeling.maxBedragAanvrager}`);
	}
	if (regeling.totaalSubsidiePlafond) {
		onderdelen.push(`Totaal subsidieplafond: ${regeling.totaalSubsidiePlafond}`);
	}
	if (regeling.vervaldatum) {
		onderdelen.push(`Vervaldatum: ${regeling.vervaldatum.toISOString().slice(0, 10)}`);
	}
	return onderdelen.join("\n");
}
