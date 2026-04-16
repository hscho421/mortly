-- CreateTable
CREATE TABLE "broker_request_seen" (
    "brokerId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_request_seen_pkey" PRIMARY KEY ("brokerId","requestId")
);

-- CreateIndex
CREATE INDEX "broker_request_seen_brokerId_idx" ON "broker_request_seen"("brokerId");

-- AddForeignKey
ALTER TABLE "broker_request_seen" ADD CONSTRAINT "broker_request_seen_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "brokers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_request_seen" ADD CONSTRAINT "broker_request_seen_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "borrower_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
