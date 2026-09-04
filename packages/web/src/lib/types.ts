import type { UIMessage } from "ai";
import { z } from "zod";
import type { WeatherAtLocation } from "@/components/weather";
import type { AppUsage } from "./usage";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type GetWeatherTool = {
  input: {
    description: string;
    latitude: number;
    longitude: number;
  };
  output: WeatherAtLocation & { description: string };
};

type SearchDocumentsTool = {
  input: {
    description: string;
    contents: string[];
    limit?: number;
  };
  output: {
    description: string;
    documents: Array<{
      id: string;
      chunkId: string;
      content: string;
      source: {
        id: string;
        title: string | null;
        url: string | null;
        category: string | null;
        tags: string[];
        pages: {
          start: number;
          end: number;
          label: string;
        };
      };
      metadata: Record<string, unknown>;
      chunkType: string | null;
      isTable: boolean;
      tableId: string | null;
      distance: number | null;
    }>;
  };
};

type SearchRelevantLinksTool = {
  input: {
    description: string;
    query: string;
    additionalQueries?: string[];
    limit?: number;
  };
  output: {
    description: string;
    sections: Array<{
      id: string;
      title: string;
      description: string;
      context: string;
      links: Array<{ text: string; url: string }>;
      linkCount: number;
      source: {
        id: string;
        title: string;
        url: string | null;
        category: string | null;
        tags: string[];
      };
      relevance: number;
    }>;
    allLinks: Array<{
      title: string;
      url: string;
      category: string;
      description: string;
      sourceTitle: string;
      relevance: number;
    }>;
    totalSections: number;
    totalLinks: number;
    queriesUsed: string[];
    instruction: string;
  };
};

type SearchLawArticlesTool = {
  input: {
    description: string;
    query: string;
    limit?: number;
  };
  output: {
    description: string;
    articles: Array<{
      id: string;
      chunkId: string;
      content: string;
      location: string;
      preferredUrl: string | null;
      versionDate: string | null;
      bwbId: string | null;
      articleNumber: string | null;
      paragraphNumber: string | null;
      paragraphPart: string | null;
      articleTitle: string | null;
      distance: number;
      source: {
        id: string;
        title: string;
        url: string;
        category: string;
        tags: string[];
      };
    }>;
  };
};

type SearchCkanDatasetsTool = {
  input: {
    description: string;
    query: string;
    limit?: number;
  };
  output: {
    success: boolean;
    description: string;
    query: string;
    results: Array<{
      name: string;
      displayName: string;
      description: string | null;
      recordCount: number;
      score: number;
    }>;
    hint?: string;
    error?: string;
  };
};

type GetCkanInfoTool = {
  input: {
    description: string;
    datasets?: string[];
  };
  output: {
    description: string;
    datasets: Record<
      string,
      {
        recordCount: number;
        fields: string[];
        schema: unknown;
      }
    >;
  };
};

type QueryCkanTool = {
  input: {
    datasets: string[];
    description: string;
    query: string;
    outputLimit?: number;
  };
  output: {
    success: boolean;
    description: string;
    datasets: string[];
    query: string;
    totalInDatasets?: Record<string, number>;
    totalResults?: number;
    resultsShown?: number;
    resultsReturned?: number;
    truncated?: boolean;
    results?: unknown[];
    hint?: string;
    error?: string;
  };
};

type MarkerIcon =
  | "mapPin"
  | "tree"
  | "trees"
  | "leaf"
  | "flower"
  | "building"
  | "home"
  | "landmark"
  | "store"
  | "warehouse"
  | "factory"
  | "school"
  | "hospital"
  | "church"
  | "park"
  | "car"
  | "bike"
  | "bus"
  | "train"
  | "plane"
  | "ship"
  | "utensils"
  | "coffee"
  | "beer"
  | "shoppingBag"
  | "heart"
  | "star"
  | "flag"
  | "info"
  | "alertTriangle"
  | "construction"
  | "trash"
  | "recycle"
  | "droplet"
  | "zap"
  | "sun"
  | "wind"
  | "sprout"
  | "carrot";

type MapMarker = {
  lat: number;
  lng: number;
  label?: string;
  description?: string;
  url?: string;
  urlLabel?: string;
  icon?: MarkerIcon;
  color?: "red" | "blue" | "green" | "orange" | "purple";
};

type MapPolygon = {
  coordinates: { lat: number; lng: number }[];
  label?: string;
  fillColor?: "red" | "blue" | "green" | "orange" | "purple";
  fillOpacity?: number;
};

type LegendItem = {
  color?: "red" | "blue" | "green" | "orange" | "purple";
  icon?: MarkerIcon;
  label: string;
};

type ShowMapTool = {
  input: {
    description: string;
    dataQuery?: {
      datasets: string[];
      sql: string;
      limit?: number;
    };
    markers: MapMarker[];
    polygons?: MapPolygon[];
    center?: { lat: number; lng: number };
    zoom?: number;
    fitBounds?: boolean;
    legend?: LegendItem[];
    title?: string;
  };
  output: {
    description: string;
    center: { lat: number; lng: number };
    zoom: number;
    markers: MapMarker[];
    polygons: MapPolygon[];
    legend: LegendItem[];
    title?: string;
    fitBounds: boolean;
    queryInfo?: {
      totalResults: number;
      shown: number;
      truncated: boolean;
    };
  };
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  { usage: AppUsage },
  {
    getWeather: GetWeatherTool;
    searchDocuments: SearchDocumentsTool;
    searchRelevantLinks: SearchRelevantLinksTool;
    searchLawArticles: SearchLawArticlesTool;
    searchCkanDatasets: SearchCkanDatasetsTool;
    getCkanInfo: GetCkanInfoTool;
    queryCkan: QueryCkanTool;
    showMap: ShowMapTool;
  }
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
