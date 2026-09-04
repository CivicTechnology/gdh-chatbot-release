
import { tool } from "ai";
import { z } from "zod";

import { retrieveDocumentsForQuery } from "@/lib/ai/retrieval";

export const searchDocuments = tool({
  description:
    "Zoekt in officiële gemeentelijke documenten en beleidsstukken. Gebruik dit ALLEEN bij verdiepende vragen of wanneer de gebruiker specifiek vraagt om details uit documenten. Voor algemene/eerste vragen: gebruik eerst searchRelevantLinks. Gebruik maximaal vier zoektermen en noem altijd de bron en paginanummers in je antwoord.",
  inputSchema: z.object({
    description: z
      .string()
      .describe(
        "Korte, niet-technische beschrijving in gewone menselijke taal van wat er wordt opgezocht (bijv. 'Beleid over groene daken', 'Subsidievoorwaarden voor isolatie'). Wordt getoond aan de gebruiker."
      ),
    contents: z
      .array(z.string().min(1).max(512))
      .min(1)
      .max(4)
      .describe(
        "Een serie zoektermen waarmee relevante stukken worden opgehaald. Gebruik kernwoorden zoals onderwerp, doelgroep of instrument."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .optional()
      .describe("Maximum aantal resultaten per zoekterm"),
  }),
  execute: async ({ description, contents, limit = 5 }) => {
    const results = await Promise.all(
      contents.map((content) => retrieveDocumentsForQuery(content, { limit }))
    );

    const unique = new Map<string, ReturnType<typeof formatDocument>>();

    for (const document of results.flat()) {
      if (!unique.has(document.id)) {
        unique.set(document.id, formatDocument(document));
      }
    }

    return { description, documents: Array.from(unique.values()) };
  },
});

function formatDocument(
  result: Awaited<ReturnType<typeof retrieveDocumentsForQuery>>[number]
) {
  const pageLabel =
    result.pageStart === result.pageEnd
      ? `pagina ${result.pageStart}`
      : `pagina's ${result.pageStart}-${result.pageEnd}`;

  return {
    id: result.id,
    chunkId: result.chunkId,
    content: result.text,
    source: {
      id: result.sourceId,
      title: result.sourceTitle,
      url: result.sourceUrl,
      category: result.sourceCategory,
      tags: result.sourceTags,
      pages: {
        start: result.pageStart,
        end: result.pageEnd,
        label: pageLabel,
      },
    },
    metadata: result.metadata,
    chunkType: result.chunkType,
    isTable: result.isTable,
    tableId: result.tableId,
    distance: result.distance,
  };
}
