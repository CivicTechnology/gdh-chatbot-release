import type { ToolColor } from "@/components/tool-card/tool-config";

export type SuggestionCategory =
  | "ontdekken"
  | "voorwaarden"
  | "aanvragen"
  | "vergelijken"
  | "deadlines"
  | "uitleg";

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
  { id: "ontdekken", label: "Subsidies vinden", color: "sky" },
  { id: "voorwaarden", label: "Voorwaarden & bedragen", color: "green" },
  { id: "aanvragen", label: "Aanvragen", color: "blue" },
  { id: "vergelijken", label: "Vergelijken", color: "teal" },
  { id: "deadlines", label: "Deadlines & looptijd", color: "orange" },
  { id: "uitleg", label: "Uitleg", color: "purple" },
];

export const suggestions: Suggestion[] = [
  // Subsidies vinden
  {
    text: "Welke subsidies zijn er voor bewoners van Den Haag?",
    category: "ontdekken",
  },
  {
    text: "Welke subsidie past bij mijn idee voor de buurt?",
    category: "ontdekken",
  },
  {
    text: "Zijn er subsidies voor mijn vereniging of stichting?",
    category: "ontdekken",
  },
  {
    text: "Welke subsidies zijn er voor ondernemers?",
    category: "ontdekken",
  },
  {
    text: "Ik wil iets organiseren in mijn wijk, is daar subsidie voor?",
    category: "ontdekken",
  },
  {
    text: "Welke subsidieregelingen zijn er op dit moment actief?",
    category: "ontdekken",
  },
  {
    text: "Is er een subsidie voor het verduurzamen van mijn woning?",
    category: "ontdekken",
  },
  {
    text: "Welke subsidie past bij mijn groene initiatief?",
    category: "ontdekken",
  },

  // Voorwaarden & bedragen
  {
    text: "Kom ik als particulier in aanmerking voor een subsidie?",
    category: "voorwaarden",
  },
  {
    text: "Aan welke voorwaarden moet mijn aanvraag voldoen?",
    category: "voorwaarden",
  },
  {
    text: "Hoeveel subsidie kan ik maximaal krijgen?",
    category: "voorwaarden",
  },
  {
    text: "Welke voorwaarden gelden voor de Energiebespaarvoucher?",
    category: "voorwaarden",
  },
  {
    text: "Moet ik een subsidie terugbetalen?",
    category: "voorwaarden",
  },
  {
    text: "Wat moet ik kunnen aantonen bij een subsidieaanvraag?",
    category: "voorwaarden",
  },

  // Aanvragen
  {
    text: "Hoe vraag ik een subsidie aan bij de gemeente?",
    category: "aanvragen",
  },
  {
    text: "Welke documenten heb ik nodig voor een aanvraag?",
    category: "aanvragen",
  },
  {
    text: "Hoe lang duurt het voordat ik antwoord krijg op mijn aanvraag?",
    category: "aanvragen",
  },
  {
    text: "Wat gebeurt er nadat ik een subsidie heb aangevraagd?",
    category: "aanvragen",
  },
  {
    text: "Kan ik meerdere subsidies tegelijk aanvragen?",
    category: "aanvragen",
  },
  {
    text: "Waar kan ik terecht voor hulp bij mijn aanvraag?",
    category: "aanvragen",
  },

  // Vergelijken
  {
    text: "Vergelijk subsidies voor het verduurzamen van mijn pand",
    category: "vergelijken",
  },
  {
    text: "Welke subsidie geeft het hoogste bedrag voor mijn project?",
    category: "vergelijken",
  },
  {
    text: "Vergelijk de subsidies voor buurtinitiatieven",
    category: "vergelijken",
  },
  {
    text: "Wat zijn de verschillen tussen de subsidies voor groene initiatieven?",
    category: "vergelijken",
  },
  {
    text: "Welke regeling past het beste bij een klein project?",
    category: "vergelijken",
  },

  // Deadlines & looptijd
  {
    text: "Welke subsidieregelingen lopen binnenkort af?",
    category: "deadlines",
  },
  {
    text: "Tot wanneer kan ik een subsidie aanvragen?",
    category: "deadlines",
  },
  {
    text: "Welke subsidieregelingen zijn onlangs gepubliceerd?",
    category: "deadlines",
  },
  {
    text: "Hoe lang loopt de subsidie voor groene daken nog?",
    category: "deadlines",
  },

  // Uitleg
  {
    text: "Wat is een subsidie precies?",
    category: "uitleg",
  },
  {
    text: "Hoe werkt een subsidieregeling?",
    category: "uitleg",
  },
  {
    text: "Wat kan ik met een subsidie van de gemeente doen?",
    category: "uitleg",
  },
  {
    text: "Wat is het verschil tussen een subsidie en een lening?",
    category: "uitleg",
  },
  {
    text: "Wat betekent een subsidieplafond?",
    category: "uitleg",
  },
  {
    text: "Voor wie zijn gemeentelijke subsidies bedoeld?",
    category: "uitleg",
  },
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

/**
 * Get suggestions for the landing page, guaranteeing at least one from
 * `pinnedCategory` so that category is always visible. Remaining slots are
 * filled from the other categories and the final order is shuffled.
 */
export function getLandingSuggestions(
  count: number,
  pinnedCategory: SuggestionCategory
): Suggestion[] {
  const pinned = getRandomSuggestions(1, [pinnedCategory]);
  const remaining = Math.max(0, count - pinned.length);
  const rest = shuffleArray(
    suggestions.filter((s) => s.category !== pinnedCategory)
  ).slice(0, remaining);
  return shuffleArray([...pinned, ...rest]);
}
