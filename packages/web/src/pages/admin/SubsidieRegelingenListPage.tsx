import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudDownloadIcon,
  PlusIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  type SubsidieRegeling,
  type SubsidieStatus,
  subsidieApi,
} from "@/api/subsidieregeling";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useCvdrSync } from "@/hooks/use-cvdr-sync";
import { daysUntil, formatDate, formatRelative } from "@/lib/format";
import { GhostList, StatusPill } from "./_components";
import { CvdrSyncStrip } from "./CvdrSyncStrip";

const STATUS_CHIPS: Array<{
  label: string;
  value: SubsidieStatus;
  defaultOn: boolean;
}> = [
  { label: "Actief", value: "ACTIEF", defaultOn: true },
  { label: "Concept", value: "CONCEPT", defaultOn: true },
  { label: "Verlopen", value: "VERLOPEN", defaultOn: false },
  { label: "Gearchiveerd", value: "GEARCHIVEERD", defaultOn: false },
  { label: "Vervangen", value: "GEARCHIVEERD_VERVANGEN", defaultOn: false },
];

const DEFAULT_STATUSES = STATUS_CHIPS.filter((c) => c.defaultOn).map(
  (c) => c.value
);

type SortKey = "vervaldatum" | "naam" | "updatedAt";
type SortOrder = "asc" | "desc";

const ATTENTION_THRESHOLD_DAYS = 90;

function needsAttention(r: SubsidieRegeling): boolean {
  if (r.status !== "ACTIEF") return false;
  if (r.deadLinkSince) return true;
  const d = daysUntil(r.vervaldatum);
  return d !== null && d <= ATTENTION_THRESHOLD_DAYS;
}

function urgencyTextClass(dagen: number | null): string {
  if (dagen === null) return "text-muted-foreground";
  if (dagen < 0) return "text-destructive";
  if (dagen <= 7) return "text-destructive font-medium";
  if (dagen <= 30) return "text-amber-700 dark:text-amber-400";
  return "text-muted-foreground";
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 20;

export default function SubsidieRegelingenListPage() {
  const [params, setParams] = useSearchParams();
  const [regelingen, setRegelingen] = useState<SubsidieRegeling[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState<
    Record<SubsidieStatus, number>
  >({
    ACTIEF: 0,
    CONCEPT: 0,
    VERLOPEN: 0,
    GEARCHIVEERD: 0,
    GEARCHIVEERD_VERVANGEN: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [zoek, setZoek] = useState(params.get("search") ?? "");
  /** ids die *zojuist* geüpsert zijn — gebruikt voor de fade-in highlight. */
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const refetchTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  const sortRaw = params.get("sort") ?? "vervaldatum-asc";
  const [sortKey, sortOrder] = sortRaw.split("-") as [SortKey, SortOrder];

  const pageSize = useMemo<number>(() => {
    const raw = Number.parseInt(params.get("pageSize") ?? "", 10);
    return PAGE_SIZE_OPTIONS.includes(raw as (typeof PAGE_SIZE_OPTIONS)[number])
      ? raw
      : DEFAULT_PAGE_SIZE;
  }, [params]);

  const page = useMemo<number>(() => {
    const raw = Number.parseInt(params.get("page") ?? "1", 10);
    return Number.isFinite(raw) && raw >= 1 ? raw : 1;
  }, [params]);

  const selectedStatuses = useMemo<Set<SubsidieStatus>>(() => {
    // Onderscheid tussen "param ontbreekt" (eerste bezoek → defaults) en
    // "param aanwezig met lege string" (gebruiker heeft expliciet alles
    // uitgevinkt → toon niks). Zonder dit onderscheid zou alles uitvinken
    // resetten naar de defaults, wat aanvoelt alsof statussen "vanzelf
    // terugkomen".
    if (!params.has("statuses")) return new Set(DEFAULT_STATUSES);
    const raw = params.get("statuses") ?? "";
    const parsed = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is SubsidieStatus =>
        STATUS_CHIPS.some((c) => c.value === s)
      );
    return new Set(parsed);
  }, [params]);

  // Eén bron van waarheid voor de lijst-fetch. Wordt zowel door de
  // useEffect (filter/sort/paginatie veranderen) als door de live sync
  // (triggerRefetch debounced) aangeroepen.
  const fetchList = useCallback(async (): Promise<void> => {
    const query = new URLSearchParams();
    query.set("sort", sortKey);
    query.set("order", sortOrder ?? "asc");
    query.set("take", String(pageSize));
    query.set("skip", String((page - 1) * pageSize));
    query.set(
      "statuses",
      STATUS_CHIPS.map((c) => c.value)
        .filter((s) => selectedStatuses.has(s))
        .join(",")
    );
    if (zoek.trim()) query.set("search", zoek.trim());
    const response = await subsidieApi.list(query);
    if (response.data) {
      setRegelingen(response.data.regelingen);
      setTotal(response.data.total);
      setStatusCounts(response.data.statusCounts);
      setError(null);
    } else {
      setError(response.error ?? "Kon lijst niet laden");
    }
  }, [sortKey, sortOrder, zoek, pageSize, page, selectedStatuses]);

  const triggerRefetch = useCallback(() => {
    // Debounce: meerdere upsert-events binnen 250ms triggeren één refetch.
    // Korte interval houdt de tabel "live" aanvoelen tijdens een sync.
    if (refetchTimerRef.current !== null) {
      window.clearTimeout(refetchTimerRef.current);
    }
    refetchTimerRef.current = window.setTimeout(() => {
      void fetchList();
      refetchTimerRef.current = null;
    }, 250);
  }, [fetchList]);

  const sync = useCvdrSync({
    onRegelingUpserted: (dbId) => {
      setFlashIds((prev) => {
        const next = new Set(prev);
        next.add(dbId);
        return next;
      });
      triggerRefetch();
      // Verwijder de flash-markering na de animatie zodat een latere status-
      // verandering (status filter aan/uit) niet opnieuw highlight.
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
      flashTimerRef.current = window.setTimeout(() => {
        setFlashIds(new Set());
        flashTimerRef.current = null;
      }, 3500);
    },
  });

  useEffect(() => {
    return () => {
      if (refetchTimerRef.current !== null) {
        window.clearTimeout(refetchTimerRef.current);
      }
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const setPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    const search = new URLSearchParams(params);
    if (clamped === 1) search.delete("page");
    else search.set("page", String(clamped));
    setParams(search);
  };

  const setPageSize = (next: number) => {
    const search = new URLSearchParams(params);
    if (next === DEFAULT_PAGE_SIZE) search.delete("pageSize");
    else search.set("pageSize", String(next));
    search.delete("page");
    setParams(search);
  };

  const attentionCount = useMemo(() => {
    if (!regelingen) return 0;
    return regelingen.filter(needsAttention).length;
  }, [regelingen]);

  // Server filtert al op status + paginatie — client toont gewoon wat de
  // server stuurt. Daarmee staat de paginatie in sync met het filter.
  const visible = regelingen;

  const toggleSort = (key: SortKey) => {
    const next = new URLSearchParams(params);
    if (sortKey === key) {
      next.set("sort", `${key}-${sortOrder === "asc" ? "desc" : "asc"}`);
    } else {
      next.set("sort", `${key}-asc`);
    }
    next.delete("page");
    setParams(next);
  };

  const toggleStatus = (value: SubsidieStatus) => {
    const next = new URLSearchParams(params);
    const newSet = new Set(selectedStatuses);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    const sortedValues = STATUS_CHIPS.map((c) => c.value).filter((v) =>
      newSet.has(v)
    );
    // Schrijf de param altijd, ook bij lege selectie — anders valt de memo
    // terug op defaults en lijkt het of statussen "vanzelf" weer aankomen.
    next.set("statuses", sortedValues.join(","));
    next.delete("page");
    setParams(next);
  };

  const hasActiveFilter = zoek.trim().length > 0;

  const isSyncing = sync.state.phase === "running";
  const isCancelling = sync.state.phase === "cancelling";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl">Subsidieregelingen</h1>
          <p className="text-muted-foreground text-sm">
            {regelingen === null
              ? "Regelingen ophalen..."
              : subtitleCopy(total, attentionCount, hasActiveFilter)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSyncing || isCancelling ? (
            <Button
              disabled={isCancelling}
              onClick={sync.cancel}
              variant="outline"
            >
              {isCancelling ? "Annuleren..." : "Sync annuleren"}
              <XIcon
                aria-hidden="true"
                className="ml-1.5 size-4"
                strokeWidth={2.5}
              />
            </Button>
          ) : (
            <SyncSplitButton onStart={(mode) => sync.start(mode)} />
          )}
          <Button asChild>
            <Link to="/admin/subsidieregelingen/nieuw">
              Nieuwe regeling
              <PlusIcon
                aria-hidden="true"
                className="ml-1.5 size-4"
                strokeWidth={2.5}
              />
            </Link>
          </Button>
        </div>
      </header>

      <CvdrSyncStrip state={sync.state} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="flex w-full shrink-0 flex-col gap-4 rounded-lg border bg-card p-4 lg:sticky lg:top-6 lg:w-64">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs" htmlFor="zoek">
              Zoeken
            </label>
            <Input
              className="shadow-none"
              id="zoek"
              onChange={(e) => {
                setZoek(e.target.value);
                if (page !== 1) {
                  const search = new URLSearchParams(params);
                  search.delete("page");
                  setParams(search);
                }
              }}
              placeholder="Naam, doel of doelgroep..."
              value={zoek}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">
              Toon statussen
            </span>
            <ul className="flex flex-col">
              {STATUS_CHIPS.map((chip) => {
                const active = selectedStatuses.has(chip.value);
                const count = statusCounts[chip.value];
                return (
                  <li key={chip.value}>
                    <label
                      className={`flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60 ${
                        active ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <input
                        checked={active}
                        className="size-4 rounded border-input accent-primary"
                        onChange={() => toggleStatus(chip.value)}
                        type="checkbox"
                      />
                      <span className="flex-1">{chip.label}</span>
                      <span className="tabular-nums text-muted-foreground text-xs">
                        {count}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
                  <tr>
                    <HeaderCell
                      active={sortKey === "naam"}
                      label="Naam"
                      onSort={() => toggleSort("naam")}
                      order={sortOrder}
                    />
                    <th className="whitespace-nowrap px-4 py-3 text-left">
                      Status
                    </th>
                    <HeaderCell
                      active={sortKey === "vervaldatum"}
                      label="Vervaldatum"
                      onSort={() => toggleSort("vervaldatum")}
                      order={sortOrder}
                    />
                    <th
                      className="whitespace-nowrap px-4 py-3 text-left"
                      title="Laatste inhoudelijke wijziging van de regeling op overheid.nl"
                    >
                      Gewijzigd bij bron
                    </th>
                    <HeaderCell
                      active={sortKey === "updatedAt"}
                      label="Laatst bewerkt"
                      onSort={() => toggleSort("updatedAt")}
                      order={sortOrder}
                      title="Laatste aanpassing in KID, door sync of beheerder"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visible === null ? (
                    <tr>
                      <td colSpan={5}>
                        <GhostList count={5} label="Laden..." />
                      </td>
                    </tr>
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <GhostList
                          count={4}
                          label={
                            total === 0
                              ? hasActiveFilter
                                ? "Geen regelingen gevonden voor deze filters"
                                : "Nog geen regelingen aangemaakt"
                              : "Geen regelingen in de geselecteerde statussen"
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    visible.map((r) => (
                      <Row fresh={flashIds.has(r.id)} key={r.id} regeling={r} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {regelingen && total > 0 ? (
            <PaginationFooter
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PaginationFooter({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">
        {start}–{end} van {total}
      </span>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-muted-foreground text-xs">
          Per pagina:
          <select
            className="rounded-md border border-input bg-background px-2 py-1 text-foreground text-sm"
            onChange={(e) =>
              onPageSizeChange(Number.parseInt(e.target.value, 10))
            }
            value={pageSize}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Vorige pagina"
            className="h-8 px-2"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            variant="outline"
          >
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
          </Button>
          <span className="px-2 text-muted-foreground text-xs">
            {page} / {totalPages}
          </span>
          <Button
            aria-label="Volgende pagina"
            className="h-8 px-2"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            variant="outline"
          >
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SyncSplitButton({
  onStart,
}: {
  onStart: (mode: "update" | "reprocess") => void;
}) {
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-md border bg-background shadow-xs">
      <Button
        className="rounded-none border-0 shadow-none"
        onClick={() => onStart("update")}
        variant="ghost"
      >
        Synchroniseren
        <CloudDownloadIcon
          aria-hidden="true"
          className="ml-1.5 size-4"
          strokeWidth={2.5}
        />
      </Button>
      <span aria-hidden="true" className="w-px self-stretch bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Sync-modus kiezen"
            className="rounded-none border-0 px-2 shadow-none"
            variant="ghost"
          >
            <ChevronDownIcon aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuItem
            className="flex-col items-start gap-0.5"
            onSelect={() => onStart("update")}
          >
            <div className="flex items-center gap-2 font-medium">
              <CloudDownloadIcon aria-hidden="true" className="size-4" />
              Bijwerken
            </div>
            <span className="pl-6 text-muted-foreground text-xs">
              Alleen nieuwe of gewijzigde regelingen
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex-col items-start gap-0.5"
            onSelect={() => onStart("reprocess")}
          >
            <div className="flex items-center gap-2 font-medium">
              <RotateCwIcon aria-hidden="true" className="size-4" />
              Alles opnieuw verwerken
            </div>
            <span className="pl-6 text-muted-foreground text-xs">
              Ook regelingen zonder wijzigingen — duurt langer
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function HeaderCell({
  label,
  active,
  order,
  onSort,
  title,
}: {
  label: string;
  active: boolean;
  order: SortOrder;
  onSort: () => void;
  title?: string;
}) {
  const Icon = active
    ? order === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon
    : ArrowUpDownIcon;
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left" title={title}>
      <button
        className="flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
        onClick={onSort}
        type="button"
      >
        {label}
        <Icon
          aria-hidden="true"
          className={`size-3 ${
            active ? "text-foreground/70" : "text-foreground/30"
          }`}
        />
      </button>
    </th>
  );
}

function Row({
  regeling,
  fresh,
}: {
  regeling: SubsidieRegeling;
  fresh: boolean;
}) {
  const navigate = useNavigate();
  const dagen = daysUntil(regeling.vervaldatum);
  const relatief = formatRelative(regeling.vervaldatum);
  const showUrgencyText = regeling.status === "ACTIEF" && dagen !== null;
  const detailHref = `/admin/subsidieregelingen/${regeling.id}`;
  const openDetail = () => navigate(detailHref);
  return (
    <tr
      className="cursor-pointer hover:bg-muted/30"
      data-cvdr-fresh={fresh ? "true" : undefined}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail();
        }
      }}
      tabIndex={0}
    >
      <td className="px-4 py-3">
        <span className="font-medium" title={regeling.naam}>
          {regeling.naam}
        </span>
        {regeling.deadLinkSince ? (
          <p className="mt-0.5 text-destructive/80 text-xs">
            Bron-URL onbereikbaar sinds {formatDate(regeling.deadLinkSince)}
          </p>
        ) : null}
        {regeling.vervangenDoor ? (
          <p className="mt-0.5 text-muted-foreground text-xs">
            vervangen door{" "}
            <Link
              className="underline hover:text-foreground"
              to={`/admin/subsidieregelingen/${regeling.vervangenDoor.id}`}
            >
              {regeling.vervangenDoor.naam}
            </Link>
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={regeling.status} />
      </td>
      <td className="px-4 py-3">
        {regeling.vervaldatum ? (
          <div className="flex flex-col leading-tight">
            <span>{formatDate(regeling.vervaldatum)}</span>
            {showUrgencyText && dagen !== null ? (
              <span className={`text-xs ${urgencyTextClass(dagen)}`}>
                {relatief}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">
                {relatief ?? ""}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm">
        {regeling.bronGewijzigdOp ? formatDate(regeling.bronGewijzigdOp) : "—"}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm">
        {regeling.updatedAt ? formatDate(regeling.updatedAt) : "—"}
      </td>
    </tr>
  );
}

function subtitleCopy(
  total: number,
  aandacht: number,
  hasActiveFilter: boolean
): string {
  if (total === 0) {
    return hasActiveFilter
      ? "Geen regelingen gevonden voor deze filters."
      : "Nog geen regelingen aangemaakt. Klik op 'Nieuwe regeling' om te beginnen.";
  }
  const totaalLabel = `${total} ${total === 1 ? "regeling" : "regelingen"}`;
  if (aandacht === 0) {
    return `${totaalLabel} · alles staat op groen`;
  }
  const aandachtLabel =
    aandacht === 1 ? "1 vraagt aandacht" : `${aandacht} vragen aandacht`;
  return `${totaalLabel} · ${aandachtLabel}`;
}
