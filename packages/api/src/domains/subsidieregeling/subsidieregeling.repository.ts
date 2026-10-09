import type { Prisma, SubsidieRegeling } from "@/generated/prisma/index.js";
import { prisma } from "@/lib/db/prisma.js";
import type {
	SubsidieRegelingListQuery,
	SubsidieRegelingConceptInput,
	SubsidieRegelingUpdateInput,
} from "./subsidieregeling.types.js";

/** Vaste set status-overgangen die zichtbaar zijn in het openbare zoekkanaal. */
const PUBLIC_STATUSES: Prisma.SubsidieRegelingWhereInput = {
	status: { in: ["ACTIEF"] },
};

export function findById(id: string) {
	return prisma.subsidieRegeling.findUnique({
		where: { id },
		include: {
			vervangenDoor: { select: { id: true, naam: true, bronUrl: true } },
		},
	});
}

export async function findManyForAdmin(query: SubsidieRegelingListQuery) {
	// Basisfilter zonder status — gebruikt voor zowel de status-aggregatie
	// (zodat de checkboxen totalen tonen, niet alleen wat in de view zit) als
	// voor de eigenlijke lijst (waar status er bovenop komt).
	const baseWhere: Prisma.SubsidieRegelingWhereInput = {};

	if (query.doelgroepCluster) {
		baseWhere.doelgroepCluster = query.doelgroepCluster;
	}

	if (query.search?.trim()) {
		baseWhere.OR = [
			{ naam: { contains: query.search, mode: "insensitive" } },
			{ doel: { contains: query.search, mode: "insensitive" } },
			{ doelgroepNaam: { contains: query.search, mode: "insensitive" } },
		];
	}

	const where: Prisma.SubsidieRegelingWhereInput = { ...baseWhere };

	if (query.statuses !== undefined) {
		// Expliciete keuze van de gebruiker — ook een lege array betekent
		// "niets tonen", niet "fall back to defaults". Prisma's `in: []`
		// matched geen rijen, wat exact het gewenste gedrag is.
		where.status = { in: query.statuses };
	} else if (query.status) {
		where.status = query.status;
	} else if (!query.includeArchived) {
		where.status = { in: ["CONCEPT", "ACTIEF"] };
	}

	const [regelingen, total, statusGroups] = await prisma.$transaction([
		prisma.subsidieRegeling.findMany({
			where,
			orderBy: { [query.sort]: query.order },
			take: query.take,
			skip: query.skip,
			include: {
				vervangenDoor: { select: { id: true, naam: true } },
			},
		}),
		prisma.subsidieRegeling.count({ where }),
		prisma.subsidieRegeling.groupBy({
			by: ["status"],
			where: baseWhere,
			_count: true,
			orderBy: { status: "asc" },
		}),
	]);

	const statusCounts: Record<string, number> = {
		ACTIEF: 0,
		CONCEPT: 0,
		VERLOPEN: 0,
		GEARCHIVEERD: 0,
		GEARCHIVEERD_VERVANGEN: 0,
	};
	for (const group of statusGroups) {
		statusCounts[group.status] =
			typeof group._count === "number" ? group._count : 0;
	}

	return { regelingen, total, statusCounts };
}

export function findPublic() {
	return prisma.subsidieRegeling.findMany({
		where: PUBLIC_STATUSES,
		orderBy: { vervaldatum: "asc" },
	});
}

export function create(data: SubsidieRegelingConceptInput & { createdByUserId?: string | null }) {
	return prisma.subsidieRegeling.create({
		data: {
			naam: data.naam,
			doel: data.doel,
			voorwaarden: data.voorwaarden,
			aanvraagprocedure: data.aanvraagprocedure,
			bronUrl: data.bronUrl,
			bronType: data.bronType,
			doelgroepNaam: data.doelgroepNaam,
			doelgroepCluster: data.doelgroepCluster,
			vervaldatum: data.vervaldatum ?? null,
			looptijdStart: data.looptijdStart ?? null,
			looptijdEind: data.looptijdEind ?? null,
			maxBedragAanvrager: data.maxBedragAanvrager ?? null,
			totaalSubsidiePlafond: data.totaalSubsidiePlafond ?? null,
			...(data.plafonds !== undefined ? { plafonds: data.plafonds } : {}),
			status: "CONCEPT",
			createdByUserId: data.createdByUserId ?? null,
		},
	});
}

export function updateFields(id: string, data: SubsidieRegelingUpdateInput) {
	return prisma.subsidieRegeling.update({
		where: { id },
		data: {
			...(data.naam !== undefined ? { naam: data.naam } : {}),
			...(data.doel !== undefined ? { doel: data.doel } : {}),
			...(data.voorwaarden !== undefined ? { voorwaarden: data.voorwaarden } : {}),
			...(data.aanvraagprocedure !== undefined
				? { aanvraagprocedure: data.aanvraagprocedure }
				: {}),
			...(data.bronUrl !== undefined ? { bronUrl: data.bronUrl } : {}),
			...(data.bronType !== undefined ? { bronType: data.bronType } : {}),
			...(data.doelgroepNaam !== undefined ? { doelgroepNaam: data.doelgroepNaam } : {}),
			...(data.doelgroepCluster !== undefined
				? { doelgroepCluster: data.doelgroepCluster }
				: {}),
			...(data.vervaldatum !== undefined ? { vervaldatum: data.vervaldatum } : {}),
			...(data.looptijdStart !== undefined ? { looptijdStart: data.looptijdStart } : {}),
			...(data.looptijdEind !== undefined ? { looptijdEind: data.looptijdEind } : {}),
			...(data.maxBedragAanvrager !== undefined
				? { maxBedragAanvrager: data.maxBedragAanvrager }
				: {}),
			...(data.totaalSubsidiePlafond !== undefined
				? { totaalSubsidiePlafond: data.totaalSubsidiePlafond }
				: {}),
			...(data.plafonds !== undefined ? { plafonds: data.plafonds } : {}),
		},
	});
}

export function deleteById(id: string) {
	return prisma.subsidieRegeling.delete({ where: { id } });
}

export function setStatus(id: string, status: SubsidieRegeling["status"]) {
	return prisma.subsidieRegeling.update({
		where: { id },
		data: { status },
	});
}

export function setVervangenDoor(id: string, opvolgerId: string) {
	return prisma.subsidieRegeling.update({
		where: { id },
		data: {
			status: "GEARCHIVEERD_VERVANGEN",
			vervangenDoorId: opvolgerId,
		},
	});
}

export function setDeadLinkState(
	id: string,
	state: { deadLinkSince: Date | null; lastDeadLinkCheckAt: Date },
) {
	return prisma.subsidieRegeling.update({
		where: { id },
		data: state,
	});
}

export async function setEmbedding(
	id: string,
	embedding: number[],
	embeddingModel: string,
): Promise<void> {
	// pgvector wordt in Prisma als Unsupported geneerd. Raw SQL is de gangbare
	// weg in dit project (zie DocumentEmbedding-flow). Vector wordt geserialiseerd
	// als "[v1,v2,...]" literal.
	const vectorLiteral = `[${embedding.join(",")}]`;
	await prisma.$executeRawUnsafe(
		`UPDATE "SubsidieRegeling" SET "embedding" = $1::vector, "embeddingModel" = $2, "embeddedAt" = NOW() WHERE "id" = $3`,
		vectorLiteral,
		embeddingModel,
		id,
	);
}

export function nextVersienummer(regelingId: string) {
	return prisma.subsidieRegelingVersie
		.findFirst({
			where: { regelingId },
			orderBy: { versienummer: "desc" },
			select: { versienummer: true },
		})
		.then((row) => (row?.versienummer ?? 0) + 1);
}

export function addVersie(data: {
	regelingId: string;
	versienummer: number;
	payload: Prisma.InputJsonValue;
	gepubliceerdDoorUserId?: string | null;
}) {
	return prisma.subsidieRegelingVersie.create({
		data: {
			regelingId: data.regelingId,
			versienummer: data.versienummer,
			payload: data.payload,
			gepubliceerdDoorUserId: data.gepubliceerdDoorUserId ?? null,
		},
	});
}

export function listVersies(regelingId: string) {
	return prisma.subsidieRegelingVersie.findMany({
		where: { regelingId },
		orderBy: { versienummer: "desc" },
		include: { gepubliceerdDoor: { select: { id: true, email: true } } },
	});
}

export function addAuditEvent(data: {
	regelingId: string;
	userId?: string | null;
	actie:
		| "CREATE"
		| "UPDATE"
		| "PUBLISH"
		| "PUBLISH_FAILED"
		| "ARCHIVE"
		| "UNARCHIVE"
		| "REPLACE"
		| "EXPIRE"
		| "DEAD_LINK"
		| "DEAD_LINK_RESOLVED";
	diff?: Prisma.InputJsonValue;
	message?: string;
}) {
	return prisma.subsidieRegelingAuditEvent.create({
		data: {
			regelingId: data.regelingId,
			userId: data.userId ?? null,
			actie: data.actie,
			diff: data.diff,
			message: data.message,
		},
	});
}

export function listAuditEvents(regelingId: string) {
	return prisma.subsidieRegelingAuditEvent.findMany({
		where: { regelingId },
		orderBy: { createdAt: "desc" },
		include: { user: { select: { id: true, email: true } } },
	});
}

/** Cron-helper: alle actieve regelingen wiens vervaldatum reeds verstreken is. */
export function findExpiredActive(now: Date) {
	return prisma.subsidieRegeling.findMany({
		where: {
			status: "ACTIEF",
			vervaldatum: { lt: now, not: null },
		},
		select: { id: true, naam: true, vervaldatum: true },
	});
}

/** Cron-helper: alle ACTIEF regelingen voor link-check. */
export function findActiveForLinkCheck() {
	return prisma.subsidieRegeling.findMany({
		where: { status: "ACTIEF" },
		select: { id: true, bronUrl: true, deadLinkSince: true },
	});
}

export type SubsidieRegelingSearchResult = {
	id: string;
	naam: string;
	doel: string;
	voorwaarden: string;
	aanvraagprocedure: string;
	doelgroepNaam: string;
	doelgroepCluster: SubsidieRegeling["doelgroepCluster"];
	maxBedragAanvrager: string | null;
	totaalSubsidiePlafond: string | null;
	plafonds: unknown;
	vervaldatum: Date | null;
	publicatieDatum: Date | null;
	bronGewijzigdOp: Date | null;
	bronGecontroleerdOp: Date | null;
	thema: string | null;
	bronUrl: string;
	bronType: SubsidieRegeling["bronType"];
	vervangenDoorId: string | null;
	vervangenDoorNaam: string | null;
	vervangenDoorBronUrl: string | null;
	distance: number;
};

/**
 * Vector-similarity zoektocht over ACTIEF regelingen. Includeert ook
 * GEARCHIVEERD_VERVANGEN-regelingen met een `vervangenDoorId` zodat de
 * caller (zoektool) "deze regeling is vervangen door [naam]" kan tonen
 * voor expliciete vragen naar oude regelingen. Sluit CONCEPT en VERLOPEN
 * altijd uit.
 *
 * Filtert NIET op doelgroepCluster: alle regelingen over alle doelgroepen
 * heen worden semantisch gerangschikt teruggegeven. De `doelgroepCluster`
 * blijft per regeling als metadata meekomen zodat de assistent zelf kan
 * bepalen welke relevant zijn voor de situatie van de gebruiker.
 */
export async function searchActive({
	embedding,
	limit = 5,
}: {
	embedding: number[];
	limit?: number;
}): Promise<SubsidieRegelingSearchResult[]> {
	if (!embedding.length) return [];
	const vectorLiteral = `[${embedding.join(",")}]`;
	const capped = Math.min(Math.max(Math.floor(limit), 1), 20);

	type Row = {
		id: string;
		naam: string;
		doel: string;
		voorwaarden: string;
		aanvraagprocedure: string;
		doelgroepNaam: string;
		doelgroepCluster: SubsidieRegeling["doelgroepCluster"];
		maxBedragAanvrager: string | null;
		totaalSubsidiePlafond: string | null;
		plafonds: unknown;
		vervaldatum: Date | null;
		publicatieDatum: Date | null;
		bronGewijzigdOp: Date | null;
		bronGecontroleerdOp: Date | null;
		thema: string | null;
		bronUrl: string;
		bronType: SubsidieRegeling["bronType"];
		vervangenDoorId: string | null;
		vervangenDoorNaam: string | null;
		vervangenDoorBronUrl: string | null;
		distance: number | string;
	};

	const rows = await prisma.$queryRaw<Row[]>`
		SELECT
			r."id",
			r."naam",
			r."doel",
			r."voorwaarden",
			r."aanvraagprocedure",
			r."doelgroepNaam",
			r."doelgroepCluster",
			r."maxBedragAanvrager",
			r."totaalSubsidiePlafond",
			r."plafonds",
			r."vervaldatum",
			r."publicatieDatum",
			r."bronGewijzigdOp",
			r."bronGecontroleerdOp",
			r."thema",
			r."bronUrl",
			r."bronType",
			r."vervangenDoorId",
			v."naam" AS "vervangenDoorNaam",
			v."bronUrl" AS "vervangenDoorBronUrl",
			(r."embedding" <=> ${vectorLiteral}::vector) AS "distance"
		FROM "SubsidieRegeling" r
		LEFT JOIN "SubsidieRegeling" v ON v."id" = r."vervangenDoorId"
		WHERE r."embedding" IS NOT NULL
			AND (
			  r."status" = 'ACTIEF'
			  OR (r."status" = 'GEARCHIVEERD_VERVANGEN' AND r."vervangenDoorId" IS NOT NULL)
			)
		ORDER BY r."embedding" <=> ${vectorLiteral}::vector ASC
		LIMIT ${capped}
	`;

	return rows.map((row) => ({
		...row,
		distance: typeof row.distance === "string" ? Number(row.distance) : row.distance,
	}));
}

/** Dashboard: groepeer actieve regelingen op resterende dagen tot vervaldatum. */
export function findActiveForDashboard() {
	return prisma.subsidieRegeling.findMany({
		where: { status: "ACTIEF" },
		orderBy: { vervaldatum: "asc" },
		select: {
			id: true,
			naam: true,
			doelgroepCluster: true,
			vervaldatum: true,
			bronUrl: true,
			deadLinkSince: true,
		},
	});
}
