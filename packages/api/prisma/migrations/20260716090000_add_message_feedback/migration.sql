-- MessageFeedback: gebruikersfeedback op assistent-berichten.

-- CreateTable
CREATE TABLE "MessageFeedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "isUpvoted" BOOLEAN NOT NULL,
    "comment" TEXT,
    "chatShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageFeedback_chatId_messageId_key" ON "MessageFeedback"("chatId", "messageId");

-- CreateIndex
CREATE INDEX "MessageFeedback_createdAt_idx" ON "MessageFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "MessageFeedback_isUpvoted_createdAt_idx" ON "MessageFeedback"("isUpvoted", "createdAt");

-- AddForeignKey
ALTER TABLE "MessageFeedback" ADD CONSTRAINT "MessageFeedback_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageFeedback" ADD CONSTRAINT "MessageFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bestaande duimen uit Vote_v2 meenemen zodat de feedbackpagina en de
-- duim-status in de chat-UI geen historie verliezen. Als benadering van het
-- stem-moment gebruiken we de createdAt van het beoordeelde bericht.
INSERT INTO "MessageFeedback" ("chatId", "messageId", "isUpvoted", "createdAt", "updatedAt")
SELECT v."chatId", v."messageId", v."isUpvoted", m."createdAt", m."createdAt"
FROM "Vote_v2" v
JOIN "Message_v2" m ON m."id" = v."messageId"
ON CONFLICT ("chatId", "messageId") DO NOTHING;
