import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CvdrSyncEvent,
  type CvdrSyncMode,
  cancelSync as cancelSyncRequest,
  fetchSyncStatus,
  streamCvdrSync,
} from "@/lib/cvdr-sync-events";

export type SyncPhase =
  | "idle"
  | "running"
  | "cancelling"
  | "cancelled"
  | "done"
  | "error";

type Stats = NonNullable<Extract<CvdrSyncEvent, { type: "complete" }>["stats"]>;

export type CvdrSyncState = {
  phase: SyncPhase;
  mode: CvdrSyncMode;
  error: string | null;
  fetched: { versies: number; werken: number } | null;
  progress: {
    done: number;
    total: number;
    failed: number;
    skipped: number;
  };
  vervangen: { resolved: number; missingTarget: number } | null;
  stats: Stats | null;
  /** DB-ids van regelingen die tijdens deze sync zijn geüpsert. */
  freshIds: Set<string>;
};

const INITIAL: CvdrSyncState = {
  phase: "idle",
  mode: "update",
  error: null,
  fetched: null,
  progress: { done: 0, total: 0, failed: 0, skipped: 0 },
  vervangen: null,
  stats: null,
  freshIds: new Set(),
};

/**
 * Bestuurt een CVDR sync: opent een SSE-stream, accumuleert events naar
 * UI-state, roept `onRegelingUpserted` aan per geslaagde upsert zodat de
 * parent een (gedebouncede) lijst-refetch kan triggeren en de nieuwe rij kan
 * markeren.
 *
 * Reconnect: bij mount wordt eerst /status gepolled. Als er een sync draait
 * sluit de hook aan op /stream zodat een refresh of tweede tab de voortgang
 * naadloos voortzet (history-replay + live events).
 */
export function useCvdrSync(options: {
  onRegelingUpserted?: (dbId: string) => void;
}) {
  const [state, setState] = useState<CvdrSyncState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  // Houd de callback in een ref zodat `consume` stabiel blijft, ook als de
  // caller bij elke render een nieuwe inline-functie doorgeeft. Zonder deze
  // indirection re-runt elke `useCallback`/`useEffect` met `consume` in de
  // deps, wat in praktijk meerdere streams tegelijk opent → die aborten
  // elkaar → UI flikkert tussen running/idle.
  const onUpsertRef = useRef(options.onRegelingUpserted);
  useEffect(() => {
    onUpsertRef.current = options.onRegelingUpserted;
  }, [options.onRegelingUpserted]);

  const consume = useCallback(
    async (action: "start" | "join", syncMode?: CvdrSyncMode) => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        setState({ ...INITIAL, phase: "running", freshIds: new Set() });
        for await (const event of streamCvdrSync(
          action,
          action === "start" && syncMode ? { mode: syncMode } : {},
          controller.signal
        )) {
          setState((prev) => reduce(prev, event));
          if (
            event.type === "regeling-progress" &&
            event.outcome !== "failed" &&
            event.outcome !== "skipped" &&
            event.dbId
          ) {
            onUpsertRef.current?.(event.dbId);
          }
        }
        // Stream ended without a complete-event (server closed) — als er
        // geen complete is gezien, val terug op idle ipv "running" vast te
        // blijven.
        setState((prev) =>
          prev.phase === "running" ? { ...prev, phase: "done" } : prev
        );
      } catch (error) {
        if (controller.signal.aborted) {
          setState((prev) => ({ ...prev, phase: "idle" }));
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({ ...prev, phase: "error", error: message }));
      } finally {
        abortRef.current = null;
      }
    },
    []
  );

  // Reconnect op mount: als er een sync draait, sluit aan op /stream zodat
  // refresh / multi-tab dezelfde voortgang ziet. consume is stabiel
  // (lege deps) dus deze effect draait echt alleen op mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchSyncStatus();
        if (cancelled) return;
        if (status.running) {
          void consume("join");
        }
      } catch {
        // Status-fetch faalt stil — gebruiker kan gewoon op start drukken
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [consume]);

  const start = useCallback(
    async (syncMode: CvdrSyncMode = "update") => {
      await consume("start", syncMode);
    },
    [consume]
  );

  const cancel = useCallback(async () => {
    // Onmiddellijke UI-feedback: zet phase op "cancelling" zodat de knop
    // gelijk verandert in "Annuleren...". De stream blijft open totdat de
    // server-generator daadwerkelijk een fatal-event yieldt; daarna sluit
    // de connectie en gaat de reducer naar "cancelled".
    setState((prev) =>
      prev.phase === "running" ? { ...prev, phase: "cancelling" } : prev
    );
    await cancelSyncRequest().catch(() => undefined);
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL);
  }, []);

  return { state, start, cancel, reset };
}

function reduce(prev: CvdrSyncState, event: CvdrSyncEvent): CvdrSyncState {
  switch (event.type) {
    case "start":
      return { ...prev, mode: event.mode };
    case "fetched":
      return {
        ...prev,
        fetched: { versies: event.versies, werken: event.werken },
      };
    case "regeling-progress": {
      const next: CvdrSyncState = {
        ...prev,
        progress: {
          done: event.done,
          total: event.total,
          failed: prev.progress.failed + (event.outcome === "failed" ? 1 : 0),
          skipped:
            prev.progress.skipped + (event.outcome === "skipped" ? 1 : 0),
        },
      };
      // Skipped records hebben geen content-wijziging → niet als "fresh"
      // markeren (anders flikkert de hele tabel zinloos).
      if (
        event.dbId &&
        event.outcome !== "failed" &&
        event.outcome !== "skipped"
      ) {
        const fresh = new Set(prev.freshIds);
        fresh.add(event.dbId);
        next.freshIds = fresh;
      }
      return next;
    }
    case "vervangen-resolved":
      return {
        ...prev,
        vervangen: {
          resolved: event.resolved,
          missingTarget: event.missingTarget,
        },
      };
    case "cancelling":
      return { ...prev, phase: "cancelling" };
    case "complete":
      return { ...prev, phase: "done", stats: event.stats };
    case "fatal":
      // Onderscheid tussen expliciete annulering en echte fout — voorkomt dat
      // "Sync mislukt" rood wordt getoond na een gewenste cancel.
      if (/geannuleerd/i.test(event.message)) {
        return { ...prev, phase: "cancelled" };
      }
      return { ...prev, phase: "error", error: event.message };
    default:
      return prev;
  }
}
