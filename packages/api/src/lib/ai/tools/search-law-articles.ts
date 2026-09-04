
import { tool } from "ai";
import { z } from "zod";

import { retrieveLawDocumentsForQuery } from "@/lib/ai/retrieval";
import type { DocumentChunkSearchResult } from "@/lib/db/queries";

type LawMetadata = {
  bwbId?: string;
  preferredUrl?: string;
  versionDate?: string;
  chapterNumber?: string;
  chapterTitle?: string;
  sectionNumber?: string;
  sectionTitle?: string;
  articleNumber?: string;
  articleTitle?: string;
  paragraphNumber?: string;
  paragraphPart?: string;
};

function readMetadataField(
  metadata: Record<string, unknown>,
  field: string
): string | undefined {
  const value = metadata[field];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return;
}

function buildLocation(metadata: LawMetadata): string {
  const parts: string[] = [];

  if (metadata.articleNumber) {
    parts.push(`Artikel ${metadata.articleNumber}`);
  }

  if (metadata.paragraphNumber) {
    parts.push(`lid ${metadata.paragraphNumber}`);
  }

  if (metadata.paragraphPart) {
    parts.push(`onderdeel ${metadata.paragraphPart}`);
  }

  if (parts.length === 0) {
    if (metadata.chapterNumber) {
      parts.push(`Hoofdstuk ${metadata.chapterNumber}`);
      if (metadata.chapterTitle) {
        parts.push(`(${metadata.chapterTitle})`);
      }
    } else if (metadata.sectionNumber) {
      parts.push(`Afdeling ${metadata.sectionNumber}`);
      if (metadata.sectionTitle) {
        parts.push(`(${metadata.sectionTitle})`);
      }
    }
  }

  return parts.join(" ") || "Omgevingswet";
}

function formatLawArticle(result: DocumentChunkSearchResult) {
  const metadata = result.metadata as Record<string, unknown>;

  const lawMetadata: LawMetadata = {
    bwbId: readMetadataField(metadata, "bwbId"),
    preferredUrl: readMetadataField(metadata, "preferredUrl"),
    versionDate: readMetadataField(metadata, "versionDate"),
    chapterNumber: readMetadataField(metadata, "chapterNumber"),
    chapterTitle: readMetadataField(metadata, "chapterTitle"),
    sectionNumber: readMetadataField(metadata, "sectionNumber"),
    sectionTitle: readMetadataField(metadata, "sectionTitle"),
    articleNumber: readMetadataField(metadata, "articleNumber"),
    articleTitle: readMetadataField(metadata, "articleTitle"),
    paragraphNumber: readMetadataField(metadata, "paragraphNumber"),
    paragraphPart: readMetadataField(metadata, "paragraphPart"),
  };

  const location = buildLocation(lawMetadata);

  return {
    id: result.id,
    chunkId: result.chunkId,
    content: result.text,
    location,
    preferredUrl: lawMetadata.preferredUrl ?? null,
    versionDate: lawMetadata.versionDate ?? null,
    bwbId: lawMetadata.bwbId ?? null,
    articleNumber: lawMetadata.articleNumber ?? null,
    paragraphNumber: lawMetadata.paragraphNumber ?? null,
    paragraphPart: lawMetadata.paragraphPart ?? null,
    articleTitle: lawMetadata.articleTitle ?? null,
    distance: result.distance,
    source: {
      id: result.sourceId,
      title: result.sourceTitle,
      url: result.sourceUrl,
      category: result.sourceCategory,
      tags: result.sourceTags,
    },
  };
}

export const searchLawArticles = tool({
  description:
    "Zoekt in de Omgevingswet naar relevante wetsartikelen. Gebruik dit voor juridische vragen over de Omgevingswet, vergunningen, bestemmingsplannen, milieuregels en ruimtelijke ordening. Deze tool retourneert exacte wetteksten met artikel- en lidnummers. Let op: het antwoord op basis van deze bron vormt geen juridisch advies, maar geeft uitleg over de Omgevingswet.",
  inputSchema: z.object({
    description: z
      .string()
      .describe(
        "Korte, niet-technische beschrijving in gewone menselijke taal van wat er wordt opgezocht (bijv. 'Wetsartikelen over bouwvergunningen', 'Regels voor geluidsoverlast'). Wordt getoond aan de gebruiker."
      ),
    query: z
      .string()
      .min(1)
      .max(512)
      .describe(
        "Zoekterm gericht op juridische begrippen, artikelen of onderwerpen uit de Omgevingswet. Gebruik specifieke termen zoals 'omgevingsvergunning bouwen', 'geluidhinder', 'milieubelastende activiteit'."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .optional()
      .describe("Maximum aantal artikelen om te retourneren"),
  }),
  execute: async ({ description, query, limit = 5 }) => {
    const results = await retrieveLawDocumentsForQuery(query, { limit });

    const articles = results.map(formatLawArticle);

    return { description, articles };
  },
});
