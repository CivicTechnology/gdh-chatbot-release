/**
 * Doorverwijskanalen voor initiatiefnemers.
 *
 * Het KID-platform verwijst bewust niet naar telefoonnummer 14070 of naar een
 * afspraak via denhaag.nl: initiatiefnemers verdwalen daarmee in de
 * gemeentelijke organisatie. Elke doorverwijzing loopt via PEP Den Haag en
 * Haagse Stadmakers, met het eigen stadsdeel als eerste aanspreekpunt om een
 * idee te bespreken.
 *
 * Dit bestand is de enige bron van waarheid voor die doorverwijzing. Het wordt
 * gebruikt door de systeemprompt en de subsidie-tools in de api, en door de
 * subsidie-widgets in de web-app. Bewust zonder imports of side effects, zodat
 * het zowel in Node als in de browserbundel veilig is.
 */

export const PEP_DEN_HAAG_URL = "https://pepdenhaag.nl/subsidies";

export const HAAGSE_STADMAKERS_URL = "https://www.haagsestadmakers.nl";

export const STADSDELEN_URL = "https://www.denhaag.nl/nl/stadsdelen/";

export const WIJKAGENDA_URL =
  "https://www.denhaag.nl/nl/stadsdelen/wijkagenda-voor-iedere-wijk-een-plan/";

export const PEP_DEN_HAAG_LABEL = "PEP Den Haag";

export const HAAGSE_STADMAKERS_LABEL = "Haagse Stadmakers";

/**
 * Standaard doorverwijszin voor de assistent. Markdown-links, want de
 * assistent-output wordt als markdown gerenderd. Korte zinnen en nooit twee
 * keer "u" achter elkaar, conform de B1-stijlregels van de systeemprompt.
 */
export const DOORVERWIJZING = `Wilt u een idee bespreken? Mail dan het eigen [stadsdeel](${STADSDELEN_URL}). Voor hulp bij subsidies, bewonersinitiatieven, verenigingen en stichtingen kunt u terecht bij [${PEP_DEN_HAAG_LABEL}](${PEP_DEN_HAAG_URL}). Initiatiefnemers in de stad kunnen ook terecht bij [${HAAGSE_STADMAKERS_LABEL}](${HAAGSE_STADMAKERS_URL}).`;

/** De acht stadsdelen met hun algemene mailadres. */
export const STADSDELEN = [
  { naam: "Centrum", email: "centrum@denhaag.nl" },
  { naam: "Escamp", email: "escamp@denhaag.nl" },
  { naam: "Haagse Hout", email: "haagsehout@denhaag.nl" },
  { naam: "Laak", email: "laak@denhaag.nl" },
  {
    naam: "Leidschenveen-Ypenburg",
    email: "leidschenveen-ypenburg@denhaag.nl",
  },
  { naam: "Loosduinen", email: "loosduinen@denhaag.nl" },
  { naam: "Scheveningen", email: "scheveningen@denhaag.nl" },
  { naam: "Segbroek", email: "segbroek@denhaag.nl" },
] as const;

/** Dezelfde kanalen, voor UI-componenten die zelf links renderen. */
export const DOORVERWIJZINGEN = [
  {
    label: "Uw stadsdeel",
    omschrijving: "om een idee te bespreken",
    url: STADSDELEN_URL,
  },
  {
    label: PEP_DEN_HAAG_LABEL,
    omschrijving: "hulp bij subsidies en initiatieven",
    url: PEP_DEN_HAAG_URL,
  },
  {
    label: HAAGSE_STADMAKERS_LABEL,
    omschrijving: "voor initiatiefnemers in de stad",
    url: HAAGSE_STADMAKERS_URL,
  },
] as const;
