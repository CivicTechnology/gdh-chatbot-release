export type CvdrSyncMode = "update" | "reprocess";

export type CvdrSyncEvent =
  | {
      type: "start";
      today: string;
      modifiedSince?: string;
      mode: CvdrSyncMode;
    }
  | { type: "fetched"; versies: number; werken: number }
  | {
      type: "regeling-progress";
      werkId: string;
      titel: string;
      dbId?: string;
      done: number;
      total: number;
      outcome: "created" | "updated" | "skipped" | "failed";
      status?: "CONCEPT" | "VERLOPEN" | "ACTIEF";
      error?: string;
    }
  | { type: "vervangen-resolved"; resolved: number; missingTarget: number }
  | { type: "cancelling" }
  | {
      type: "complete";
      stats: {
        versies: number;
        werken: number;
        created: number;
        updated: number;
        skipped: number;
        failed: number;
        vervangenResolved: number;
        totalMs: number;
      };
    }
  | { type: "fatal"; message: string };

/**
 * Open een SSE-stream van de CVDR sync-endpoint en yield events tot de server
 * klaar is of de browser de connectie sluit (via `signal`). EventSource
 * ondersteunt geen POST, dus we lezen het response-lichaam zelf en knip op
 * `\n\n` om events te framen.
 *
 * - `start`: nieuwe sync starten (POST /start). Geeft 423 als er al een draait.
 * - `join`: aanhaken bij bestaande sync (GET /stream). Replay history + live.
 *   Geeft 204 als er niets te streamen is.
 */
export async function* streamCvdrSync(
  action: "start" | "join",
  body: { modifiedSince?: string; mode?: CvdrSyncMode } = {},
  signal?: AbortSignal
): AsyncGenerator<CvdrSyncEvent> {
  const apiBase = import.meta.env.VITE_API_URL || "/api";
  const endpoint =
    action === "start"
      ? `${apiBase}/admin/cvdr-sync/start`
      : `${apiBase}/admin/cvdr-sync/stream`;
  const response = await fetch(endpoint, {
    method: action === "start" ? "POST" : "GET",
    credentials: "include",
    headers:
      action === "start" ? { "Content-Type": "application/json" } : undefined,
    body: action === "start" ? JSON.stringify(body) : undefined,
    signal,
  });

  if (action === "join" && response.status === 204) {
    return;
  }
  if (response.status === 423) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      `Er loopt al een sync (gestart ${payload.startedSecondsAgo ?? "?"}s geleden).`
    );
  }
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Sync-stream faalde: ${response.status} ${detail}`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    while (true) {
      const sepIndex = buffer.indexOf("\n\n");
      if (sepIndex === -1) break;
      const chunk = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      const dataLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      try {
        yield JSON.parse(dataLine.slice(6)) as CvdrSyncEvent;
      } catch {
        // negeren — incomplete event, volgende chunk vult aan
      }
    }
  }
}

export type SyncStatusResponse = {
  running: boolean;
  startedSecondsAgo?: number;
  eventCount?: number;
};

export async function fetchSyncStatus(): Promise<SyncStatusResponse> {
  const apiBase = import.meta.env.VITE_API_URL || "/api";
  const response = await fetch(`${apiBase}/admin/cvdr-sync/status`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Status fetch faalde: ${response.status}`);
  }
  return response.json();
}

export async function cancelSync(): Promise<void> {
  const apiBase = import.meta.env.VITE_API_URL || "/api";
  await fetch(`${apiBase}/admin/cvdr-sync/cancel`, {
    method: "POST",
    credentials: "include",
  });
}
