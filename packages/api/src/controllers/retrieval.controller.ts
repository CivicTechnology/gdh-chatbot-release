import type { Request, Response } from "express";
import { z } from "zod";
import { retrieveDocumentsForQuery } from "@/lib/ai/retrieval.js";
import { ChatSDKError } from "@/lib/errors.js";

const requestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional(),
  sourceIds: z.array(z.string()).optional(),
});

export async function searchDocuments(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const payload = requestSchema.parse(req.body);

    const documents = await retrieveDocumentsForQuery(payload.query, {
      limit: payload.limit,
      sourceIds: payload.sourceIds,
    });

    res.status(200).json({ documents });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("Invalid retrieval search request", error);
      res
        .status(400)
        .json(new ChatSDKError("bad_request:api").toResponse());
      return;
    }

    console.error("Retrieval search failed", error);
    res.status(503).json(new ChatSDKError("offline:chat").toResponse());
  }
}
