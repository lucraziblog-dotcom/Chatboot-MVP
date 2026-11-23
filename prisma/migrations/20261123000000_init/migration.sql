CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "AgencyRole" AS ENUM ('OWNER', 'ADMIN', 'CONSULTANT');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFYING', 'WAITING_HUMAN', 'IN_PROGRESS', 'CONVERTED', 'LOST');
CREATE TYPE "TourismSegment" AS ENUM ('AIR', 'EXCURSION', 'RECEPTIVE', 'UNDEFINED');
CREATE TYPE "ConversationStatus" AS ENUM ('BOT', 'HUMAN', 'CLOSED');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AgencyRole" NOT NULL DEFAULT 'CONSULTANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "segment" "TourismSegment" NOT NULL DEFAULT 'UNDEFINED',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "serviceSummary" TEXT,
    "qualification" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "leadId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'BOT',
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyService" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "segment" "TourismSegment" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FAQ" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FAQ_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "openingHours" JSONB,
    "handoffMessage" TEXT NOT NULL DEFAULT 'Vou encaminhar você para um consultor da nossa equipe.',
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");
CREATE INDEX "Agency_name_idx" ON "Agency"("name");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "Membership_agencyId_userId_key" ON "Membership"("agencyId", "userId");
CREATE UNIQUE INDEX "Lead_agencyId_id_key" ON "Lead"("agencyId", "id");
CREATE INDEX "Lead_agencyId_status_updatedAt_idx" ON "Lead"("agencyId", "status", "updatedAt" DESC);
CREATE INDEX "Lead_agencyId_segment_updatedAt_idx" ON "Lead"("agencyId", "segment", "updatedAt" DESC);
CREATE INDEX "Lead_agencyId_phone_idx" ON "Lead"("agencyId", "phone");
CREATE UNIQUE INDEX "Conversation_agencyId_id_key" ON "Conversation"("agencyId", "id");
CREATE INDEX "Conversation_agencyId_status_lastMessageAt_idx" ON "Conversation"("agencyId", "status", "lastMessageAt" DESC);
CREATE INDEX "Conversation_agencyId_customerPhone_idx" ON "Conversation"("agencyId", "customerPhone");
CREATE UNIQUE INDEX "Message_agencyId_externalMessageId_key" ON "Message"("agencyId", "externalMessageId");
CREATE INDEX "Message_agencyId_conversationId_createdAt_idx" ON "Message"("agencyId", "conversationId", "createdAt");
CREATE INDEX "AgencyService_agencyId_isActive_segment_idx" ON "AgencyService"("agencyId", "isActive", "segment");
CREATE INDEX "FAQ_agencyId_isActive_idx" ON "FAQ"("agencyId", "isActive");
CREATE UNIQUE INDEX "BotSettings_agencyId_key" ON "BotSettings"("agencyId");
CREATE INDEX "AuditLog_agencyId_createdAt_idx" ON "AuditLog"("agencyId", "createdAt" DESC);
CREATE INDEX "AuditLog_agencyId_entityType_entityId_idx" ON "AuditLog"("agencyId", "entityType", "entityId");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agencyId_leadId_fkey" FOREIGN KEY ("agencyId", "leadId") REFERENCES "Lead"("agencyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_agencyId_conversationId_fkey" FOREIGN KEY ("agencyId", "conversationId") REFERENCES "Conversation"("agencyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyService" ADD CONSTRAINT "AgencyService_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FAQ" ADD CONSTRAINT "FAQ_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotSettings" ADD CONSTRAINT "BotSettings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
