import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import type { SubsidieRegeling, SubsidieStatus } from "@/api/subsidieregeling";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<SubsidieStatus, string> = {
  CONCEPT: "Concept",
  ACTIEF: "Actief",
  GEARCHIVEERD: "Gearchiveerd",
  GEARCHIVEERD_VERVANGEN: "Vervangen",
  VERLOPEN: "Verlopen",
};

const STATUS_CLASS: Record<SubsidieStatus, string> = {
  CONCEPT:
    "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  ACTIEF:
    "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  GEARCHIVEERD: "border-border bg-muted text-muted-foreground",
  GEARCHIVEERD_VERVANGEN: "border-border bg-muted text-muted-foreground",
  VERLOPEN: "border-border bg-muted text-muted-foreground line-through",
};

export function StatusPill({ status }: { status: SubsidieStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs",
        STATUS_CLASS[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const CLUSTER_LABEL = {
  PARTICULIER: "Particulier",
  BEDRIJF: "Bedrijf",
  MAATSCHAPPELIJK: "Maatschappelijk",
} as const;

export function DoelgroepBadge({
  cluster,
}: {
  cluster: keyof typeof CLUSTER_LABEL;
}) {
  return <Badge variant="outline">{CLUSTER_LABEL[cluster]}</Badge>;
}

type Tone = "urgent" | "warning" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  urgent: "border-destructive/40 bg-destructive/10 text-destructive",
  warning:
    "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  info: "border-border bg-muted text-muted-foreground",
  neutral: "border-border bg-card text-muted-foreground",
};

/**
 * Klein rond label met aantal regelingen in een bucket. Vervangt het
 * eerdere `·`-fallback.
 */
export function CountPill({ count, tone }: { count: number; tone: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 font-semibold text-[10px]",
        TONE_CLASS[tone]
      )}
    >
      {count}
    </span>
  );
}

/**
 * Uitroepteken-icoon dat bij elke regeling met een aandachtspunt wordt
 * getoond. Tooltip wordt door de parent
 * geleverd zodat de reden context-specifiek is.
 */
export function Uitroepteken({
  tone = "warning",
  title,
}: {
  tone?: Tone;
  title?: string;
}) {
  const toneFg =
    tone === "urgent"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <span
      aria-label={title ?? "aandachtspunt"}
      role="img"
      className={cn("font-bold text-sm leading-none", toneFg)}
      title={title}
    >
      !
    </span>
  );
}

/**
 * Gevulde stip die de urgentie van een vervaldatum signaleert. Vervangt
 * het tweede uitroepteken zodat de visuele woordenschat strakker blijft.
 *   - urgent (rood): vervalt binnen 7 dagen
 *   - warning (amber): vervalt binnen 30 dagen
 *   - info (geel): vervalt binnen 90 dagen
 *   - neutral (grijs): nog verder weg
 */
export function UrgencyDot({ tone, title }: { tone: Tone; title?: string }) {
  const dotClass =
    tone === "urgent"
      ? "bg-red-500"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "info"
          ? "bg-yellow-500"
          : "bg-muted-foreground/40";
  return (
    <span
      aria-label={title ?? ""}
      role="img"
      className={cn("inline-block size-2 shrink-0 rounded-full", dotClass)}
      title={title}
    />
  );
}

/**
 * Uitgeholde ring voor dode-link items. Onderscheidt zich visueel van
 * de gevulde vervaldatum-stippen zodat de oorzaak (kapotte URL vs.
 * naderende einddatum) direct af te lezen is.
 */
export function DeadLinkDot({ title }: { title?: string }) {
  return (
    <span
      aria-label={title ?? "Bron-URL onbereikbaar"}
      role="img"
      className="inline-block size-2 shrink-0 rounded-full border-2 border-red-400"
      title={title}
    />
  );
}

/**
 * Ghost-preview rij die de echte rij-anatomie nabootst: stip, naam,
 * doelgroep-pill, meta-tekst, pijl. Bewust geen icon-in-circle empty state,
 * wel een structurele preview op lage opacity.
 */
function GhostRow({ opacity }: { opacity: number }) {
  return (
    <div
      aria-hidden
      className="flex items-center gap-3 px-4 py-3"
      style={{ opacity }}
    >
      <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />
      <span className="h-3 max-w-[38%] flex-1 rounded bg-muted-foreground/30" />
      <span className="h-5 w-24 shrink-0 rounded-full bg-muted-foreground/20" />
      <span className="h-3 w-32 shrink-0 rounded bg-muted-foreground/20" />
      <span className="size-3 shrink-0 rounded bg-muted-foreground/15" />
    </div>
  );
}

export function GhostRows({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y" aria-hidden>
      {Array.from({ length: count }, (_, i) => i).map((i) => (
        <GhostRow key={`ghost-${i}`} opacity={0.55 - i * 0.12} />
      ))}
    </div>
  );
}

/**
 * Lege-lijst placeholder: gefadede rijen die de echte data-layout
 * mirroren, met centraal label op een semi-transparante achtergrond.
 * Gebruikt voor secties op het dashboard die (nog) geen content hebben.
 */
export function GhostList({
  label,
  count = 3,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="relative">
      <GhostRows count={count} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rounded-full bg-card/85 px-3 py-1 text-muted-foreground text-xs shadow-sm ring-1 ring-border/50 backdrop-blur-[1px]">
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * Speelt bij elke key-wissel een korte fade-in (met 4px lift bij volle
 * motion). De key zorgt dat React de wrapper remount, dus geen overlap
 * met de vorige render en geen flicker. Honoreert prefers-reduced-motion.
 */
export function FadeMount({
  keyId,
  children,
}: {
  keyId: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      initial={{ opacity: 0 }}
      key={keyId}
      // Bewust geen y-translate gebruiken: motion.div houdt anders een blijvend
      // `transform: translateY(0)` inline-style aan, en een transformed ancestor
      // creëert een nieuwe containing block die `position: sticky` op kinderen
      // breekt (de status-sidebar bv.).
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/** Subtiele route-transitie rond de admin-`<Outlet />`. */
export function AdminPageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  return <FadeMount keyId={location.pathname}>{children}</FadeMount>;
}

/**
 * Wrappa voor een lijst-rij die naar het detailscherm linkt en
 * hover-styling aanlevert. Voorkomt herhaling in dashboard + lijst.
 */
export function RegelingListItem({
  regeling,
  rightSlot,
}: {
  regeling: Pick<
    SubsidieRegeling,
    "id" | "naam" | "vervaldatum" | "deadLinkSince"
  >;
  rightSlot?: React.ReactNode;
}) {
  return (
    <Link
      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
      to={`/admin/subsidieregelingen/${regeling.id}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {regeling.deadLinkSince ? (
          <Uitroepteken title="Bron-URL onbereikbaar" tone="urgent" />
        ) : null}
        <span className="truncate font-medium text-sm">{regeling.naam}</span>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        {rightSlot}
      </div>
    </Link>
  );
}
