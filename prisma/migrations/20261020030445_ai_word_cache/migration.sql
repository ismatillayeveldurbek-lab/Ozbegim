-- DropIndex
DROP INDEX "Idiom_key_trgm_idx";

-- DropIndex
DROP INDEX "Lexeme_key_trgm_idx";

-- DropIndex
DROP INDEX "Loanword_key_trgm_idx";

-- DropIndex
DROP INDEX "LoanwordKey_key_trgm_idx";

-- CreateTable
CREATE TABLE "AiWordCache" (
    "key" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiWordCache_pkey" PRIMARY KEY ("key")
);
