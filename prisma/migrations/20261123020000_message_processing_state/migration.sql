CREATE TYPE "MessageProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

ALTER TABLE "Message"
ADD COLUMN "processingStatus" "MessageProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN "processingStartedAt" TIMESTAMP(3);

UPDATE "Message"
SET "processingStatus" = 'PROCESSED'
WHERE "direction" <> 'INBOUND';
