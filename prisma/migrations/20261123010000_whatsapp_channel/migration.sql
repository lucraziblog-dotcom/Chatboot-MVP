ALTER TABLE "BotSettings"
ADD COLUMN "whatsappPhoneNumberId" TEXT,
ADD COLUMN "whatsappAccessTokenEncrypted" TEXT;

CREATE UNIQUE INDEX "BotSettings_whatsappPhoneNumberId_key"
ON "BotSettings"("whatsappPhoneNumberId");

DROP INDEX "Conversation_agencyId_customerPhone_idx";

CREATE UNIQUE INDEX "Conversation_agencyId_customerPhone_key"
ON "Conversation"("agencyId", "customerPhone");
