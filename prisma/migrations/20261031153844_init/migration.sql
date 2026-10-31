-- Enable trigram extension for fast ILIKE search on message text
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('UNKNOWN', 'CONNECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'POSTBACK', 'FOLLOW', 'UNFOLLOW', 'FLEX', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'PROCESSING', 'REPLIED', 'NO_REPLY', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RuleTrigger" AS ENUM ('TEXT', 'POSTBACK', 'FOLLOW', 'IMAGE', 'STICKER', 'LOCATION');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('EXACT', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX');

-- CreateEnum
CREATE TYPE "KeywordLogic" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "ReplyContentType" AS ENUM ('TEXT', 'FLEX', 'MIXED');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ReplyMethod" AS ENUM ('REPLY', 'PUSH');

-- CreateEnum
CREATE TYPE "ReplySource" AS ENUM ('RULE', 'DEFAULT', 'ADMIN', 'RETRY');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "passwordChangedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineAccount" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "botUserId" TEXT,
    "basicId" TEXT,
    "displayName" TEXT,
    "pictureUrl" TEXT,
    "channelSecretEnc" TEXT,
    "channelAccessTokenEnc" TEXT,
    "credentialsUpdatedAt" TIMESTAMPTZ(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "connectionError" TEXT,
    "lastVerifiedAt" TIMESTAMPTZ(3),
    "lastWebhookAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LineAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "lineAccountId" UUID NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "pictureUrl" TEXT,
    "statusMessage" TEXT,
    "language" TEXT,
    "isFollowing" BOOLEAN NOT NULL DEFAULT true,
    "followedAt" TIMESTAMPTZ(3),
    "unfollowedAt" TIMESTAMPTZ(3),
    "lastMessageAt" TIMESTAMPTZ(3),
    "lastMessageText" TEXT,
    "lastMessageType" "MessageType",
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "profileSyncedAt" TIMESTAMPTZ(3),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL,
    "lineAccountId" UUID NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT,
    "sourceType" TEXT,
    "sourceUserId" TEXT,
    "eventTimestamp" TIMESTAMPTZ(3) NOT NULL,
    "isRedelivery" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "replyTokenEnc" TEXT,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(3),
    "processedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "lineAccountId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "webhookEventId" UUID,
    "direction" "MessageDirection" NOT NULL,
    "type" "MessageType" NOT NULL,
    "text" TEXT,
    "payload" JSONB,
    "lineMessageId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sentById" UUID,
    "replyLogId" UUID,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReplyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlexTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "altText" TEXT NOT NULL,
    "containerType" TEXT NOT NULL,
    "contents" JSONB NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FlexTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyRule" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "triggerType" "RuleTrigger" NOT NULL DEFAULT 'TEXT',
    "matchType" "MatchType" NOT NULL DEFAULT 'CONTAINS',
    "keywordLogic" "KeywordLogic" NOT NULL DEFAULT 'ANY',
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "replyType" "ReplyContentType" NOT NULL,
    "textTemplateId" UUID,
    "flexTemplateId" UUID,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatchedAt" TIMESTAMPTZ(3),
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReplyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyKeyword" (
    "id" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReplyKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyLog" (
    "id" UUID NOT NULL,
    "lineAccountId" UUID,
    "customerId" UUID,
    "sourceMessageId" UUID,
    "webhookEventId" UUID,
    "ruleId" UUID,
    "ruleName" TEXT,
    "matchedRules" JSONB,
    "matchedKeyword" TEXT,
    "source" "ReplySource" NOT NULL,
    "method" "ReplyMethod" NOT NULL,
    "replyType" "ReplyContentType" NOT NULL,
    "status" "ReplyStatus" NOT NULL DEFAULT 'PENDING',
    "requestMessages" JSONB,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "lineRequestId" TEXT,
    "retryKey" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "triggeredById" UUID,
    "retryOfId" UUID,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReplyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LineAccount_botUserId_key" ON "LineAccount"("botUserId");

-- CreateIndex
CREATE INDEX "LineAccount_isDefault_isActive_idx" ON "LineAccount"("isDefault", "isActive");

-- CreateIndex
CREATE INDEX "Customer_lineAccountId_lastMessageAt_idx" ON "Customer"("lineAccountId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "Customer_displayName_idx" ON "Customer"("displayName");

-- CreateIndex
CREATE INDEX "Customer_lineUserId_idx" ON "Customer"("lineUserId");

-- CreateIndex
CREATE INDEX "Customer_isFollowing_idx" ON "Customer"("isFollowing");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_lineAccountId_lineUserId_key" ON "Customer"("lineAccountId", "lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_webhookEventId_key" ON "WebhookEvent"("webhookEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_availableAt_idx" ON "WebhookEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_sourceUserId_idx" ON "WebhookEvent"("sourceUserId");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_webhookEventId_key" ON "Message"("webhookEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_lineMessageId_key" ON "Message"("lineMessageId");

-- CreateIndex
CREATE INDEX "Message_customerId_timestamp_idx" ON "Message"("customerId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Message_lineAccountId_timestamp_idx" ON "Message"("lineAccountId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Message_direction_timestamp_idx" ON "Message"("direction", "timestamp");

-- CreateIndex
CREATE INDEX "Message_type_idx" ON "Message"("type");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "Message_text_trgm_idx" ON "Message" USING GIN ("text" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ReplyTemplate_name_idx" ON "ReplyTemplate"("name");

-- CreateIndex
CREATE INDEX "ReplyTemplate_updatedAt_idx" ON "ReplyTemplate"("updatedAt");

-- CreateIndex
CREATE INDEX "FlexTemplate_name_idx" ON "FlexTemplate"("name");

-- CreateIndex
CREATE INDEX "FlexTemplate_updatedAt_idx" ON "FlexTemplate"("updatedAt");

-- CreateIndex
CREATE INDEX "ReplyRule_isActive_triggerType_priority_idx" ON "ReplyRule"("isActive", "triggerType", "priority" DESC);

-- CreateIndex
CREATE INDEX "ReplyRule_textTemplateId_idx" ON "ReplyRule"("textTemplateId");

-- CreateIndex
CREATE INDEX "ReplyRule_flexTemplateId_idx" ON "ReplyRule"("flexTemplateId");

-- CreateIndex
CREATE INDEX "ReplyKeyword_normalizedKeyword_idx" ON "ReplyKeyword"("normalizedKeyword");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyKeyword_ruleId_normalizedKeyword_key" ON "ReplyKeyword"("ruleId", "normalizedKeyword");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyLog_webhookEventId_key" ON "ReplyLog"("webhookEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyLog_retryKey_key" ON "ReplyLog"("retryKey");

-- CreateIndex
CREATE INDEX "ReplyLog_status_createdAt_idx" ON "ReplyLog"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReplyLog_createdAt_idx" ON "ReplyLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReplyLog_customerId_idx" ON "ReplyLog"("customerId");

-- CreateIndex
CREATE INDEX "ReplyLog_ruleId_idx" ON "ReplyLog"("ruleId");

-- CreateIndex
CREATE INDEX "ReplyLog_source_idx" ON "ReplyLog"("source");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_sha256_key" ON "MediaAsset"("sha256");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_lineAccountId_fkey" FOREIGN KEY ("lineAccountId") REFERENCES "LineAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_lineAccountId_fkey" FOREIGN KEY ("lineAccountId") REFERENCES "LineAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_lineAccountId_fkey" FOREIGN KEY ("lineAccountId") REFERENCES "LineAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyLogId_fkey" FOREIGN KEY ("replyLogId") REFERENCES "ReplyLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyTemplate" ADD CONSTRAINT "ReplyTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlexTemplate" ADD CONSTRAINT "FlexTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyRule" ADD CONSTRAINT "ReplyRule_textTemplateId_fkey" FOREIGN KEY ("textTemplateId") REFERENCES "ReplyTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyRule" ADD CONSTRAINT "ReplyRule_flexTemplateId_fkey" FOREIGN KEY ("flexTemplateId") REFERENCES "FlexTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyRule" ADD CONSTRAINT "ReplyRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyRule" ADD CONSTRAINT "ReplyRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyKeyword" ADD CONSTRAINT "ReplyKeyword_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReplyRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyLog" ADD CONSTRAINT "ReplyLog_lineAccountId_fkey" FOREIGN KEY ("lineAccountId") REFERENCES "LineAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyLog" ADD CONSTRAINT "ReplyLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyLog" ADD CONSTRAINT "ReplyLog_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyLog" ADD CONSTRAINT "ReplyLog_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyLog" ADD CONSTRAINT "ReplyLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReplyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyLog" ADD CONSTRAINT "ReplyLog_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
