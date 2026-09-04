import type { Response } from "express";
import {
	convertToModelMessages,
	createUIMessageStream,
	generateText,
	JsonToSseTransformStream,
	smoothStream,
	stepCountIs,
	streamText,
} from "ai";
import type { UIMessage } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { z } from "zod";
import type { AuthenticatedRequest } from "@/domains/auth/auth.types.js";
import { messageLimits } from "@/middleware/rate-limiter.js";
import { myProvider } from "@/lib/ai/providers.js";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts.js";
import { getCkanInfo, queryCkan, searchCkanDatasets } from "@/lib/ai/tools/query-ckan.js";
import { searchDocuments } from "@/lib/ai/tools/search-documents.js";
import { searchLawArticles } from "@/lib/ai/tools/search-law-articles.js";
import { searchRelevantLinks } from "@/lib/ai/tools/search-relevant-links.js";
import { showMap } from "@/lib/ai/tools/show-map.js";
import { showTable } from "@/lib/ai/tools/show-table.js";
import { isProductionEnvironment } from "@/lib/constants.js";
import { ChatSDKError } from "@/lib/errors.js";
import type { ChatMessage } from "@/lib/types.js";
import type { AppUsage } from "@/lib/usage.js";
import { convertToUIMessages, generateUUID } from "@/lib/utils.js";
import {
	getChatById,
	getChatForModification,
	createNewChat,
	deleteChatById,
	deleteAllUserChats,
	generateTitleFromMessage,
	updateLastContext,
} from "./chat.service.js";
import { updateChatVisibility as updateChatVisibilityInDb } from "./chat.repository.js";
import { saveMessages, getMessagesByChatId, getMessageCountByUserId } from "@/domains/message/message.service.js";
import { createStreamId, getCkanDatasetCount } from "@/domains/stream/stream.service.js";

// Request validation schemas
const textPartSchema = z.object({
	type: z.enum(["text"]),
	text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
	type: z.enum(["file"]),
	mediaType: z.enum(["image/jpeg", "image/png"]),
	name: z.string().min(1).max(100),
	url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const postRequestBodySchema = z.object({
	id: z.string().uuid(),
	message: z.object({
		id: z.string().uuid(),
		role: z.enum(["user"]),
		parts: z.array(partSchema),
	}),
	selectedChatModel: z.enum(["chat-model", "chat-model-reasoning"]),
	selectedVisibilityType: z.enum(["public", "private"]),
});

// Stream context singleton
let globalStreamContext: ReturnType<typeof createResumableStreamContext> | null = null;

async function getTokenlensCatalog(): Promise<ModelCatalog | undefined> {
	try {
		return await fetchModels();
	} catch (err) {
		console.warn("TokenLens: catalog fetch failed, using default catalog", err);
		return;
	}
}

function getOrCreateStreamContext() {
	if (!globalStreamContext) {
		try {
			globalStreamContext = createResumableStreamContext({
				waitUntil: (promise: Promise<unknown>) => {
					promise.catch((err) => console.error("Background task error:", err));
				},
			});
		} catch (error: unknown) {
			if (!(error instanceof Error && error.message.includes("REDIS_URL"))) {
				console.error(error);
			}
		}
	}
	return globalStreamContext;
}

// Tool name to Dutch description mapping
const toolDescriptions: Record<string, string> = {
	searchDocuments: "beleidsdocumenten",
	searchLawArticles: "de Omgevingswet",
	searchRelevantLinks: "relevante pagina's",
	searchCkanDatasets: "beschikbare datasets",
	getCkanInfo: "dataset informatie",
	queryCkan: "gemeentelijke data",
	showMap: "locatiegegevens",
	showTable: "tabelgegevens",
	getWeather: "weergegevens",
};

/**
 * Generates a user-friendly summary of executed tools using a fast LLM call
 */
async function generateToolsSummary(
	toolNames: string[],
	userQuestion: string,
): Promise<string | null> {
	if (toolNames.length === 0) return null;

	// Get unique tool names
	const uniqueTools = [...new Set(toolNames)];

	// If only one tool, use a simple description
	if (uniqueTools.length === 1) {
		const desc = toolDescriptions[uniqueTools[0]];
		return desc ? `${desc.charAt(0).toUpperCase() + desc.slice(1)} geraadpleegd` : null;
	}

	// For multiple tools, generate a summary
	const toolList = uniqueTools
		.map((t) => toolDescriptions[t])
		.filter(Boolean)
		.join(", ");

	try {
		const result = await generateText({
			model: myProvider.languageModel("summary-model"),
			system: `Je bent een assistent die korte samenvattingen maakt. Genereer een korte zin (max 10 woorden) in het Nederlands die beschrijft welke bronnen zijn geraadpleegd. Gebruik geen aanhalingstekens. Begin met een hoofdletter. Eindig NIET met een punt.`,
			prompt: `De gebruiker vroeg: "${userQuestion.slice(0, 100)}"
Geraadpleegde bronnen: ${toolList}
Geef een korte samenvatting van wat er is opgezocht.`,
			maxOutputTokens: 30,
		});

		const summary = result.text.trim().replace(/\.$/, "");
		return summary || null;
	} catch (err) {
		console.warn("[generateToolsSummary] Failed to generate summary:", err);
		// Fallback to simple description
		return `${uniqueTools.length} bronnen geraadpleegd`;
	}
}

/**
 * Strip large tool results from messages before saving.
 */
function stripLargeToolResults(messages: UIMessage[]): UIMessage[] {
	return messages.map((msg) => ({
		...msg,
		parts: msg.parts.map((part) => {
			if (
				part.type === "tool-showMap" &&
				"state" in part &&
				part.state === "output-available" &&
				"output" in part
			) {
				const result = part.output as Record<string, unknown>;
				if (result && typeof result === "object") {
					const summary = {
						title: result.title,
						center: result.center,
						zoom: result.zoom,
						fitBounds: result.fitBounds,
						markersCount: (result.markers as unknown[])?.length ?? 0,
						polygonsCount: (result.polygons as unknown[])?.length ?? 0,
						legend: result.legend,
						queryInfo: result.queryInfo,
						dataQueries: result.dataQueries,
					};
					return { ...part, output: summary };
				}
			}

			if (
				part.type === "tool-queryCkan" &&
				"state" in part &&
				part.state === "output-available" &&
				"output" in part
			) {
				const result = part.output as Record<string, unknown>;
				if (result && typeof result === "object") {
					const summary = {
						success: result.success,
						datasets: result.datasets,
						query: result.query,
						description: result.description,
						outputLimit: result.outputLimit,
						totalInDatasets: result.totalInDatasets,
						totalResults: result.totalResults,
						resultsShown: result.resultsShown,
						truncated: result.truncated,
						hint: result.hint,
						error: result.error,
					};
					return { ...part, output: summary };
				}
			}

			if (
				part.type === "tool-showTable" &&
				"state" in part &&
				part.state === "output-available" &&
				"output" in part
			) {
				const result = part.output as Record<string, unknown>;
				if (result && typeof result === "object") {
					const summary = {
						description: result.description,
						title: result.title,
						columns: result.columns,
						totalRows: result.totalRows,
						truncated: result.truncated,
						queryError: result.queryError,
						dataQuery: result.dataQuery,
					};
					return { ...part, output: summary };
				}
			}

			return part;
		}),
	}));
}

export async function createChat(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const requestBody = postRequestBodySchema.parse(req.body);
		const { id, message, selectedChatModel, selectedVisibilityType } = requestBody;

		const userId = req.user?.id ?? null;
		const sessionId = req.anonymousSessionId ?? null;
		const isAuthenticated = !!req.user;

		// Check daily message limit for authenticated users
		if (isAuthenticated) {
			const messageCount = await getMessageCountByUserId(req.user!.id, 24);

			if (messageCount >= messageLimits.regular.maxMessagesPerDay) {
				res.status(429).json(new ChatSDKError("rate_limit:chat").toResponse());
				return;
			}
		}

		// Check if chat exists
		const existingChat = await getChatById(id, {
			userId: userId ?? undefined,
			sessionId: sessionId ?? undefined,
		}).catch(() => null);

		if (existingChat) {
			// Verify ownership
			const canModify =
				(isAuthenticated && existingChat.userId === userId) ||
				(!isAuthenticated && existingChat.sessionId === sessionId && !existingChat.userId);

			if (!canModify) {
				res.status(403).json(new ChatSDKError("forbidden:chat").toResponse());
				return;
			}
		} else {
			// Create new chat
			const title = generateTitleFromMessage(message);
			await createNewChat({
				id,
				userId,
				sessionId,
				title,
				visibility: selectedVisibilityType,
			});
		}

		// Save user message
		await saveMessages([
			{
				chatId: id,
				id: message.id,
				role: "user",
				parts: message.parts,
				attachments: [],
				createdAt: new Date(),
			},
		]);

		// Get message history
		const historyMessages = convertToUIMessages(await getMessagesByChatId(id));
		const uiMessages = [...historyMessages] as ChatMessage[];

		// Geolocation hints (none in self-hosted Azure setup; left empty)
		const requestHints: RequestHints = {
			longitude: undefined,
			latitude: undefined,
			city: undefined,
			country: undefined,
		};

		const streamId = generateUUID();
		await createStreamId(streamId, id);

		const datasetCount = await getCkanDatasetCount();

		let finalMergedUsage: AppUsage | undefined;

		const messageStream = createUIMessageStream({
			execute: ({ writer: streamWriter }) => {
				const result = streamText({
					model: myProvider.languageModel(selectedChatModel),
					system: systemPrompt({ selectedChatModel, requestHints, datasetCount }),
					messages: convertToModelMessages(uiMessages),
					stopWhen: stepCountIs(30),
					experimental_transform: smoothStream({ chunking: "word" }),
					tools: {
						searchCkanDatasets,
						getCkanInfo,
						queryCkan,
						searchDocuments,
						searchLawArticles,
						searchRelevantLinks,
						showMap,
						showTable,
					},
					experimental_telemetry: {
						isEnabled: isProductionEnvironment,
						functionId: "stream-text",
					},
					onFinish: async ({ usage, steps }) => {

						// Collect all tool calls from steps
						const allToolCalls: string[] = [];
						for (const step of steps ?? []) {
							if (step.toolCalls) {
								for (const tc of step.toolCalls) {
									allToolCalls.push(tc.toolName);
								}
							}
						}

						// Generate tools summary if there were multiple tool calls
						if (allToolCalls.length > 1) {
							const userQuestion = message.parts
								.filter((p): p is { type: "text"; text: string } => p.type === "text")
								.map((p) => p.text)
								.join(" ");

							const toolsSummary = await generateToolsSummary(allToolCalls, userQuestion);
							if (toolsSummary) {
								streamWriter.write({ type: "data-tools-summary", data: toolsSummary });
							}
						}

						try {
							const providers = await getTokenlensCatalog();
							const modelId = myProvider.languageModel(selectedChatModel).modelId;

							if (!modelId || !providers) {
								finalMergedUsage = usage;
								streamWriter.write({ type: "data-usage", data: finalMergedUsage });
								return;
							}

							const usageSummary = getUsage({ modelId, usage, providers });
							finalMergedUsage = { ...usage, ...usageSummary, modelId } as AppUsage;
							streamWriter.write({ type: "data-usage", data: finalMergedUsage });
						} catch (err) {
							console.warn("TokenLens enrichment failed", err);
							finalMergedUsage = usage;
							streamWriter.write({ type: "data-usage", data: finalMergedUsage });
						}
					},
				});

				result.consumeStream();
				streamWriter.merge(result.toUIMessageStream({ sendReasoning: true }));
			},
			generateId: generateUUID,
			onFinish: async ({ messages }) => {
				const strippedMessages = stripLargeToolResults(messages);
				await saveMessages(
					strippedMessages.map((currentMessage) => ({
						id: currentMessage.id,
						role: currentMessage.role,
						parts: currentMessage.parts,
						createdAt: new Date(),
						attachments: [],
						chatId: id,
					})),
				);

				if (finalMergedUsage) {
					try {
						await updateLastContext(id, finalMergedUsage);
					} catch (err) {
						console.warn("Unable to persist last usage for chat", id, err);
					}
				}
			},
			onError: () => "Oops, an error occurred!",
		});

		const streamContext = getOrCreateStreamContext();

		// Set SSE headers
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache, no-transform");
		res.setHeader("Connection", "keep-alive");
		res.setHeader("X-Accel-Buffering", "no");
		res.flushHeaders();

		let clientDisconnected = false;
		req.on("close", () => {
			clientDisconnected = true;
		});

		const pipeStreamToResponse = async (stream: ReadableStream<string>) => {
			const reader = stream.getReader();
			const encoder = new TextEncoder();

			try {
				while (!clientDisconnected) {
					const { done, value } = await reader.read();
					if (done) break;
					if (!clientDisconnected) {
						res.write(typeof value === "string" ? value : encoder.encode(value));
					}
				}
			} catch (error) {
				if (!clientDisconnected) {
					console.error("Stream error:", error);
				}
			} finally {
				reader.releaseLock();
				if (!res.writableEnded) {
					res.end();
				}
			}
		};

		if (streamContext) {
			const resumableStream = await streamContext.resumableStream(streamId, () =>
				messageStream.pipeThrough(new JsonToSseTransformStream()),
			);

			if (!resumableStream) {
				throw new Error("Failed to create resumable stream");
			}

			await pipeStreamToResponse(resumableStream);
		} else {
			const sseStream = messageStream.pipeThrough(new JsonToSseTransformStream());
			await pipeStreamToResponse(sseStream);
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		if (error instanceof ChatSDKError) {
			res.status(error.statusCode).json(error.toResponse());
			return;
		}

		if (error instanceof Error && error.message?.includes("AI Gateway requires a valid credit card")) {
			res.status(400).json(new ChatSDKError("bad_request:activate_gateway").toResponse());
			return;
		}

		console.error("Unhandled error in chat API:", error);
		res.status(503).json(new ChatSDKError("offline:chat").toResponse());
	}
}

export async function showChat(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const idResult = z.string().uuid().safeParse(req.params.id);

		if (!idResult.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const id = idResult.data;
		const chat = await getChatById(id, {
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
		});

		const messages = await getMessagesByChatId(id);
		const uiMessages = convertToUIMessages(messages);

		res.status(200).json({ chat, messages: uiMessages });
	} catch (error) {
		if (error instanceof ChatSDKError) {
			res.status(error.statusCode).json(error.toResponse());
			return;
		}

		console.error("Error getting chat:", error);
		res.status(500).json(new ChatSDKError("offline:chat").toResponse());
	}
}

export async function destroyChat(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const idResult = z.string().uuid().safeParse(req.query.id);

		if (!idResult.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const deletedChat = await deleteChatById(idResult.data, {
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
		});

		res.status(200).json(deletedChat);
	} catch (error) {
		if (error instanceof ChatSDKError) {
			res.status(error.statusCode).json(error.toResponse());
			return;
		}

		console.error("Error deleting chat:", error);
		res.status(500).json(new ChatSDKError("offline:chat").toResponse());
	}
}

const updateVisibilitySchema = z.object({
	visibility: z.enum(["public", "private"]),
});

export async function updateVisibility(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const idResult = z.string().uuid().safeParse(req.params.id);

		if (!idResult.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const bodyResult = updateVisibilitySchema.safeParse(req.body);

		if (!bodyResult.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const chat = await getChatForModification(idResult.data, {
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
		});

		const updatedChat = await updateChatVisibilityInDb(chat.id, bodyResult.data.visibility);
		res.status(200).json(updatedChat);
	} catch (error) {
		if (error instanceof ChatSDKError) {
			res.status(error.statusCode).json(error.toResponse());
			return;
		}

		console.error("Error updating chat visibility:", error);
		res.status(500).json(new ChatSDKError("offline:chat").toResponse());
	}
}

export async function destroyAllChats(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		if (!req.user) {
			res.status(401).json(new ChatSDKError("unauthorized:chat").toResponse());
			return;
		}

		const result = await deleteAllUserChats(req.user.id);

		res.status(200).json({ deletedCount: result.count });
	} catch (error) {
		if (error instanceof ChatSDKError) {
			res.status(error.statusCode).json(error.toResponse());
			return;
		}

		console.error("Error deleting all chats:", error);
		res.status(500).json(new ChatSDKError("offline:chat").toResponse());
	}
}
