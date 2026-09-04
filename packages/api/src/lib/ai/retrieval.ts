
import { createEmbedding } from "@/lib/ai/embeddings";
import {
  type DocumentChunkSearchResult,
  getSourceIdsWithTag,
  searchDocumentChunks,
  searchWebSections,
} from "@/lib/db/queries";

type RetrieveDocumentsOptions = {
  limit?: number;
  sourceIds?: string[];
};

export async function retrieveDocumentsForQuery(
  query: string,
  { limit = 5, sourceIds }: RetrieveDocumentsOptions = {}
): Promise<DocumentChunkSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const embedding = await createEmbedding(trimmed);
  return searchDocumentChunks({ embedding, limit, sourceIds });
}

export async function retrieveWebSectionsForQuery(
  query: string,
  { limit = 15 }: { limit?: number } = {}
): Promise<DocumentChunkSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const embedding = await createEmbedding(trimmed);
  return searchWebSections({ embedding, limit });
}

// Cache for law source IDs to avoid repeated database queries
let cachedLawSourceIds: string[] | null = null;
let lawSourceCacheTime = 0;
const LAW_SOURCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedLawSourceIds(): Promise<string[]> {
  const now = Date.now();
  if (cachedLawSourceIds && now - lawSourceCacheTime < LAW_SOURCE_CACHE_TTL) {
    return cachedLawSourceIds;
  }

  cachedLawSourceIds = await getSourceIdsWithTag("law");
  lawSourceCacheTime = now;
  return cachedLawSourceIds;
}

export function invalidateLawSourceCache(): void {
  cachedLawSourceIds = null;
  lawSourceCacheTime = 0;
}

export async function retrieveLawDocumentsForQuery(
  query: string,
  { limit = 10 }: { limit?: number } = {}
): Promise<DocumentChunkSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const lawSourceIds = await getCachedLawSourceIds();
  if (lawSourceIds.length === 0) {
    return [];
  }

  const embedding = await createEmbedding(trimmed);
  return searchDocumentChunks({ embedding, limit, sourceIds: lawSourceIds });
}
