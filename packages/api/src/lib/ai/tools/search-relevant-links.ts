
import { tool } from "ai";
import { z } from "zod";

import { retrieveWebSectionsForQuery } from "@/lib/ai/retrieval";

export const searchRelevantLinks = tool({
  description:
    "ALTIJD GEBRUIKEN: Zoekt praktische externe links en bronnen (websites, organisaties, subsidies, cursussen, contacten). Dit is de EERSTE tool om aan te roepen bij elke vraag. Gebruik dit als primaire bron voor eerste/algemene vragen. De links zijn vaak directer en praktischer voor gebruikers dan formele documenten. Gebruik de kernwoorden uit de gebruikersvraag.",
  inputSchema: z.object({
    description: z
      .string()
      .describe(
        "Korte, niet-technische beschrijving in gewone menselijke taal van wat er wordt opgezocht (bijv. 'Links over stadslandbouw', 'Informatie over parkeren'). Wordt getoond aan de gebruiker."
      ),
    query: z
      .string()
      .min(1)
      .max(512)
      .describe(
        "De zoekvraag waarmee relevante links worden gevonden. Gebruik een uitgebreide, beschrijvende zoekvraag met context en kernwoorden. Bijvoorbeeld: 'hoe start je met stadslandbouw grond aanvragen subsidies gemeente den haag' in plaats van alleen 'stadslandbouw'. Hoe meer context, hoe betere matches."
      ),
    additionalQueries: z
      .array(z.string().min(1).max(256))
      .max(3)
      .optional()
      .describe(
        "Optionele extra zoekvragen om meer diverse resultaten te krijgen. Bijvoorbeeld verschillende aspecten of synoniemen. Max 3 queries."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(15)
      .optional()
      .describe(
        "Maximum aantal sectie-resultaten per query (elke sectie kan meerdere links bevatten)"
      ),
  }),
  execute: async ({ description, query, additionalQueries = [], limit = 15 }) => {
    // Combine main query with additional queries
    const allQueries = [query, ...additionalQueries];

    // Execute all searches in parallel
    const searchPromises = allQueries.map((q) =>
      retrieveWebSectionsForQuery(q, {
        limit: Math.ceil(limit / allQueries.length),
      })
    );

    const allResults = await Promise.all(searchPromises);
    const flatResults = allResults.flat();

    // Deduplicate results by chunk ID
    const seenIds = new Set<string>();
    const results = flatResults.filter((result) => {
      if (seenIds.has(result.id)) {
        return false;
      }
      seenIds.add(result.id);
      return true;
    });

    // Collect all links from all sections
    const allLinks: Array<{
      title: string;
      url: string;
      category: string;
      description: string;
      sourceTitle: string;
      relevance: number;
    }> = [];

    const formatted = results.map((result) => {
      const metadata = result.metadata as {
        description?: string;
        structuredLinks?: Array<{ text: string; url: string }>;
        relatedLinks?: Array<{
          url: string;
          text: string;
          title: string;
          category: string;
        }>;
        linkCount?: number;
      };

      const structuredLinks = metadata.structuredLinks || [];
      const sectionTitle = result.sectionPath?.[0] || "Informatie";
      const relevance = 1 - result.distance;

      // Add all links from this section to the flat list
      for (const link of structuredLinks) {
        allLinks.push({
          title: link.text,
          url: link.url,
          category: sectionTitle,
          description: metadata.description || "",
          sourceTitle: result.sourceTitle,
          relevance,
        });
      }

      return {
        id: result.id,
        title: sectionTitle,
        description: metadata.description || "",
        context: result.text,
        links: structuredLinks,
        linkCount: structuredLinks.length,
        source: {
          id: result.sourceId,
          title: result.sourceTitle,
          url: result.sourceUrl,
          category: result.sourceCategory,
          tags: result.sourceTags,
        },
        relevance,
      };
    });

    // Deduplicate links by URL
    const seenUrls = new Set<string>();
    const uniqueLinks = allLinks.filter((link) => {
      if (seenUrls.has(link.url)) {
        return false;
      }
      seenUrls.add(link.url);
      return true;
    });

    // Sort by relevance (highest first)
    uniqueLinks.sort((a, b) => b.relevance - a.relevance);

    return {
      description,
      sections: formatted,
      allLinks: uniqueLinks,
      totalSections: formatted.length,
      totalLinks: uniqueLinks.length,
      queriesUsed: allQueries,
      instruction:
        "BELANGRIJK: Selecteer uit 'allLinks' de links die DAADWERKELIJK RELEVANT zijn voor de specifieke vraag. Elk link object bevat: 'title' (originele linktekst), 'url', 'category' (sectie waar het vandaan komt), 'description' (context), 'sourceTitle' (bronpagina), en 'relevance' (0-1 score). Gebruik deze informatie om te beslissen welke links relevant zijn en hoe je de linktekst moet aanpassen. Presenteer 5-15 links in stap 1, en 3-8 extra in stap 2. Groepeer ze logisch per thema (niet per category field). De links zijn al gesorteerd op relevantie.",
    };
  },
});
