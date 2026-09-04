import type { ToolColor } from "@/components/tool-card/tool-config";

export type SuggestionCategory =
  | "map"
  | "data"
  | "policy"
  | "legal"
  | "practical";

export type Suggestion = {
  text: string;
  category: SuggestionCategory;
};

export type CategoryConfig = {
  id: SuggestionCategory;
  label: string;
  color: ToolColor;
};

export const categories: CategoryConfig[] = [
  { id: "map", label: "Kaart & Locaties", color: "teal" },
  { id: "data", label: "Data & Tabellen", color: "green" },
  { id: "policy", label: "Beleid & Documenten", color: "blue" },
  { id: "legal", label: "Regelgeving", color: "purple" },
  { id: "practical", label: "Praktische Info", color: "orange" },
];

export const suggestions: Suggestion[] = [
  // Kaart & Locaties
  { text: "Toon stadstuinen in Den Haag op de kaart", category: "map" },
  { text: "Waar zijn de dichtstbijzijnde moestuinen?", category: "map" },
  { text: "Laat alle voedselbossen zien op een kaart", category: "map" },
  { text: "Welke parken hebben eetbare planten?", category: "map" },
  { text: "Toon locaties van voedselbanken in Den Haag", category: "map" },
  { text: "Waar kan ik groente kopen direct van de boer?", category: "map" },
  { text: "Kaart met buurttuinen in Laak", category: "map" },
  { text: "Waar zijn er boomgaarden in de stad?", category: "map" },
  { text: "Toon plekken voor stadslandbouw", category: "map" },
  { text: "Welke scholen hebben een schooltuin?", category: "map" },

  // Data & Tabellen
  { text: "Hoeveel stadstuinen zijn er in Den Haag?", category: "data" },
  {
    text: "Geef een overzicht van alle moestuinverenigingen",
    category: "data",
  },
  { text: "Welke datasets heeft de gemeente over groen?", category: "data" },
  { text: "Toon statistieken over stadslandbouw", category: "data" },
  { text: "Lijst van subsidies voor groene initiatieven", category: "data" },
  {
    text: "Hoeveel vierkante meter stadstuin is er per wijk?",
    category: "data",
  },
  { text: "Overzicht van voedselinitiatieven per stadsdeel", category: "data" },
  { text: "Welke open data is er over duurzaamheid?", category: "data" },
  { text: "Tabel met contactgegevens van buurttuinen", category: "data" },
  { text: "Vergelijk wijken op groenvoorzieningen", category: "data" },

  // Beleid & Documenten
  { text: "Wat is het voedselbeleid van Den Haag?", category: "policy" },
  {
    text: "Welke plannen heeft de gemeente voor stadslandbouw?",
    category: "policy",
  },
  { text: "Wat staat er in de Haagse voedselstrategie?", category: "policy" },
  {
    text: "Hoe ondersteunt de gemeente buurtinitiatieven?",
    category: "policy",
  },
  { text: "Beleid rondom voedselverspilling in Den Haag", category: "policy" },
  { text: "Gemeentelijke visie op duurzame voeding", category: "policy" },
  {
    text: "Wat zijn de doelen voor 2030 op voedselgebied?",
    category: "policy",
  },
  { text: "Hoe past stadslandbouw in het omgevingsplan?", category: "policy" },
  { text: "Subsidieregeling voor groene daken", category: "policy" },
  { text: "Beleid voor korte voedselketens", category: "policy" },

  // Regelgeving
  {
    text: "Mag ik een moestuin beginnen op gemeentegrond?",
    category: "legal",
  },
  {
    text: "Welke regels gelden voor het houden van kippen?",
    category: "legal",
  },
  { text: "Vergunning nodig voor een kas in de tuin?", category: "legal" },
  { text: "Wat zegt de Omgevingswet over stadslandbouw?", category: "legal" },
  { text: "Regels voor verkoop van eigen groenten", category: "legal" },
  { text: "Mag ik bijen houden in een woonwijk?", category: "legal" },
  { text: "Bestemmingsplan voor volkstuinen", category: "legal" },
  { text: "Voorwaarden voor een buurtmoestuin", category: "legal" },
  { text: "Regelgeving rond composteren", category: "legal" },
  { text: "Erfpacht voor stadslandbouw", category: "legal" },

  // Praktische Info
  { text: "Hoe start ik een moestuin in Den Haag?", category: "practical" },
  { text: "Tips voor beginners met stadstuinieren", category: "practical" },
  { text: "Waar vind ik cursussen over groenteteelt?", category: "practical" },
  { text: "Hoe sluit ik me aan bij een buurttuin?", category: "practical" },
  {
    text: "Gemeentelijke contactpersoon voor stadslandbouw",
    category: "practical",
  },
  { text: "Wanneer is de beste tijd om te zaaien?", category: "practical" },
  { text: "Workshops over voedselbesparing", category: "practical" },
  {
    text: "Hoe verminder ik voedselverspilling thuis?",
    category: "practical",
  },
  { text: "Initiatieven tegen voedselarmoede", category: "practical" },
  { text: "Vrijwilligerswerk bij voedselprojecten", category: "practical" },
];

/**
 * Fisher-Yates shuffle for unbiased random selection
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get random suggestions, optionally from specific categories
 */
export function getRandomSuggestions(
  count: number,
  fromCategories?: SuggestionCategory[]
): Suggestion[] {
  const filtered = fromCategories
    ? suggestions.filter((s) => fromCategories.includes(s.category))
    : suggestions;

  return shuffleArray(filtered).slice(0, count);
}

/**
 * Get random suggestion texts only (for simpler usage)
 */
export function getRandomSuggestionTexts(count: number): string[] {
  return getRandomSuggestions(count).map((s) => s.text);
}
