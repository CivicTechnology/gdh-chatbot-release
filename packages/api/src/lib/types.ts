import type { InferUITool, Tool, UIMessage } from "ai";
import { z } from "zod";
import type { getWeather } from "./ai/tools/get-weather";
import type { getCkanInfo, queryCkan } from "./ai/tools/query-ckan";
import type { searchDocuments } from "./ai/tools/search-documents";
import type { searchLawArticles } from "./ai/tools/search-law-articles";
import type { searchRelevantLinks } from "./ai/tools/search-relevant-links";
import type { AppUsage } from "./usage";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// Weather data type from the Open-Meteo API
type WeatherAtLocation = {
  latitude: number;
  longitude: number;
  current?: {
    temperature_2m?: number;
    time?: string;
  };
  hourly?: {
    temperature_2m?: number[];
    time?: string[];
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
};

type GetWeatherTool = typeof getWeather extends (..._args: unknown[]) => Tool
  ? InferUITool<ReturnType<typeof getWeather>>
  : {
      input: {
        latitude: number;
        longitude: number;
      };
      output: WeatherAtLocation;
    };

export type ChatMessage = UIMessage<
  MessageMetadata,
  { usage: AppUsage },
  {
    getWeather: GetWeatherTool;
    getCkanInfo: typeof getCkanInfo extends (..._args: unknown[]) => Tool
      ? InferUITool<ReturnType<typeof getCkanInfo>>
      : {
          input: {
            datasets?: string[];
          };
          output: {
            exportedAt: string;
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
    queryCkan: typeof queryCkan extends (..._args: unknown[]) => Tool
      ? InferUITool<ReturnType<typeof queryCkan>>
      : {
          input: {
            datasets: string[];
            query: string;
            limit?: number;
          };
          output: {
            success: boolean;
            datasets: string[];
            query: string;
            totalInDatasets?: Record<string, number>;
            resultsReturned?: number;
            results?: unknown[];
            error?: string;
          };
        };
    searchDocuments: typeof searchDocuments extends (
      ..._args: unknown[]
    ) => Tool
      ? InferUITool<ReturnType<typeof searchDocuments>>
      : {
          input: {
            contents: string[];
            limit?: number;
          };
          output: {
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
    searchRelevantLinks: typeof searchRelevantLinks extends (
      ..._args: unknown[]
    ) => Tool
      ? InferUITool<ReturnType<typeof searchRelevantLinks>>
      : {
          input: {
            query: string;
            additionalQueries?: string[];
            limit?: number;
          };
          output: {
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
    searchLawArticles: typeof searchLawArticles extends (
      ..._args: unknown[]
    ) => Tool
      ? InferUITool<ReturnType<typeof searchLawArticles>>
      : {
          input: {
            query: string;
            limit?: number;
          };
          output: {
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
  }
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
