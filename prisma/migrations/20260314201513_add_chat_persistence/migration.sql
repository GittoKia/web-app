-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "title" TEXT NOT NULL,
    "latestQuestion" TEXT,
    "latestAnswer" TEXT,
    "metadata" JSONB,
    "medicalExtraction" JSONB,
    "medicalFeatures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_retrieval_hits" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "title" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "excerpt" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_retrieval_hits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_conversations_userId_updatedAt_idx" ON "chat_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "chat_conversations_guestSessionId_updatedAt_idx" ON "chat_conversations"("guestSessionId", "updatedAt");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_sequence_idx" ON "chat_messages"("conversationId", "sequence");

-- CreateIndex
CREATE INDEX "chat_retrieval_hits_conversationId_createdAt_idx" ON "chat_retrieval_hits"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_retrieval_hits" ADD CONSTRAINT "chat_retrieval_hits_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
