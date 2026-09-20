-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "systemPrompt" TEXT;

-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "cost" INTEGER,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "reasoning" TEXT;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "chatId" TEXT,
    "messageId" INTEGER,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_accountId_createdAt_idx" ON "Attachment"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_chatId_idx" ON "Attachment"("chatId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
