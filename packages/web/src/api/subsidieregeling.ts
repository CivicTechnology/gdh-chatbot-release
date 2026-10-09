import { apiClient } from "./client";

export type SubsidieStatus =
  | "CONCEPT"
  | "ACTIEF"
  | "GEARCHIVEERD"
  | "GEARCHIVEERD_VERVANGEN"
  | "VERLOPEN";

export type SubsidieDoelgroepCluster =
  | "PARTICULIER"
  | "BEDRIJF"
  | "MAATSCHAPPELIJK";

export type SubsidieBronType = "LOKALEREGELGEVING" | "PDF" | "OVERIG";

/** Eén staffel-item: een bedrag dat voor één doelgroep binnen de regeling geldt. */
export type SubsidiePlafond = {
  doelgroepCluster: SubsidieDoelgroepCluster;
  doelgroepNaam: string;
  maxBedragAanvrager: number | null;
  totaalSubsidiePlafond: number | null;
  omschrijving: string;
};

export type SubsidieRegeling = {
  id: string;
  naam: string;
  doel: string;
  voorwaarden: string;
  aanvraagprocedure: string;
  bronUrl: string;
  bronType: SubsidieBronType;
  status: SubsidieStatus;
  doelgroepNaam: string;
  doelgroepCluster: SubsidieDoelgroepCluster;
  vervaldatum: string | null;
  looptijdStart: string | null;
  looptijdEind: string | null;
  maxBedragAanvrager: string | null;
  totaalSubsidiePlafond: string | null;
  /** Optionele staffeling: verschillende bedragen per doelgroep binnen één regeling. */
  plafonds: SubsidiePlafond[] | null;
  vervangenDoorId: string | null;
  vervangenDoor?: { id: string; naam: string; bronUrl?: string } | null;
  deadLinkSince: string | null;
  lastDeadLinkCheckAt: string | null;
  /** Datum van officiële bekendmaking op overheid.nl. */
  publicatieDatum: string | null;
  /** Laatste inhoudelijke wijziging bij de bron (alleen bij CVDR-versiewissel). */
  bronGewijzigdOp: string | null;
  /** Laatste succesvolle controle tegen de overheid.nl-feed. */
  bronGecontroleerdOp: string | null;
  grondslag: string | null;
  grondslagUrl: string | null;
  bekendmakingKenmerk: string | null;
  bekendmakingUrl: string | null;
  betreft: string | null;
  kenmerk: string | null;
  thema: string | null;
  vastgesteldDoor: string | null;
  terugwerkendeKrachtTot: string | null;
  externeBijlage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubsidieVersie = {
  id: string;
  versienummer: number;
  payload: Record<string, unknown>;
  gepubliceerdOp: string;
  gepubliceerdDoor: { id: string; email: string } | null;
};

export type SubsidieAuditEvent = {
  id: string;
  actie: string;
  message: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string } | null;
};

export type DashboardData = {
  binnen7: SubsidieRegeling[];
  binnen30: SubsidieRegeling[];
  binnen90: SubsidieRegeling[];
  deadLinks: SubsidieRegeling[];
};

export type RegelingInput = Partial<{
  naam: string;
  doel: string;
  voorwaarden: string;
  aanvraagprocedure: string;
  bronUrl: string;
  bronType: SubsidieBronType;
  doelgroepNaam: string;
  doelgroepCluster: SubsidieDoelgroepCluster;
  vervaldatum: string | null;
  looptijdStart: string | null;
  looptijdEind: string | null;
  maxBedragAanvrager: number | null;
  totaalSubsidiePlafond: number | null;
  plafonds: SubsidiePlafond[];
}>;

const BASE = "/admin/subsidieregelingen";

export const subsidieApi = {
  list(params: URLSearchParams) {
    const qs = params.toString();
    return apiClient.get<{
      regelingen: SubsidieRegeling[];
      total: number;
      statusCounts: Record<SubsidieStatus, number>;
    }>(qs ? `${BASE}?${qs}` : BASE);
  },
  show(id: string) {
    return apiClient.get<SubsidieRegeling>(`${BASE}/${id}`);
  },
  create(input: RegelingInput) {
    return apiClient.post<SubsidieRegeling>(BASE, input);
  },
  update(id: string, input: RegelingInput) {
    return apiClient.patch<SubsidieRegeling>(`${BASE}/${id}`, input);
  },
  destroy(id: string) {
    return apiClient.delete<void>(`${BASE}/${id}`);
  },
  publish(id: string, vervangtId?: string) {
    return apiClient.post<SubsidieRegeling>(
      `${BASE}/${id}/publish`,
      vervangtId ? { vervangtId } : undefined
    );
  },
  replaceBy(id: string, opvolgerId: string) {
    return apiClient.post<SubsidieRegeling>(`${BASE}/${id}/replace`, {
      opvolgerId,
    });
  },
  archive(id: string) {
    return apiClient.post<SubsidieRegeling>(`${BASE}/${id}/archive`);
  },
  unarchive(id: string) {
    return apiClient.post<SubsidieRegeling>(`${BASE}/${id}/unarchive`);
  },
  history(id: string) {
    return apiClient.get<{
      regeling: SubsidieRegeling;
      versies: SubsidieVersie[];
      auditEvents: SubsidieAuditEvent[];
    }>(`${BASE}/${id}/history`);
  },
  dashboard() {
    return apiClient.get<DashboardData>(`${BASE}/dashboard`);
  },
};
