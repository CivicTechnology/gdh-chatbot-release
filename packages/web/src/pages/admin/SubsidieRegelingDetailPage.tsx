import { motion } from "framer-motion";
import { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  type RegelingInput,
  type SubsidieAuditEvent,
  type SubsidieDoelgroepCluster,
  type SubsidiePlafond,
  type SubsidieRegeling,
  type SubsidieVersie,
  subsidieApi,
} from "@/api/subsidieregeling";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatEuro,
} from "@/lib/format";
import { FadeMount, StatusPill, Uitroepteken } from "./_components";

type Tab = "inhoud" | "metadata" | "versies";

const TAB_LABEL: Record<Tab, string> = {
  inhoud: "Inhoud",
  metadata: "Doelgroep & looptijd",
  versies: "Versies",
};

const TAB_ORDER: Tab[] = ["inhoud", "metadata", "versies"];

const LEGE_REGELING: RegelingInput = {
  naam: "",
  doel: "",
  voorwaarden: "",
  aanvraagprocedure: "",
  bronUrl: "",
  bronType: "LOKALEREGELGEVING",
  doelgroepNaam: "",
  doelgroepCluster: "MAATSCHAPPELIJK",
  vervaldatum: null,
  maxBedragAanvrager: null,
  totaalSubsidiePlafond: null,
};

/**
 * Verplichte velden voor publicatie. Spiegelt de API-validatie van
 * SubsidieRegelingPublishableSchema. Voor concept-opslag mag alles leeg.
 */
const REQUIRED_FOR_PUBLISH: Array<{
  key: keyof RegelingInput;
  label: string;
  tab: Tab;
  minLength?: number;
}> = [
  { key: "naam", label: "Naam", tab: "inhoud", minLength: 2 },
  { key: "doel", label: "Doel", tab: "inhoud", minLength: 10 },
  { key: "voorwaarden", label: "Voorwaarden", tab: "inhoud", minLength: 10 },
  {
    key: "aanvraagprocedure",
    label: "Aanvraagprocedure",
    tab: "inhoud",
    minLength: 10,
  },
  { key: "bronUrl", label: "Bron-URL", tab: "inhoud" },
  {
    key: "doelgroepNaam",
    label: "Doelgroep (verordening)",
    tab: "metadata",
    minLength: 2,
  },
  { key: "doelgroepCluster", label: "Doelgroep-cluster", tab: "metadata" },
];

export default function SubsidieRegelingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "nieuw";

  const [regeling, setRegeling] = useState<SubsidieRegeling | null>(null);
  const [draft, setDraft] = useState<RegelingInput>(LEGE_REGELING);
  const [tab, setTab] = useState<Tab>("inhoud");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"info" | "error">("info");
  const [versies, setVersies] = useState<SubsidieVersie[]>([]);
  const [auditEvents, setAuditEvents] = useState<SubsidieAuditEvent[]>([]);
  const [allActive, setAllActive] = useState<SubsidieRegeling[]>([]);
  const [opvolgerId, setOpvolgerId] = useState("");
  const [vervangtId, setVervangtId] = useState("");
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const readOnly =
    regeling?.status === "GEARCHIVEERD" ||
    regeling?.status === "GEARCHIVEERD_VERVANGEN" ||
    regeling?.status === "VERLOPEN";

  useEffect(() => {
    if (isNew) {
      setDraft(LEGE_REGELING);
      setRegeling(null);
      setIsDirty(false);
      return;
    }
    if (!id) return;
    const regelingId = id;
    let cancelled = false;
    async function load() {
      const response = await subsidieApi.show(regelingId);
      if (cancelled) return;
      if (response.data) {
        setRegeling(response.data);
        setDraft(toDraft(response.data));
        setIsDirty(false);
      } else {
        setFeedbackTone("error");
        setFeedback(response.error ?? "Regeling niet gevonden");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2000);
    return () => clearTimeout(t);
  }, [savedFlash]);

  useEffect(() => {
    if (tab !== "versies" || isNew || !id) return;
    const regelingId = id;
    let cancelled = false;
    async function loadHistory() {
      const response = await subsidieApi.history(regelingId);
      if (cancelled) return;
      if (response.data) {
        setVersies(response.data.versies);
        setAuditEvents(response.data.auditEvents);
      }
    }
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [tab, id, isNew]);

  useEffect(() => {
    // Lijst van actieve regelingen is relevant voor:
    //  - status ACTIEF: 'Vervangen door'-picker (oude -> nieuwe)
    //  - status CONCEPT: 'Vervangt regeling'-picker (nieuwe vervangt oude)
    //  - isNew (nog niet opgeslagen): zelfde picker, vervangtId wordt
    //    bij eerste publish toegepast
    if (!isNew && !regeling) return;
    if (
      regeling &&
      regeling.status !== "ACTIEF" &&
      regeling.status !== "CONCEPT"
    )
      return;
    let cancelled = false;
    async function loadActiveList() {
      const query = new URLSearchParams({ status: "ACTIEF" });
      const response = await subsidieApi.list(query);
      if (cancelled) return;
      if (response.data) {
        setAllActive(
          response.data.regelingen.filter((r) => r.id !== regeling?.id)
        );
      }
    }
    loadActiveList();
    return () => {
      cancelled = true;
    };
  }, [regeling, isNew]);

  const missingForPublish = useMemo(() => {
    return REQUIRED_FOR_PUBLISH.filter((field) => {
      const value = draft[field.key];
      if (value === null || value === undefined || value === "") return true;
      if (
        typeof value === "string" &&
        field.minLength &&
        value.trim().length < field.minLength
      ) {
        return true;
      }
      return false;
    });
  }, [draft]);

  const canPublish = !readOnly && !isNew && missingForPublish.length === 0;

  const missingByTab = useMemo(() => {
    const acc: Record<Tab, number> = { inhoud: 0, metadata: 0, versies: 0 };
    for (const m of missingForPublish) {
      acc[m.tab] += 1;
    }
    return acc;
  }, [missingForPublish]);

  const validationErrors = useMemo(() => {
    const acc: Partial<Record<keyof RegelingInput, string>> = {};
    for (const field of REQUIRED_FOR_PUBLISH) {
      const value = draft[field.key];
      if (value === null || value === undefined || value === "") {
        acc[field.key] = "Verplicht voor publicatie";
        continue;
      }
      if (typeof value === "string" && field.minLength) {
        const len = value.trim().length;
        if (len < field.minLength) {
          acc[field.key] =
            `Nog te kort — minimaal ${field.minLength} tekens (nu ${len})`;
        }
      }
    }
    return acc;
  }, [draft]);

  const handleField = <K extends keyof RegelingInput>(
    key: K,
    value: RegelingInput[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const showFeedback = (message: string, tone: "info" | "error" = "info") => {
    setFeedbackTone(tone);
    setFeedback(message);
  };

  const handleSave = async () => {
    setBusy(true);
    setFeedback(null);
    const payload = normalizeDraft(draft);
    if (!(isNew || id)) {
      setBusy(false);
      showFeedback("Regeling niet gevonden", "error");
      return;
    }
    const response =
      isNew || !id
        ? await subsidieApi.create(payload)
        : await subsidieApi.update(id, payload);
    setBusy(false);
    if (response.data) {
      setIsDirty(false);
      setSavedFlash(true);
      if (isNew) {
        navigate(`/admin/subsidieregelingen/${response.data.id}`, {
          replace: true,
        });
      } else {
        setRegeling(response.data);
      }
    } else {
      showFeedback(response.error ?? "Opslaan mislukt", "error");
    }
  };

  const handlePublish = async () => {
    if (!id || isNew) return;
    setBusy(true);
    setFeedback(null);
    await subsidieApi.update(id, normalizeDraft(draft));
    const response = await subsidieApi.publish(id, vervangtId || undefined);
    setBusy(false);
    if (response.data) {
      setRegeling(response.data);
      setDraft(toDraft(response.data));
      setVervangtId("");
      showFeedback(
        vervangtId
          ? "Regeling gepubliceerd. Oude regeling is gearchiveerd."
          : "Regeling gepubliceerd."
      );
    } else {
      showFeedback(response.error ?? "Publiceren mislukt", "error");
    }
  };

  const handleReplace = async () => {
    setReplaceConfirmOpen(false);
    if (!id || !opvolgerId) return;
    setBusy(true);
    setFeedback(null);
    const response = await subsidieApi.replaceBy(id, opvolgerId);
    setBusy(false);
    if (response.data) {
      setRegeling(response.data);
      showFeedback("Regeling gearchiveerd en gekoppeld aan opvolger.");
    } else {
      showFeedback(response.error ?? "Archiveren mislukt", "error");
    }
  };

  const handleArchive = async () => {
    setArchiveConfirmOpen(false);
    if (!id) return;
    setBusy(true);
    setFeedback(null);
    const response = await subsidieApi.archive(id);
    setBusy(false);
    if (response.data) {
      setRegeling(response.data);
      showFeedback("Regeling gearchiveerd.");
    } else {
      showFeedback(response.error ?? "Archiveren mislukt", "error");
    }
  };

  const handleDelete = async () => {
    setDeleteConfirmOpen(false);
    if (!id) return;
    setBusy(true);
    setFeedback(null);
    const response = await subsidieApi.destroy(id);
    setBusy(false);
    if (response.error) {
      showFeedback(response.error, "error");
    } else {
      navigate("/admin/subsidieregelingen");
    }
  };

  const handleUnarchive = async () => {
    if (!id) return;
    setBusy(true);
    setFeedback(null);
    const response = await subsidieApi.unarchive(id);
    setBusy(false);
    if (response.data) {
      setRegeling(response.data);
      showFeedback("Regeling weer actief.");
    } else {
      showFeedback(response.error ?? "Heractiveren mislukt", "error");
    }
  };

  const opvolgerNaam = useMemo(() => {
    if (!opvolgerId) return null;
    return allActive.find((r) => r.id === opvolgerId)?.naam ?? null;
  }, [opvolgerId, allActive]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <Link
              className="text-muted-foreground text-sm hover:underline"
              to="/admin/subsidieregelingen"
            >
              ← Terug naar lijst
            </Link>
            {regeling ? <StatusPill status={regeling.status} /> : null}
            {regeling?.deadLinkSince ? (
              <span className="flex items-center gap-1 text-destructive text-sm">
                <Uitroepteken title="Bron-URL onbereikbaar" tone="urgent" />
                Bron-URL onbereikbaar sinds {formatDate(regeling.deadLinkSince)}
              </span>
            ) : null}
          </div>
          <h1 className="max-w-3xl font-semibold text-2xl">
            {isNew ? "Nieuwe regeling" : regeling?.naam || "Regeling"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-live="polite"
            className={`text-muted-foreground text-xs transition-opacity duration-300 ${
              savedFlash ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            Opgeslagen
          </span>
          {!isNew && regeling?.status === "ACTIEF" ? (
            <Button
              disabled={busy}
              onClick={() => setArchiveConfirmOpen(true)}
              size="sm"
              variant="ghost"
            >
              Archiveren
            </Button>
          ) : null}
          {!isNew && regeling?.status === "CONCEPT" ? (
            <Button
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => setDeleteConfirmOpen(true)}
              size="sm"
              variant="ghost"
            >
              Verwijderen
            </Button>
          ) : null}
          {!isNew && regeling?.status === "GEARCHIVEERD" ? (
            <Button disabled={busy} onClick={handleUnarchive} variant="outline">
              Uit archief halen
            </Button>
          ) : null}
          <Button
            disabled={busy || readOnly || (!isNew && !isDirty)}
            onClick={handleSave}
            variant="outline"
          >
            {isNew ? "Opslaan als concept" : "Wijzigingen opslaan"}
          </Button>
          {!isNew && !readOnly ? (
            <Button
              disabled={busy || !canPublish}
              onClick={handlePublish}
              title={
                canPublish
                  ? undefined
                  : `Eerst ${missingForPublish.length} verplichte veld(en) invullen`
              }
            >
              Publiceren
              {missingForPublish.length > 0 ? (
                <span className="ml-2 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                  {missingForPublish.length}
                </span>
              ) : null}
            </Button>
          ) : null}
        </div>
      </header>

      {feedback && feedbackTone === "error" ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {feedback}
        </p>
      ) : null}

      {regeling?.status === "GEARCHIVEERD_VERVANGEN" &&
      regeling.vervangenDoor ? (
        <div className="rounded-md border bg-muted/30 p-4 text-sm">
          Deze regeling is gearchiveerd omdat ze is vervangen door{" "}
          <Link
            className="font-medium text-primary hover:underline"
            to={`/admin/subsidieregelingen/${regeling.vervangenDoor.id}`}
          >
            {regeling.vervangenDoor.naam}
          </Link>
          . Alle velden zijn alleen-lezen.
        </div>
      ) : null}

      {!isNew && missingForPublish.length > 0 && !readOnly ? (
        <p className="text-amber-700 text-sm dark:text-amber-400">
          Nog {missingForPublish.length} verplichte veld
          {missingForPublish.length === 1 ? "" : "en"} voor publicatie.
        </p>
      ) : null}

      <TabsNav active={tab} missingByTab={missingByTab} onChange={setTab} />

      <FadeMount keyId={tab}>
        {tab === "inhoud" ? (
          <InhoudTab
            disabled={readOnly}
            draft={draft}
            errors={validationErrors}
            onChange={handleField}
          />
        ) : tab === "metadata" ? (
          <>
            <MetadataTab
              activeListVoorVervanging={allActive}
              disabled={readOnly}
              draft={draft}
              errors={validationErrors}
              isArchived={regeling?.status === "GEARCHIVEERD_VERVANGEN"}
              onChange={handleField}
              onReplaceConfirm={() => setReplaceConfirmOpen(true)}
              opvolgerId={opvolgerId}
              setOpvolgerId={setOpvolgerId}
              setVervangtId={setVervangtId}
              status={regeling?.status}
              vervangenDoor={regeling?.vervangenDoor ?? null}
              vervangtId={vervangtId}
            />
            {regeling ? (
              <BronMetadataPanel
                laatsteVersie={versies[0] ?? null}
                regeling={regeling}
              />
            ) : null}
          </>
        ) : (
          <VersiesTab auditEvents={auditEvents} versies={versies} />
        )}
      </FadeMount>

      <AlertDialog
        onOpenChange={setReplaceConfirmOpen}
        open={replaceConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regeling vervangen?</AlertDialogTitle>
            <AlertDialogDescription>
              De huidige regeling{regeling ? ` "${regeling.naam}"` : ""} wordt
              gearchiveerd en gemarkeerd als vervangen door
              {opvolgerNaam ? ` "${opvolgerNaam}"` : " de opvolger"}. In de
              zoektool wordt vanaf nu de opvolger getoond met een melding dat
              deze regeling is vervangen. Deze actie kan niet ongedaan worden
              gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleReplace}>
              Vervangen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog onOpenChange={setDeleteConfirmOpen} open={deleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concept verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Het concept{regeling ? ` "${regeling.naam}"` : ""} wordt
              definitief verwijderd, inclusief de audit-historie. Een concept
              dat uit de overheid.nl-sync komt, kan bij een volgende sync-run
              opnieuw als concept verschijnen. Deze actie kan niet ongedaan
              worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={setArchiveConfirmOpen}
        open={archiveConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regeling archiveren?</AlertDialogTitle>
            <AlertDialogDescription>
              De regeling{regeling ? ` "${regeling.naam}"` : ""} wordt
              gearchiveerd en verschijnt niet meer in de chatbot-zoektool.
              Versies en audit-historie blijven bewaard. Gebruik "Vervangen
              door" als je een nieuwe regeling als opvolger wilt koppelen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archiveren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TabsNav({
  active,
  onChange,
  missingByTab,
}: {
  active: Tab;
  onChange: (next: Tab) => void;
  missingByTab: Record<Tab, number>;
}) {
  const layoutId = useId();
  return (
    <nav className="flex gap-1 border-b">
      {TAB_ORDER.map((key) => {
        const isActive = active === key;
        const missing = missingByTab[key];
        return (
          <button
            className={`relative px-4 py-2 text-sm transition-colors ${
              isActive
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            key={key}
            onClick={() => onChange(key)}
            type="button"
          >
            {TAB_LABEL[key]}
            {missing > 0 ? (
              <span
                aria-label={`${missing} verplichte veld${missing === 1 ? "" : "en"} ontbreekt`}
                role="img"
                className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-100 px-1 text-[11px] text-amber-900 leading-none dark:bg-amber-900/40 dark:text-amber-200"
              >
                {missing}
              </span>
            ) : null}
            {isActive ? (
              <motion.span
                aria-hidden="true"
                className="absolute right-0 bottom-[-1px] left-0 h-0.5 bg-primary"
                initial={false}
                layoutId={`tab-underline-${layoutId}`}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function InhoudTab({
  draft,
  onChange,
  disabled,
  errors,
}: {
  draft: RegelingInput;
  onChange: <K extends keyof RegelingInput>(
    key: K,
    value: RegelingInput[K]
  ) => void;
  disabled: boolean;
  errors: Partial<Record<keyof RegelingInput, string>>;
}) {
  return (
    <div className="grid gap-4">
      <Field error={errors.naam} label="Naam" required>
        <Input
          disabled={disabled}
          onChange={(e) => onChange("naam", e.target.value)}
          value={draft.naam ?? ""}
        />
      </Field>
      <Field
        error={errors.doel}
        hint="Wat wil de regeling bereiken? Komt 1-op-1 in de chatbot-antwoorden."
        label="Doel"
        required
      >
        <Textarea
          disabled={disabled}
          onChange={(e) => onChange("doel", e.target.value)}
          rows={3}
          value={draft.doel ?? ""}
        />
      </Field>
      <Field
        error={errors.voorwaarden}
        hint="Welke eisen gelden voor een aanvrager? Minimaal 10 tekens."
        label="Voorwaarden"
        required
      >
        <Textarea
          disabled={disabled}
          onChange={(e) => onChange("voorwaarden", e.target.value)}
          rows={4}
          value={draft.voorwaarden ?? ""}
        />
      </Field>
      <Field
        error={errors.aanvraagprocedure}
        hint="Hoe vraagt iemand de regeling aan? Vermeld stappen en eventueel een loket."
        label="Aanvraagprocedure"
        required
      >
        <Textarea
          disabled={disabled}
          onChange={(e) => onChange("aanvraagprocedure", e.target.value)}
          rows={3}
          value={draft.aanvraagprocedure ?? ""}
        />
      </Field>
      <Field
        error={errors.bronUrl}
        hint="Standaard naar lokaleregelgeving.nl; PDF mag als fallback."
        label="Bron-URL"
        required
      >
        <Input
          disabled={disabled}
          onChange={(e) => onChange("bronUrl", e.target.value)}
          placeholder="https://lokaleregelgeving.overheid.nl/..."
          value={draft.bronUrl ?? ""}
        />
      </Field>
    </div>
  );
}

/**
 * Read-only blok met de herkomst-informatie uit de overheid.nl-feed plus het
 * interne KID-publicatiemoment. Maakt het onderscheid expliciet tussen
 * "gewijzigd bij de bron" en "bewerkt/gepubliceerd op KID".
 */
function BronMetadataPanel({
  regeling,
  laatsteVersie,
}: {
  regeling: SubsidieRegeling;
  laatsteVersie: SubsidieVersie | null;
}) {
  const datumRows: Array<{ label: string; value: string }> = [
    {
      label: "Officieel bekendgemaakt",
      value: regeling.publicatieDatum
        ? formatDate(regeling.publicatieDatum)
        : "—",
    },
    {
      label: "Regeling gewijzigd bij bron",
      value: regeling.bronGewijzigdOp
        ? formatDate(regeling.bronGewijzigdOp)
        : "—",
    },
    {
      label: "Laatst gecontroleerd tegen overheid.nl",
      value: regeling.bronGecontroleerdOp
        ? formatDate(regeling.bronGecontroleerdOp)
        : "—",
    },
    {
      label: "Gepubliceerd op KID",
      value: laatsteVersie
        ? `${formatDateTime(laatsteVersie.gepubliceerdOp)} (versie ${laatsteVersie.versienummer}${
            laatsteVersie.gepubliceerdDoor
              ? `, door ${laatsteVersie.gepubliceerdDoor.email}`
              : ""
          })`
        : "—",
    },
  ];

  const bronRows: Array<{ label: string; value: string; href?: string }> = [];
  if (regeling.grondslag) {
    bronRows.push({
      label: "Wettelijke grondslag",
      value: regeling.grondslag,
      href: regeling.grondslagUrl ?? undefined,
    });
  }
  if (regeling.bekendmakingUrl || regeling.bekendmakingKenmerk) {
    bronRows.push({
      label: "Officiële bekendmaking",
      value: regeling.bekendmakingKenmerk ?? "Gemeenteblad",
      href: regeling.bekendmakingUrl ?? undefined,
    });
  }
  if (regeling.thema) {
    bronRows.push({ label: "Thema", value: regeling.thema });
  }
  if (regeling.vastgesteldDoor) {
    bronRows.push({
      label: "Vastgesteld door",
      value: regeling.vastgesteldDoor,
    });
  }
  if (regeling.kenmerk) {
    bronRows.push({ label: "Kenmerk", value: regeling.kenmerk });
  }
  if (regeling.betreft) {
    bronRows.push({ label: "Betreft", value: regeling.betreft });
  }
  if (regeling.terugwerkendeKrachtTot) {
    bronRows.push({
      label: "Terugwerkende kracht tot",
      value: formatDate(regeling.terugwerkendeKrachtTot),
    });
  }
  if (regeling.externeBijlage) {
    bronRows.push({
      label: "Externe bijlage",
      value: regeling.externeBijlage,
    });
  }

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-4">
      <h3 className="mb-1 font-medium text-sm">Herkomst &amp; actualiteit</h3>
      <p className="mb-3 text-muted-foreground text-xs">
        Deze gegevens komen uit de officiële CVDR-feed van overheid.nl en worden
        automatisch bijgehouden door de sync.
      </p>
      <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
        {datumRows.map((row) => (
          <div className="flex flex-col" key={row.label}>
            <dt className="text-muted-foreground text-xs">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        {bronRows.map((row) => (
          <div className="flex flex-col" key={row.label}>
            <dt className="text-muted-foreground text-xs">{row.label}</dt>
            <dd>
              {row.href ? (
                <a
                  className="underline hover:text-foreground"
                  href={row.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MetadataTab({
  draft,
  onChange,
  status,
  isArchived,
  vervangenDoor,
  activeListVoorVervanging,
  opvolgerId,
  setOpvolgerId,
  vervangtId,
  setVervangtId,
  onReplaceConfirm,
  disabled,
  errors,
}: {
  draft: RegelingInput;
  onChange: <K extends keyof RegelingInput>(
    key: K,
    value: RegelingInput[K]
  ) => void;
  status?: SubsidieRegeling["status"];
  isArchived: boolean;
  vervangenDoor: SubsidieRegeling["vervangenDoor"];
  activeListVoorVervanging: SubsidieRegeling[];
  opvolgerId: string;
  setOpvolgerId: (v: string) => void;
  vervangtId: string;
  setVervangtId: (v: string) => void;
  onReplaceConfirm: () => void;
  disabled: boolean;
  errors: Partial<Record<keyof RegelingInput, string>>;
}) {
  const dagenTotVervaldatum = daysUntil(draft.vervaldatum ?? null);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        error={errors.doelgroepNaam}
        hint="Letterlijke doelgroep uit de verordening (bv. 'woningbezitter')."
        label="Doelgroep (uit verordening)"
        required
      >
        <Input
          disabled={disabled}
          onChange={(e) => onChange("doelgroepNaam", e.target.value)}
          value={draft.doelgroepNaam ?? ""}
        />
      </Field>
      <Field
        error={errors.doelgroepCluster}
        hint="Cluster waarmee de chatbot intern filtert."
        label="Doelgroep-cluster"
        required
      >
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
          disabled={disabled}
          onChange={(e) =>
            onChange(
              "doelgroepCluster",
              e.target.value as RegelingInput["doelgroepCluster"]
            )
          }
          value={draft.doelgroepCluster ?? "MAATSCHAPPELIJK"}
        >
          <option value="PARTICULIER">Particulier</option>
          <option value="BEDRIJF">Bedrijf</option>
          <option value="MAATSCHAPPELIJK">Maatschappelijk initiatief</option>
        </select>
      </Field>
      <Field
        hint={
          dagenTotVervaldatum !== null
            ? dagenTotVervaldatum < 0
              ? `Reeds ${Math.abs(dagenTotVervaldatum)} dagen geleden verlopen`
              : `Over ${dagenTotVervaldatum} dagen`
            : "Optioneel: doorlopende regelingen hebben geen einddatum."
        }
        label="Vervaldatum"
      >
        <DatePicker
          disabled={disabled}
          onChange={(d) =>
            onChange("vervaldatum", d ? d.toISOString().slice(0, 10) : null)
          }
          value={
            draft.vervaldatum ? new Date(draft.vervaldatum.slice(0, 10)) : null
          }
        />
      </Field>
      <Field
        hint="Maximum dat één aanvrager kan ontvangen."
        label="Max. bedrag per aanvrager (€)"
      >
        <Input
          className="no-spinner"
          disabled={disabled}
          min={0}
          onChange={(e) =>
            onChange(
              "maxBedragAanvrager",
              e.target.value ? Number(e.target.value) : null
            )
          }
          step="0.01"
          type="number"
          value={draft.maxBedragAanvrager ?? ""}
        />
        {draft.maxBedragAanvrager ? (
          <span className="text-muted-foreground text-xs">
            = {formatEuro(draft.maxBedragAanvrager, true)}
          </span>
        ) : null}
      </Field>
      <Field
        hint="Totaal budget voor deze regeling. Wordt statisch getoond, niet realtime."
        label="Totaal subsidieplafond (€)"
      >
        <Input
          className="no-spinner"
          disabled={disabled}
          min={0}
          onChange={(e) =>
            onChange(
              "totaalSubsidiePlafond",
              e.target.value ? Number(e.target.value) : null
            )
          }
          step="0.01"
          type="number"
          value={draft.totaalSubsidiePlafond ?? ""}
        />
        {draft.totaalSubsidiePlafond ? (
          <span className="text-muted-foreground text-xs">
            = {formatEuro(draft.totaalSubsidiePlafond, true)}
          </span>
        ) : null}
      </Field>
      <PlafondsEditor
        disabled={disabled}
        onChange={(next) => onChange("plafonds", next)}
        value={draft.plafonds ?? []}
      />
      <Field label="Bron-type">
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
          disabled={disabled}
          onChange={(e) =>
            onChange("bronType", e.target.value as RegelingInput["bronType"])
          }
          value={draft.bronType ?? "LOKALEREGELGEVING"}
        >
          <option value="LOKALEREGELGEVING">lokaleregelgeving.nl</option>
          <option value="PDF">PDF</option>
          <option value="OVERIG">Overig</option>
        </select>
      </Field>
      {status === "CONCEPT" || status === undefined ? (
        <div className="col-span-full mt-4 rounded-lg border bg-muted/30 p-4">
          <h3 className="mb-1 font-medium text-sm">
            Vervangt een bestaande regeling (optioneel)
          </h3>
          <p className="mb-3 text-muted-foreground text-xs">
            Selecteer welke actieve regeling deze opvolgt. Bij publicatie wordt
            de oude regeling automatisch gearchiveerd en in de chatbot komt
            eenmalig de melding "deze regeling is vervangen door [naam]".
          </p>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
            disabled={disabled}
            onChange={(e) => setVervangtId(e.target.value)}
            value={vervangtId}
          >
            <option value="">— geen, dit is een nieuwe regeling —</option>
            {activeListVoorVervanging.map((r) => (
              <option key={r.id} value={r.id}>
                {r.naam}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {status === "ACTIEF" ? (
        <div className="col-span-full mt-4 rounded-lg border bg-muted/30 p-4">
          <h3 className="mb-1 font-medium text-sm">Vervangen door...</h3>
          <p className="mb-3 text-muted-foreground text-xs">
            Koppel een opvolger. Deze regeling wordt gearchiveerd; de opvolger
            blijft actief in de zoektool. In de chatbot komt eenmalig de melding
            "deze regeling is vervangen door X".
          </p>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              onChange={(e) => setOpvolgerId(e.target.value)}
              value={opvolgerId}
            >
              <option value="">— kies een actieve regeling —</option>
              {activeListVoorVervanging.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.naam}
                </option>
              ))}
            </select>
            <Button
              disabled={!opvolgerId}
              onClick={onReplaceConfirm}
              variant="outline"
            >
              Vervangen…
            </Button>
          </div>
        </div>
      ) : null}
      {isArchived && vervangenDoor ? (
        <div className="col-span-full mt-4 rounded-lg border bg-muted/30 p-4 text-sm">
          Deze regeling is vervangen door{" "}
          <Link
            className="font-medium text-primary hover:underline"
            to={`/admin/subsidieregelingen/${vervangenDoor.id}`}
          >
            {vervangenDoor.naam}
          </Link>
          .
        </div>
      ) : null}
    </div>
  );
}

const LEEG_PLAFOND: SubsidiePlafond = {
  doelgroepCluster: "PARTICULIER",
  doelgroepNaam: "",
  maxBedragAanvrager: null,
  totaalSubsidiePlafond: null,
  omschrijving: "",
};

/**
 * Bewerkbare staffeling: nul of meer bedragen per doelgroep binnen één regeling.
 * Leeg laten betekent "één bedrag voor iedereen" — dan gelden de losse
 * bedrag-velden hierboven. De CVDR-sync vult dit automatisch; hier kan een
 * beheerder het corrigeren of (bij een handmatig fonds) zelf invoeren.
 */
function PlafondsEditor({
  value,
  onChange,
  disabled,
}: {
  value: SubsidiePlafond[];
  onChange: (next: SubsidiePlafond[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, patch: Partial<SubsidiePlafond>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const addRow = () => onChange([...value, { ...LEEG_PLAFOND }]);
  const removeRow = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  return (
    <div className="col-span-full rounded-lg border bg-muted/30 p-4">
      <h3 className="mb-1 font-medium text-sm">Bedragen per doelgroep</h3>
      <p className="mb-3 text-muted-foreground text-xs">
        Alleen invullen als de regeling verschillende bedragen per doelgroep
        kent (bv. particulier max € 750, organisatie hoger). Laat dit leeg als
        één bedrag voor iedereen geldt — dan gelden de bedragen hierboven. De
        chatbot toont het bedrag dat past bij de doelgroep van de gebruiker.
      </p>

      {value.length === 0 ? (
        <PlafondsLeeg disabled={disabled} onAdd={addRow} />
      ) : (
        <div className="flex flex-col gap-3">
          {value.map((row, index) => (
            <div
              className="rounded-md border bg-background p-3"
              // biome-ignore lint/suspicious/noArrayIndexKey: rijen hebben geen stabiel id; volgorde wijzigt niet en de inputs zijn volledig controlled
              key={`plafond-${index}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Doelgroep {index + 1}
                </span>
                {disabled ? null : (
                  <Button
                    className="h-auto px-2 py-1 text-destructive text-xs hover:text-destructive"
                    onClick={() => removeRow(index)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Verwijderen
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Doelgroep-cluster">
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
                    disabled={disabled}
                    onChange={(e) =>
                      update(index, {
                        doelgroepCluster: e.target
                          .value as SubsidieDoelgroepCluster,
                      })
                    }
                    value={row.doelgroepCluster}
                  >
                    <option value="PARTICULIER">Particulier</option>
                    <option value="BEDRIJF">Bedrijf</option>
                    <option value="MAATSCHAPPELIJK">
                      Maatschappelijk initiatief
                    </option>
                  </select>
                </Field>
                <Field
                  hint="Bv. 'woningbezitter' of 'stichting'."
                  label="Doelgroep (omschrijving)"
                >
                  <Input
                    disabled={disabled}
                    onChange={(e) =>
                      update(index, { doelgroepNaam: e.target.value })
                    }
                    value={row.doelgroepNaam}
                  />
                </Field>
                <Field label="Max. bedrag per aanvrager (€)">
                  <Input
                    className="no-spinner"
                    disabled={disabled}
                    min={0}
                    onChange={(e) =>
                      update(index, {
                        maxBedragAanvrager: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    step="0.01"
                    type="number"
                    value={row.maxBedragAanvrager ?? ""}
                  />
                </Field>
                <Field label="Subsidieplafond (€)">
                  <Input
                    className="no-spinner"
                    disabled={disabled}
                    min={0}
                    onChange={(e) =>
                      update(index, {
                        totaalSubsidiePlafond: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    step="0.01"
                    type="number"
                    value={row.totaalSubsidiePlafond ?? ""}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field
                    hint="Optioneel: bv. 'per woning' of 'per kalenderjaar'."
                    label="Toelichting"
                  >
                    <Input
                      disabled={disabled}
                      onChange={(e) =>
                        update(index, { omschrijving: e.target.value })
                      }
                      value={row.omschrijving}
                    />
                  </Field>
                </div>
              </div>
            </div>
          ))}
          {disabled ? null : (
            <Button
              className="self-start"
              onClick={addRow}
              size="sm"
              type="button"
              variant="outline"
            >
              + Doelgroep toevoegen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lege staat als ghost-preview: een vervaagde rij die de echte lay-out
 * spiegelt, met een klein label. Geen icon-in-circle empty state.
 */
function PlafondsLeeg({
  onAdd,
  disabled,
}: {
  onAdd: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        aria-hidden="true"
        className="relative rounded-md border border-dashed bg-background/40 p-3 opacity-60"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-9 rounded-md border bg-muted/40" />
          <div className="h-9 rounded-md border bg-muted/40" />
          <div className="h-9 rounded-md border bg-muted/40" />
          <div className="h-9 rounded-md border bg-muted/40" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-md bg-background/80 px-3 py-1 text-muted-foreground text-xs">
            Geen staffeling — meestal niet nodig
          </span>
        </div>
      </div>
      {disabled ? null : (
        <Button
          className="self-start"
          onClick={onAdd}
          size="sm"
          type="button"
          variant="outline"
        >
          + Bedrag per doelgroep toevoegen
        </Button>
      )}
    </div>
  );
}

function VersiesTab({
  versies,
  auditEvents,
}: {
  versies: SubsidieVersie[];
  auditEvents: SubsidieAuditEvent[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-lg border bg-card">
        <header className="border-b px-4 py-3 font-medium text-sm">
          Publicaties (read-only)
        </header>
        {versies.length === 0 ? (
          <p className="px-4 py-3 text-muted-foreground text-sm">
            Nog geen publicaties. Bij de eerste 'Publiceren' wordt versie 1
            vastgelegd.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {versies.map((v) => {
              const isOpen = openId === v.id;
              return (
                <li className="flex flex-col gap-2 px-4 py-3" key={v.id}>
                  <button
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => setOpenId(isOpen ? null : v.id)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Versie {v.versienummer}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(v.gepubliceerdOp)}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {isOpen ? "verberg" : "toon inhoud"}
                    </span>
                  </button>
                  {v.gepubliceerdDoor ? (
                    <span className="text-muted-foreground text-xs">
                      door {v.gepubliceerdDoor.email}
                    </span>
                  ) : null}
                  {isOpen ? <VersieSnapshot payload={v.payload} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="rounded-lg border bg-card">
        <header className="border-b px-4 py-3 font-medium text-sm">
          Audit trail
        </header>
        {auditEvents.length === 0 ? (
          <p className="px-4 py-3 text-muted-foreground text-sm">
            Nog geen activiteit.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {auditEvents.map((event) => (
              <li className="flex flex-col gap-1 px-4 py-3" key={event.id}>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{event.actie}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
                {event.message ? <span>{event.message}</span> : null}
                {event.user ? (
                  <span className="text-muted-foreground text-xs">
                    door {event.user.email}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function VersieSnapshot({ payload }: { payload: Record<string, unknown> }) {
  const rows = Object.entries(payload).filter(
    ([, value]) => value !== null && value !== ""
  );
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">Geen inhoud gevangen.</p>
    );
  }
  return (
    <dl className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs">
      {rows.map(([key, value]) => (
        <div className="grid grid-cols-3 gap-2" key={key}>
          <dt className="font-medium text-muted-foreground capitalize">
            {key}
          </dt>
          <dd className="col-span-2 whitespace-pre-wrap break-words">
            {String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-1 ${
        error ? "[&_input]:border-amber-500 [&_textarea]:border-amber-500" : ""
      }`}
    >
      <Label>
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-amber-700 text-xs dark:text-amber-400">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

function toDraft(regeling: SubsidieRegeling): RegelingInput {
  return {
    naam: regeling.naam,
    doel: regeling.doel,
    voorwaarden: regeling.voorwaarden,
    aanvraagprocedure: regeling.aanvraagprocedure,
    bronUrl: regeling.bronUrl,
    bronType: regeling.bronType,
    doelgroepNaam: regeling.doelgroepNaam,
    doelgroepCluster: regeling.doelgroepCluster,
    vervaldatum: regeling.vervaldatum,
    looptijdStart: regeling.looptijdStart,
    looptijdEind: regeling.looptijdEind,
    maxBedragAanvrager: regeling.maxBedragAanvrager
      ? Number(regeling.maxBedragAanvrager)
      : null,
    totaalSubsidiePlafond: regeling.totaalSubsidiePlafond
      ? Number(regeling.totaalSubsidiePlafond)
      : null,
    plafonds: regeling.plafonds ?? [],
  };
}

function normalizeDraft(draft: RegelingInput): RegelingInput {
  return {
    ...draft,
    vervaldatum:
      draft.vervaldatum && draft.vervaldatum.length === 10
        ? `${draft.vervaldatum}T00:00:00.000Z`
        : draft.vervaldatum,
  };
}
