import { CheckCircle2Icon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { CvdrSyncState } from "@/hooks/use-cvdr-sync";

/**
 * Compacte voortgangsbalk boven de regelingen-tabel tijdens een CVDR sync.
 * Eén progress-bar voor de gecombineerde extract + upsert per regeling. Rijen
 * verschijnen live in de tabel onder ons; geen tweede bar nodig.
 */
export function CvdrSyncStrip({ state }: { state: CvdrSyncState }) {
  if (state.phase === "idle") return null;

  // Toon de werken-count zodra `fetched` binnen is (vóór het eerste
  // regeling-progress event); voorkomt een misleidende "0/?" in de eerste
  // seconden.
  const total = state.progress.total || state.fetched?.werken || 0;
  const pct = total > 0 ? Math.round((state.progress.done / total) * 100) : 0;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <StatusIcon phase={state.phase} />
          <StatusLabel state={state} />
        </div>
        {state.stats ? (
          <span className="text-muted-foreground text-xs">
            {(state.stats.totalMs / 1000).toFixed(1)}s
          </span>
        ) : null}
      </div>

      {state.phase === "running" || state.phase === "cancelling" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Verwerkt</span>
            <span>
              {state.progress.done}/{total || "?"}
            </span>
          </div>
          <Progress value={pct} />
        </div>
      ) : null}

      {state.error ? (
        <p className="text-destructive text-xs">{state.error}</p>
      ) : null}
    </div>
  );
}

function StatusIcon({ phase }: { phase: CvdrSyncState["phase"] }) {
  if (phase === "running" || phase === "cancelling") {
    return (
      <Loader2Icon
        aria-hidden="true"
        className="size-4 animate-spin text-primary"
      />
    );
  }
  if (phase === "done" || phase === "cancelled") {
    return (
      <CheckCircle2Icon
        aria-hidden="true"
        className={`size-4 ${phase === "done" ? "text-emerald-600" : "text-muted-foreground"}`}
      />
    );
  }
  if (phase === "error") {
    return (
      <TriangleAlertIcon
        aria-hidden="true"
        className="size-4 text-destructive"
      />
    );
  }
  return null;
}

function StatusLabel({ state }: { state: CvdrSyncState }) {
  if (state.phase === "cancelling") {
    return <span>Annuleren...</span>;
  }
  if (state.phase === "cancelled") {
    return (
      <span>
        Sync geannuleerd na {state.progress.done} verwerkte regelingen
      </span>
    );
  }
  if (state.phase === "running") {
    const modusLabel =
      state.mode === "reprocess"
        ? "alles opnieuw verwerken"
        : "alleen wijzigingen";
    if (state.fetched === null) {
      return (
        <span>
          Ophalen vanuit lokaleregelgeving.overheid.nl ({modusLabel})...
        </span>
      );
    }
    return (
      <span>
        {state.fetched.werken} regelingen gevonden ({modusLabel})
      </span>
    );
  }
  if (state.phase === "done" && state.stats) {
    const { created, updated, skipped, failed } = state.stats;
    const parts = [
      created ? `${created} nieuw` : null,
      updated ? `${updated} bijgewerkt` : null,
      skipped ? `${skipped} ongewijzigd` : null,
      failed ? `${failed} mislukt` : null,
    ].filter(Boolean);
    return (
      <span>Sync compleet — {parts.join(", ") || "geen wijzigingen"}</span>
    );
  }
  if (state.phase === "error") {
    return <span>Sync mislukt</span>;
  }
  return null;
}
