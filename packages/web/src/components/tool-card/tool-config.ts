import {
  ClipboardCheck,
  CloudSun,
  Database,
  FileText,
  GitCompare,
  HandCoins,
  Info,
  Link,
  type LucideIcon,
  Map as MapIcon,
  Scale,
  Search,
  Sparkles,
  Table,
} from "lucide-react";

export type ToolType =
  | "tool-getWeather"
  | "tool-searchDocuments"
  | "tool-searchRelevantLinks"
  | "tool-searchLawArticles"
  | "tool-searchCkanDatasets"
  | "tool-getCkanInfo"
  | "tool-queryCkan"
  | "tool-showMap"
  | "tool-showTable"
  | "tool-findSubsidies"
  | "tool-getSubsidieDetail"
  | "tool-checkSubsidieEligibility"
  | "tool-compareSubsidies";

export type ToolColor = "blue" | "purple" | "orange" | "green" | "teal" | "sky";

export type ToolConfig = {
  icon: LucideIcon;
  color: ToolColor;
  label: string;
  loadingText: string;
  /**
   * De bron die deze tool daadwerkelijk raadpleegt. Verplicht: de
   * bronvermelding in de statusregel ("Bron: ...") komt hier vandaan en mag
   * nooit ontbreken. Formuleer zo dat de tekst na "Bron: " loopt.
   */
  sourceText: string;
  getResultText: (count: number) => string;
  defaultOpen: boolean;
};

export const toolConfig: Record<ToolType, ToolConfig> = {
  "tool-searchDocuments": {
    icon: FileText,
    color: "blue",
    label: "Beleidsdocumenten",
    loadingText:
      "Zoeken in de beleidsstukken en raadsdocumenten over Den Haag...",
    sourceText: "de beleidsstukken en raadsdocumenten over Den Haag",
    getResultText: (count) =>
      count === 1 ? "1 document gevonden" : `${count} documenten gevonden`,
    defaultOpen: false,
  },
  "tool-searchLawArticles": {
    icon: Scale,
    color: "purple",
    label: "Omgevingswet",
    loadingText:
      "Zoeken in de wettekst van de Omgevingswet op wetten.overheid.nl...",
    sourceText: "de Omgevingswet (wetten.overheid.nl)",
    getResultText: (count) =>
      count === 1 ? "1 artikel gevonden" : `${count} artikelen gevonden`,
    defaultOpen: false,
  },
  "tool-searchRelevantLinks": {
    icon: Link,
    color: "orange",
    label: "Informatiepagina's",
    loadingText:
      "Zoeken op de informatiepagina's van Stadslandbouw Den Haag...",
    sourceText: "de website Stadslandbouw Den Haag (stadslandbouwdenhaag.nl)",
    getResultText: (count) =>
      count === 1 ? "1 link gevonden" : `${count} links gevonden`,
    defaultOpen: false,
  },
  "tool-searchCkanDatasets": {
    icon: Database,
    color: "green",
    label: "Open Data",
    loadingText: "Zoeken in het open-dataportaal van gemeente Den Haag...",
    sourceText: "het open-dataportaal van gemeente Den Haag",
    getResultText: (count) =>
      count === 1 ? "1 dataset gevonden" : `${count} datasets gevonden`,
    defaultOpen: false,
  },
  "tool-getCkanInfo": {
    icon: Info,
    color: "green",
    label: "Dataset Info",
    loadingText:
      "Datasetinformatie ophalen uit het open-dataportaal van gemeente Den Haag...",
    sourceText: "het open-dataportaal van gemeente Den Haag",
    getResultText: (count) =>
      count === 1 ? "1 dataset beschikbaar" : `${count} datasets beschikbaar`,
    defaultOpen: false,
  },
  "tool-queryCkan": {
    icon: Search,
    color: "green",
    label: "Data Query",
    loadingText:
      "Gegevens opvragen uit de open datasets van gemeente Den Haag...",
    sourceText: "de open datasets van gemeente Den Haag",
    getResultText: (count) =>
      count === 1 ? "1 resultaat" : `${count} resultaten`,
    defaultOpen: false,
  },
  "tool-showMap": {
    icon: MapIcon,
    color: "teal",
    label: "Kaart",
    loadingText:
      "Locaties ophalen uit de open datasets van gemeente Den Haag...",
    sourceText: "de open datasets van gemeente Den Haag",
    getResultText: (count) =>
      count === 1 ? "Kaart met 1 locatie" : `Kaart met ${count} locaties`,
    defaultOpen: true, // Map always open
  },
  "tool-getWeather": {
    icon: CloudSun,
    color: "sky",
    label: "Weer",
    loadingText: "Actueel weerbericht ophalen via Open-Meteo...",
    sourceText: "de weerdienst Open-Meteo",
    getResultText: () => "Actueel weer",
    defaultOpen: false,
  },
  "tool-showTable": {
    icon: Table,
    color: "green",
    label: "Tabel",
    loadingText: "Tabel opbouwen met de opgevraagde gemeentelijke gegevens...",
    sourceText: "de open datasets van gemeente Den Haag",
    getResultText: (count) =>
      count === 1 ? "Tabel met 1 rij" : `Tabel met ${count} rijen`,
    defaultOpen: true,
  },
  "tool-findSubsidies": {
    icon: HandCoins,
    color: "purple",
    label: "Subsidieregelingen",
    loadingText:
      "Zoeken in de officiële subsidieregelingen van gemeente Den Haag op overheid.nl...",
    sourceText:
      "de officiële subsidieregelingen van gemeente Den Haag (overheid.nl)",
    getResultText: (count) =>
      count === 1 ? "1 regeling gevonden" : `${count} regelingen gevonden`,
    defaultOpen: false,
  },
  "tool-getSubsidieDetail": {
    icon: Sparkles,
    color: "purple",
    label: "Regelingdetails",
    loadingText:
      "Details ophalen uit de officiële bekendmaking op overheid.nl...",
    sourceText: "de officiële bekendmaking van gemeente Den Haag (overheid.nl)",
    getResultText: () => "Details geladen",
    defaultOpen: false,
  },
  "tool-checkSubsidieEligibility": {
    icon: ClipboardCheck,
    color: "green",
    label: "Kom ik in aanmerking?",
    loadingText:
      "Voorwaarden nalopen uit de officiële regeling op overheid.nl...",
    sourceText: "de voorwaarden van de officiële regeling (overheid.nl)",
    getResultText: (count) => (count === 1 ? "1 vraag" : `${count} vragen`),
    defaultOpen: false,
  },
  "tool-compareSubsidies": {
    icon: GitCompare,
    color: "teal",
    label: "Regelingen vergelijken",
    loadingText:
      "Regelingen vergelijken op basis van de officiële bekendmakingen op overheid.nl...",
    sourceText:
      "de officiële bekendmakingen van gemeente Den Haag (overheid.nl)",
    getResultText: (count) =>
      count === 1 ? "1 regeling" : `${count} regelingen vergeleken`,
    defaultOpen: false,
  },
};

// Tailwind color classes per tool color
export const toolColorClasses: Record<
  ToolColor,
  {
    icon: string;
    iconBg: string;
  }
> = {
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
  },
  purple: {
    icon: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
  },
  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
  },
  green: {
    icon: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-900/30",
  },
  teal: {
    icon: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-100 dark:bg-teal-900/30",
  },
  sky: {
    icon: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-100 dark:bg-sky-900/30",
  },
};
