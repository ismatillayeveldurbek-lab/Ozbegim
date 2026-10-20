-- CreateTable
CREATE TABLE "AiWordCache" (
    "key" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiWordCache_pkey" PRIMARY KEY ("key")
);
