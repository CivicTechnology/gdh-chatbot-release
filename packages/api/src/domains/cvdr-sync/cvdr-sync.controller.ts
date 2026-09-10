import type { Request, Response } from "express";
import { runCvdrSync } from "@/lib/cvdr/cvdr-sync.service.js";
import type {
	CvdrSyncEvent,
	CvdrSyncMode,
} from "@/lib/cvdr/cvdr-sync.events.js";

/**
 * In-memory state van de huidige (of laatst voltooide) sync. Maakt het mogelijk
 * dat meerdere browser-tabs / een refreshende beheerder mid-stream "inhaken"
 * op een lopende sync: de history wordt eerst gereplayed, daarna komen nieuwe
 * events live binnen. Bewust per-process; voor multi-instance deployments zou
 * je hier Redis pub/sub voor gebruiken — dit project draait single-process.
 */
type CurrentSync = {
	startedAt: number;
	history: CvdrSyncEvent[];
	done: boolean;
	listeners: Set<Response>;
	abortController: AbortController;
};

let currentSync: CurrentSync | null = null;

function writeSse(res: Response, payload: unknown): void {
	res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Streamt events naar één response. Wordt zowel door /start (na het starten)
 * als door /stream (bij reconnect) gebruikt: eerst gehele history dumpen,
 * daarna als listener aangehaakt blijven tot sync klaar is of client disconnect.
 */
function streamTo(req: Request, res: Response, sync: CurrentSync): void {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache, no-transform");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("X-Accel-Buffering", "no");
	res.flushHeaders();

	// Replay history.
	for (const event of sync.history) {
		writeSse(res, event);
	}

	if (sync.done) {
		res.end();
		return;
	}

	sync.listeners.add(res);
	req.on("close", () => {
		sync.listeners.delete(res);
		if (!res.writableEnded) res.end();
	});
}

export async function startSync(req: Request, res: Response): Promise<void> {
	if (currentSync && !currentSync.done) {
		const startedSecondsAgo = Math.floor(
			(Date.now() - currentSync.startedAt) / 1000,
		);
		res.status(423).json({
			error: "Er loopt al een sync",
			startedSecondsAgo,
		});
		return;
	}

	const modifiedSince =
		typeof req.body?.modifiedSince === "string"
			? req.body.modifiedSince
			: undefined;
	const mode: CvdrSyncMode =
		req.body?.mode === "reprocess" ? "reprocess" : "update";

	const sync: CurrentSync = {
		startedAt: Date.now(),
		history: [],
		done: false,
		listeners: new Set(),
		abortController: new AbortController(),
	};
	currentSync = sync;

	streamTo(req, res, sync);

	// Sync draait async in achtergrond; client-disconnect mag niet de sync
	// stoppen — andere tabs of een refreshende beheerder kunnen alsnog
	// reconnecten via /stream.
	void runSyncAndBroadcast(sync, { modifiedSince, mode });
}

/**
 * Annuleer een lopende sync. De service-generator stopt op zijn eerstvolgende
 * `checkAbort`-punt en yieldt een fatal-event; in-flight extracties / DB calls
 * worden via signal afgekapt.
 *
 * Voor refresh-bestendigheid wordt een `cancelling`-event aan de history
 * toegevoegd zodat een herverbonden client de tussenstaat ook ziet zonder
 * opnieuw op annuleren te hoeven klikken.
 */
export function cancelSync(_req: Request, res: Response): void {
	if (!currentSync || currentSync.done) {
		res.status(409).json({ error: "Geen actieve sync" });
		return;
	}
	const sync = currentSync;
	const alreadyCancelling = sync.history.some((e) => e.type === "cancelling");
	if (!alreadyCancelling) {
		const event: CvdrSyncEvent = { type: "cancelling" };
		sync.history.push(event);
		for (const listener of sync.listeners) {
			if (!listener.writableEnded) writeSse(listener, event);
		}
	}
	sync.abortController.abort();
	res.json({ aborted: true });
}

async function runSyncAndBroadcast(
	sync: CurrentSync,
	options: { modifiedSince?: string; mode: CvdrSyncMode },
): Promise<void> {
	function emit(event: CvdrSyncEvent) {
		sync.history.push(event);
		for (const listener of sync.listeners) {
			if (!listener.writableEnded) writeSse(listener, event);
		}
	}

	try {
		for await (const event of runCvdrSync({
			...options,
			signal: sync.abortController.signal,
		})) {
			emit(event);
		}
	} catch (error) {
		emit({
			type: "fatal",
			message: error instanceof Error ? error.message : String(error),
		});
		console.error("CVDR sync fatal:", error);
	} finally {
		sync.done = true;
		for (const listener of sync.listeners) {
			if (!listener.writableEnded) listener.end();
		}
		sync.listeners.clear();
	}
}

/**
 * Reconnect-endpoint. Gebruikt door beheerders die de pagina refreshen of in
 * een tweede tab kijken: replay de events van de huidige sync, blijf als
 * listener actief tot deze klaar is, of geef 204 als er niets draait.
 */
export function streamSync(req: Request, res: Response): void {
	if (!currentSync) {
		res.status(204).end();
		return;
	}
	streamTo(req, res, currentSync);
}

export function syncStatus(_req: Request, res: Response): void {
	if (!currentSync) {
		res.json({ running: false });
		return;
	}
	res.json({
		running: !currentSync.done,
		startedSecondsAgo: Math.floor((Date.now() - currentSync.startedAt) / 1000),
		eventCount: currentSync.history.length,
	});
}
