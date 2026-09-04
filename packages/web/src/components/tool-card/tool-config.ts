import {
  CloudSun,
  Database,
  FileText,
  Info,
  Link,
  type LucideIcon,
  Map as MapIcon,
  Scale,
  Search,
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
  | "tool-showTable";

export type ToolColor = "blue" | "purple" | "orange" | "green" | "teal" | "sky";

export type ToolConfig = {
  icon: LucideIcon;
  color: ToolColor;
  label: string;
  loadingText: string;
  getResultText: (count: number) => string;
  defaultOpen: boolean;
};

export const toolConfig: Record<ToolType, ToolConfig> = {
  "tool-searchDocuments": {
    icon: FileText,
    color: "blue",
    label: "Beleidsdocumenten",
    loadingText: "Documenten doorzoeken...",
    getResultText: (count) =>
      count === 1 ? "1 document gevonden" : `${count} documenten gevonden`,
    defaultOpen: false,
  },
  "tool-searchLawArticles": {
    icon: Scale,
    color: "purple",
    label: "Omgevingswet",
    loadingText: "Omgevingswet raadplegen...",
    getResultText: (count) =>
      count === 1 ? "1 artikel gevonden" : `${count} artikelen gevonden`,
    defaultOpen: false,
  },
  "tool-searchRelevantLinks": {
    icon: Link,
    color: "orange",
    label: "Gemeentepagina's",
    loadingText: "Relevante pagina's zoeken...",
    getResultText: (count) =>
      count === 1 ? "1 link gevonden" : `${count} links gevonden`,
    defaultOpen: false,
  },
  "tool-searchCkanDatasets": {
    icon: Database,
    color: "green",
    label: "Open Data",
    loadingText: "Datasets doorzoeken...",
    getResultText: (count) =>
      count === 1 ? "1 dataset gevonden" : `${count} datasets gevonden`,
    defaultOpen: false,
  },
  "tool-getCkanInfo": {
    icon: Info,
    color: "green",
    label: "Dataset Info",
    loadingText: "Dataset informatie ophalen...",
    getResultText: (count) =>
      count === 1 ? "1 dataset beschikbaar" : `${count} datasets beschikbaar`,
    defaultOpen: false,
  },
  "tool-queryCkan": {
    icon: Search,
    color: "green",
    label: "Data Query",
    loadingText: "Data opvragen...",
    getResultText: (count) =>
      count === 1 ? "1 resultaat" : `${count} resultaten`,
    defaultOpen: false,
  },
  "tool-showMap": {
    icon: MapIcon,
    color: "teal",
    label: "Kaart",
    loadingText: "Locaties ophalen...",
    getResultText: (count) =>
      count === 1 ? "Kaart met 1 locatie" : `Kaart met ${count} locaties`,
    defaultOpen: true, // Map always open
  },
  "tool-getWeather": {
    icon: CloudSun,
    color: "sky",
    label: "Weer",
    loadingText: "Weer ophalen...",
    getResultText: () => "Actueel weer",
    defaultOpen: false,
  },
  "tool-showTable": {
    icon: Table,
    color: "green",
    label: "Tabel",
    loadingText: "Tabel laden...",
    getResultText: (count) =>
      count === 1 ? "Tabel met 1 rij" : `Tabel met ${count} rijen`,
    defaultOpen: true,
  },
};

// Tailwind color classes per tool color
export const toolColorClasses: Record<
  ToolColor,
  {
    icon: string;
    iconBg: string;
    border: string;
    text: string;
    skeleton: string;
  }
> = {
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    skeleton: "bg-blue-200/50 dark:bg-blue-800/30",
  },
  purple: {
    icon: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    border: "border-purple-200 dark:border-purple-800",
    text: "text-purple-700 dark:text-purple-300",
    skeleton: "bg-purple-200/50 dark:bg-purple-800/30",
  },
  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-300",
    skeleton: "bg-orange-200/50 dark:bg-orange-800/30",
  },
  green: {
    icon: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-700 dark:text-green-300",
    skeleton: "bg-green-200/50 dark:bg-green-800/30",
  },
  teal: {
    icon: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-100 dark:bg-teal-900/30",
    border: "border-teal-200 dark:border-teal-800",
    text: "text-teal-700 dark:text-teal-300",
    skeleton: "bg-teal-200/50 dark:bg-teal-800/30",
  },
  sky: {
    icon: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-100 dark:bg-sky-900/30",
    border: "border-sky-200 dark:border-sky-800",
    text: "text-sky-700 dark:text-sky-300",
    skeleton: "bg-sky-200/50 dark:bg-sky-800/30",
  },
};
