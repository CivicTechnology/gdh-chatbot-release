import { Prisma } from "@gdh-chatbot/api/prisma";
import { DEFAULT_EMBEDDING_MODEL_ID } from "@/lib/ai/embeddings.js";
import { ChatSDKError } from "../errors.js";
import type { AppUsage } from "../usage.js";
import { prisma } from "./prisma.js";
import type {
  Chat,
  User,
  Message as DBMessage,
} from "@gdh-chatbot/api/prisma";
import { generateHashedPassword } from "./utils.js";

type VisibilityType = "public" | "private";

export async function getUser(email: string): Promise<User[]> {
  try {
    return await prisma.user.findMany({ where: { email } });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    return await prisma.user.findUnique({ where: { id } });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get user by id");
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await prisma.user.create({ data: { email, password: hashedPassword } });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string | null;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await prisma.chat.create({
      data: {
        id,
        createdAt: new Date(),
        userId,
        title,
        visibility,
      },
    });
  } catch (_error) {
    console.error("Failed to save chat", _error);
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    // CASCADE deletes handle related records automatically:
    // - Message_v2, Vote_v2, Stream are deleted via ON DELETE CASCADE
    return await prisma.chat.delete({ where: { id } });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    // CASCADE deletes handle related records automatically
    return await prisma.chat.deleteMany({ where: { userId } });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const selectedChat = await prisma.chat.findUnique({
        where: { id: startingAfter },
      });

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await prisma.chat.findMany({
        where: {
          userId: id,
          createdAt: { gt: selectedChat.createdAt },
        },
        orderBy: { createdAt: "desc" },
        take: extendedLimit,
      });
    } else if (endingBefore) {
      const selectedChat = await prisma.chat.findUnique({
        where: { id: endingBefore },
      });

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await prisma.chat.findMany({
        where: {
          userId: id,
          createdAt: { lt: selectedChat.createdAt },
        },
        orderBy: { createdAt: "desc" },
        take: extendedLimit,
      });
    } else {
      filteredChats = await prisma.chat.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: extendedLimit,
      });
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    return await prisma.chat.findUnique({ where: { id } });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<{
    id: string;
    chatId: string;
    role: string;
    parts: unknown;
    attachments: unknown;
    createdAt: Date;
  }>;
}) {
  try {
    return await prisma.message.createMany({
      data: messages as Prisma.MessageCreateManyInput[],
      skipDuplicates: true,
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await prisma.message.findMany({
      where: { chatId: id },
      orderBy: { createdAt: "asc" },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const existingVote = await prisma.vote.findFirst({
      where: { messageId },
    });

    if (existingVote) {
      return await prisma.vote.updateMany({
        where: { messageId, chatId },
        data: { isUpvoted: type === "up" },
      });
    }
    return await prisma.vote.create({
      data: {
        chatId,
        messageId,
        isUpvoted: type === "up",
      },
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await prisma.vote.findMany({ where: { chatId: id } });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    const result = await prisma.message.findUnique({ where: { id } });
    return result ? [result] : [];
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await prisma.message.findMany({
      where: {
        chatId,
        createdAt: { gte: timestamp },
      },
      select: { id: true },
    });

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await prisma.vote.deleteMany({
        where: {
          chatId,
          messageId: { in: messageIds },
        },
      });

      return await prisma.message.deleteMany({
        where: {
          chatId,
          id: { in: messageIds },
        },
      });
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await prisma.chat.update({
      where: { id: chatId },
      data: { visibility },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store merged server-enriched usage object
  context: AppUsage;
}) {
  try {
    return await prisma.chat.update({
      where: { id: chatId },
      data: { lastContext: context },
    });
  } catch (error) {
    console.warn("Failed to update lastContext for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const stats = await prisma.message.count({
      where: {
        chat: { userId: id },
        createdAt: { gte: twentyFourHoursAgo },
        role: "user",
      },
    });

    return stats ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export type DocumentChunkSearchResult = {
  id: string;
  chunkId: string;
  text: string;
  metadata: Record<string, unknown>;
  pageStart: number;
  pageEnd: number;
  sectionPath: string[] | null;
  chunkType: string;
  isTable: boolean;
  tableId: string | null;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceCategory: string;
  sourceTags: string[];
  distance: number;
};

function _normalizeSectionPath(
  sectionPath: unknown
): string[] | null | undefined {
  if (Array.isArray(sectionPath)) {
    return sectionPath as string[];
  }
  if (sectionPath === null) {
    return null;
  }
  return [String(sectionPath)];
}

export async function searchDocumentChunks({
  embedding,
  limit = 5,
  sourceIds,
}: {
  embedding: number[];
  limit?: number;
  sourceIds?: string[];
}): Promise<DocumentChunkSearchResult[]> {
  if (!embedding.length) {
    return [];
  }

  const vectorLiteral = `[${embedding.join(",")}]`;
  const limitValue = Math.min(Math.max(Math.floor(limit), 1), 50);

  type RawDocumentChunkRow = {
    id: string;
    chunkId: string;
    text: string;
    metadata: Record<string, unknown>;
    pageStart: number;
    pageEnd: number;
    sectionPath: unknown;
    chunkType: string;
    isTable: boolean;
    tableId: string | null;
    sourceId: string;
    sourceTitle: string;
    sourceUrl: string;
    sourceCategory: string;
    sourceTags: unknown;
    distance: number | string;
  };

  const sourceFilter = sourceIds?.length
    ? Prisma.sql`AND ds."sourceId" = ANY(${sourceIds})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<RawDocumentChunkRow[]>`
    SELECT
      dc.id,
      dc."chunkId" AS "chunkId",
      dc."text",
      COALESCE(dc."metadata", '{}'::jsonb) AS "metadata",
      dc."pageStart",
      dc."pageEnd",
      dc."sectionPath",
      dc."chunkType",
      dc."isTable",
      dc."tableId",
      ds."sourceId",
      ds."title" AS "sourceTitle",
      ds."url" AS "sourceUrl",
      ds."category" AS "sourceCategory",
      ds."tags" AS "sourceTags",
      (de."embedding" <=> ${vectorLiteral}::vector) AS "distance"
    FROM "DocumentEmbedding" de
    INNER JOIN "DocumentChunk" dc ON dc.id = de."chunkId"
    INNER JOIN "DocumentSource" ds ON ds.id = dc."sourceId"
    WHERE de."embeddingModel" = ${DEFAULT_EMBEDDING_MODEL_ID}
    ${sourceFilter}
    ORDER BY de."embedding" <=> ${vectorLiteral}::vector
    LIMIT ${limitValue}
  `;

  return rows.map((row) => ({
    id: row.id,
    chunkId: row.chunkId,
    text: row.text,
    metadata: row.metadata ?? {},
    pageStart: row.pageStart,
    pageEnd: row.pageEnd,
    sectionPath: _normalizeSectionPath(row.sectionPath) ?? null,
    chunkType: row.chunkType,
    isTable: row.isTable,
    tableId: row.tableId,
    sourceId: row.sourceId,
    sourceTitle: row.sourceTitle,
    sourceUrl: row.sourceUrl,
    sourceCategory: row.sourceCategory,
    sourceTags: Array.isArray(row.sourceTags)
      ? (row.sourceTags as string[])
      : [],
    distance: Number(row.distance),
  }));
}

export async function searchWebSections({
  embedding,
  limit = 15,
}: {
  embedding: number[];
  limit?: number;
}): Promise<DocumentChunkSearchResult[]> {
  if (!embedding.length) {
    return [];
  }

  const vectorLiteral = `[${embedding.join(",")}]`;
  const limitValue = Math.min(Math.max(Math.floor(limit), 1), 50);

  type RawDocumentChunkRow = {
    id: string;
    chunkId: string;
    text: string;
    metadata: Record<string, unknown>;
    pageStart: number;
    pageEnd: number;
    sectionPath: unknown;
    chunkType: string;
    isTable: boolean;
    tableId: string | null;
    sourceId: string;
    sourceTitle: string;
    sourceUrl: string;
    sourceCategory: string;
    sourceTags: unknown;
    distance: number | string;
  };

  // Search only for web_section chunks (which contain the structured links)
  const rows = await prisma.$queryRaw<RawDocumentChunkRow[]>`
    SELECT
      dc.id,
      dc."chunkId" AS "chunkId",
      dc."text",
      COALESCE(dc."metadata", '{}'::jsonb) AS "metadata",
      dc."pageStart",
      dc."pageEnd",
      dc."sectionPath",
      dc."chunkType",
      dc."isTable",
      dc."tableId",
      ds."sourceId",
      ds."title" AS "sourceTitle",
      ds."url" AS "sourceUrl",
      ds."category" AS "sourceCategory",
      ds."tags" AS "sourceTags",
      (de."embedding" <=> ${vectorLiteral}::vector) AS "distance"
    FROM "DocumentEmbedding" de
    INNER JOIN "DocumentChunk" dc ON dc.id = de."chunkId"
    INNER JOIN "DocumentSource" ds ON ds.id = dc."sourceId"
    WHERE de."embeddingModel" = ${DEFAULT_EMBEDDING_MODEL_ID}
      AND dc."chunkType" = 'web_section'
      AND jsonb_exists(dc."metadata", 'structuredLinks')
    ORDER BY de."embedding" <=> ${vectorLiteral}::vector
    LIMIT ${limitValue}
  `;

  return rows.map((row) => ({
    id: row.id,
    chunkId: row.chunkId,
    text: row.text,
    metadata: row.metadata ?? {},
    pageStart: row.pageStart,
    pageEnd: row.pageEnd,
    sectionPath: _normalizeSectionPath(row.sectionPath) ?? null,
    chunkType: row.chunkType,
    isTable: row.isTable,
    tableId: row.tableId,
    sourceId: row.sourceId,
    sourceTitle: row.sourceTitle,
    sourceUrl: row.sourceUrl,
    sourceCategory: row.sourceCategory,
    sourceTags: Array.isArray(row.sourceTags)
      ? (row.sourceTags as string[])
      : [],
    distance: Number(row.distance),
  }));
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await prisma.stream.create({
      data: { id: streamId, chatId, createdAt: new Date() },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await prisma.stream.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

export async function getSourceIdsWithTag(tag: string): Promise<string[]> {
  type SourceIdRow = { sourceId: string };

  const rows = await prisma.$queryRaw<SourceIdRow[]>`
    SELECT "sourceId"
    FROM "DocumentSource"
    WHERE "tags" @> ${JSON.stringify([tag])}::jsonb
    ORDER BY "sourceId"
  `;

  return rows.map((row) => row.sourceId);
}

// Cache for dataset count (refreshed every 5 minutes)
let cachedDatasetCount: number | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCkanDatasetCount(): Promise<number> {
  const now = Date.now();
  if (cachedDatasetCount !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedDatasetCount;
  }

  try {
    const count = await prisma.ckanDataset.count();
    cachedDatasetCount = count;
    cacheTimestamp = now;
    return count;
  } catch (_error) {
    // Return cached value if available, otherwise 0
    return cachedDatasetCount ?? 0;
  }
}
