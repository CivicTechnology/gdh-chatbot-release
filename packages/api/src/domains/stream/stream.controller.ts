import type { Response } from "express";
import { createResumableStreamContext } from "resumable-stream";
import type { AuthenticatedRequest } from "@/domains/auth/auth.types.js";
import { getChatById } from "@/domains/chat/chat.service.js";
import { ChatSDKError } from "@/lib/errors.js";
import { getStreamIdsByChatId } from "./stream.service.js";

let streamContext: ReturnType<typeof createResumableStreamContext> | null = null;

function getOrCreateStreamContext() {
	if (!streamContext) {
		try {
			streamContext = createResumableStreamContext({
				waitUntil: (promise: Promise<unknown>) => {
					promise.catch((err) => console.error("Background task error:", err));
				},
			});
		} catch (error: unknown) {
			if (error instanceof Error && error.message.includes("REDIS_URL")) {
				console.log(" > Resumable streams are disabled due to missing REDIS_URL");
			} else {
				console.error(error);
			}
		}
	}
	return streamContext;
}

export async function resumeStream(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const chatId = req.params.id;

		const resumableContext = getOrCreateStreamContext();
		if (!resumableContext) {
			res.status(204).send();
			return;
		}

		if (!chatId) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		// Verify user has access to this chat
		await getChatById(chatId, {
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
		});

		const streamIds = await getStreamIdsByChatId(chatId);

		if (!streamIds.length) {
			res.status(404).json(new ChatSDKError("not_found:stream").toResponse());
			return;
		}

		const recentStreamId = streamIds.at(-1);

		if (!recentStreamId) {
			res.status(404).json(new ChatSDKError("not_found:stream").toResponse());
			return;
		}

		const stream = await resumableContext.resumableStream(recentStreamId, () => new ReadableStream());

		if (!stream) {
			res.status(204).send();
			return;
		}

		// Set SSE headers
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache, no-transform");
		res.setHeader("Connection", "keep-alive");
		res.setHeader("X-Accel-Buffering", "no");
		res.flushHeaders();

		const reader = stream.getReader();
		const encoder = new TextEncoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				res.write(typeof value === "string" ? value : encoder.encode(value));
			}
		} catch (error) {
			console.error("Stream error:", error);
		} finally {
			res.end();
		}
	} catch (error) {
		if (error instanceof ChatSDKError) {
			res.status(error.statusCode).json(error.toResponse());
			return;
		}

		console.error("Error resuming stream:", error);
		res.status(500).json(new ChatSDKError("offline:chat").toResponse());
	}
}
