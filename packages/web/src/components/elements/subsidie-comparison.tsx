import { motion } from "framer-motion";
import { ExternalLink, Star } from "lucide-react";
import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ComparedRegeling = {
  id: string;
  naam: string;
  doel: string;
  doelgroepNaam: string;
  doelgroepCluster: string;
  maxBedragAanvrager: string | null;
  totaalSubsidiePlafond: string | null;
  looptijdEind: string | null;
  vervaldatum: string | null;
  bronUrl: string;
  status: string;
  vervangenDoor: { naam: string; bronUrl: string } | null;
};

export type SubsidieComparisonOutput = {
  regelingen: ComparedRegeling[];
  gedropt: Array<{ id: string; reden: string }>;
};

const BADGE_TONE = {
  green:
    "border-green-300 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  amber:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
} as const;

const DAY_MS = 1000 * 60 * 60 * 24;
const DEADLINE_SOON_DAYS = 60;

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function maxOf(nums: Array<number | null>): number | null {
  const valid = nums.filter((n): n is number => n !== null);
  return valid.length > 0 ? Math.max(...valid) : null;
}

function formatBedrag(value: string | null): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

type Deadline = { label: string; soon: boolean };

function formatDeadline(value: string | null): Deadline {
  if (!value) return { label: "geen einddatum", soon: false };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { label: value, soon: false };
  const absolute = new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
  }).format(d);
  const days = Math.round((d.getTime() - Date.now()) / DAY_MS);
  if (days < 0) return { label: `verlopen · ${absolute}`, soon: false };
  let rel: string;
  if (days < 14) {
    rel = `over ${days} dag${days === 1 ? "" : "en"}`;
  } else if (days < DEADLINE_SOON_DAYS) {
    rel = `over ${Math.round(days / 7)} weken`;
  } else if (days < 365) {
    rel = `over ${Math.round(days / 30)} mnd`;
  } else {
    rel = `over ${Math.round(days / 365)} jaar`;
  }
  return { label: `${rel} · ${absolute}`, soon: days <= DEADLINE_SOON_DAYS };
}

type Props = {
  output: SubsidieComparisonOutput;
  onBekijkDetails: (naam: string) => void;
  disabled?: boolean;
};

function SubsidieComparisonInner({
  output,
  onBekijkDetails,
  disabled = false,
}: Props) {
  const { regelingen, gedropt } = output;

  const analysis = useMemo(() => {
    const bedrag = new Map(
      regelingen.map((r) => [r.id, toNumber(r.maxBedragAanvrager)])
    );
    const plafond = new Map(
      regelingen.map((r) => [r.id, toNumber(r.totaalSubsidiePlafond)])
    );
    const maxBedrag = maxOf([...bedrag.values()]);
    const maxPlafond = maxOf([...plafond.values()]);
    const bedragWinners = regelingen
      .filter((r) => maxBedrag !== null && bedrag.get(r.id) === maxBedrag)
      .map((r) => r.id);
    const plafondWinners = regelingen
      .filter((r) => maxPlafond !== null && plafond.get(r.id) === maxPlafond)
      .map((r) => r.id);

    // Crown only when one regeling objectively dominates: unique highest bedrag,
    // highest (or sole) plafond, and still active. Never a subjective judgement.
    let crownId: string | null = null;
    if (bedragWinners.length === 1 && regelingen.length > 1) {
      const id = bedragWinners[0];
      const winner = regelingen.find((r) => r.id === id);
      const plafondOk = maxPlafond === null || plafondWinners.includes(id);
      if (winner?.status === "ACTIEF" && plafondOk) {
        crownId = id;
      }
    }

    const sorted = [...regelingen].sort((a, b) => {
      const av = bedrag.get(a.id) ?? null;
      const bv = bedrag.get(b.id) ?? null;
      if (av === bv) return a.naam.localeCompare(b.naam, "nl");
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });

    return {
      bedragWinners,
      plafondWinners,
      crownId,
      sorted,
    };
  }, [regelingen]);

  if (regelingen.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-muted-foreground text-sm">
        Geen vergelijkbare regelingen gevonden.
      </div>
    );
  }

  const total = regelingen.length;

  return (
    <div className="flex flex-col gap-2.5">
      {analysis.sorted.map((r, i) => {
        const isCrown = r.id === analysis.crownId;
        const isBedragWinner = analysis.bedragWinners.includes(r.id);
        const isPlafondWinner = analysis.plafondWinners.includes(r.id);
        const deadline = formatDeadline(r.vervaldatum ?? r.looptijdEind);
        const vervangen = r.status === "GEARCHIVEERD_VERVANGEN";

        const badges: Array<{
          key: string;
          label: string;
          tone: keyof typeof BADGE_TONE;
        }> = [];
        if (!isCrown) {
          if (isBedragWinner && analysis.bedragWinners.length < total) {
            badges.push({
              key: "bedrag",
              label: "Hoogste bedrag",
              tone: "green",
            });
          }
          if (isPlafondWinner && analysis.plafondWinners.length < total) {
            badges.push({
              key: "plafond",
              label: "Grootste budget",
              tone: "green",
            });
          }
        }
        if (deadline.soon) {
          badges.push({
            key: "deadline",
            label: "Deadline dichtbij",
            tone: "amber",
          });
        }
        if (vervangen) {
          badges.push({ key: "vervangen", label: "Vervangen", tone: "amber" });
        }

        return (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-xl border border-border bg-card p-3.5",
              isCrown &&
                "border-green-400/60 bg-green-50/60 ring-1 ring-green-400/30 dark:border-green-800 dark:bg-green-950/20"
            )}
            initial={{ opacity: 0, y: 6 }}
            key={r.id}
            transition={{ duration: 0.22, delay: i * 0.05, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-foreground text-sm">
                {r.naam}
              </span>
              {isCrown && (
                <Badge
                  className={cn(BADGE_TONE.green, "shrink-0 gap-1")}
                  variant="outline"
                >
                  <Star className="size-3 fill-current" /> sterkste match
                </Badge>
              )}
            </div>

            {badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <Badge
                    className={BADGE_TONE[b.tone]}
                    key={b.key}
                    variant="outline"
                  >
                    {b.label}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <span className="w-20 shrink-0 text-muted-foreground text-xs">
                  Max. bedrag
                </span>
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    isBedragWinner
                      ? "font-semibold text-foreground"
                      : "text-foreground"
                  )}
                >
                  {formatBedrag(r.maxBedragAanvrager)}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="w-20 shrink-0 text-muted-foreground text-xs">
                  Loopt af
                </span>
                <span
                  className={cn(
                    "text-sm",
                    deadline.soon
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-foreground"
                  )}
                >
                  {deadline.label}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="w-20 shrink-0 text-muted-foreground text-xs">
                  Doelgroep
                </span>
                <span className="text-foreground text-sm">
                  {r.doelgroepNaam}
                </span>
              </div>
            </div>

            {r.vervangenDoor && (
              <p className="mt-2.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Vervangen door{" "}
                <a
                  className="underline"
                  href={r.vervangenDoor.bronUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {r.vervangenDoor.naam}
                </a>
              </p>
            )}

            <div className="mt-3 flex items-center gap-3 border-border/60 border-t pt-2.5">
              <button
                className="text-primary text-xs underline hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                disabled={disabled}
                onClick={() => onBekijkDetails(r.naam)}
                type="button"
              >
                Bekijk details
              </button>
              <a
                className="inline-flex items-center gap-0.5 text-muted-foreground text-xs underline hover:text-foreground"
                href={r.bronUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Naar bron <ExternalLink className="size-3" />
              </a>
            </div>
          </motion.div>
        );
      })}

      {gedropt.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {gedropt.length} regeling(en) niet getoond (niet gevonden of niet meer
          actief).
        </p>
      )}
    </div>
  );
}

export const SubsidieComparison = memo(SubsidieComparisonInner);
