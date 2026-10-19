-- Yaqin natijalar uchun trigram qidiruvi
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('VERIFIED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "EntryOrigin" AS ENUM ('OFFICIAL', 'COMMUNITY', 'DEMO');

-- CreateEnum
CREATE TYPE "DiscussionKind" AS ENUM ('LOANWORD', 'IDIOM');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'REJECTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'OFFENSIVE', 'WRONG', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SavedKind" AS ENUM ('WORD', 'IDIOM', 'LOANWORD');

-- CreateEnum
CREATE TYPE "FileJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'NEEDS_REVIEW', 'DONE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'PREVIEWED', 'COMMITTED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "historyMode" TEXT NOT NULL DEFAULT 'off',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "AppRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "url" TEXT,
    "year" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idiom" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "EntryOrigin" NOT NULL DEFAULT 'OFFICIAL',
    "tags" TEXT[],
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idiom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdiomSense" (
    "id" TEXT NOT NULL,
    "idiomId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "meaning" TEXT NOT NULL,
    "example" TEXT,
    "synonyms" TEXT[],

    CONSTRAINT "IdiomSense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loanword" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "meaning" TEXT,
    "domain" TEXT,
    "originLanguage" TEXT,
    "spellingVariants" TEXT[],
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "EntryOrigin" NOT NULL DEFAULT 'OFFICIAL',
    "tags" TEXT[],
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loanword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanwordKey" (
    "key" TEXT NOT NULL,
    "loanwordId" TEXT NOT NULL,

    CONSTRAINT "LoanwordKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LoanwordAlternative" (
    "id" TEXT NOT NULL,
    "loanwordId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "usageNote" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LoanwordAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanwordExample" (
    "id" TEXT NOT NULL,
    "loanwordId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LoanwordExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lexeme" (
    "id" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "pos" TEXT NOT NULL,
    "meaning" TEXT,
    "examples" TEXT[],
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "EntryOrigin" NOT NULL DEFAULT 'OFFICIAL',
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lexeme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpellingPair" (
    "id" TEXT NOT NULL,
    "wrong" TEXT NOT NULL,
    "wrongKey" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "note" TEXT,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "EntryOrigin" NOT NULL DEFAULT 'OFFICIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpellingPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discussion" (
    "id" TEXT NOT NULL,
    "kind" "DiscussionKind" NOT NULL,
    "key" TEXT NOT NULL,
    "displayTerm" TEXT NOT NULL,
    "loanwordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discussion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proposal" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "example" TEXT,
    "sourceUrl" TEXT,
    "contentHash" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "score" INTEGER NOT NULL DEFAULT 0,
    "moderationNote" TEXT,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentVote" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentVote_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "decision" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SavedKind" NOT NULL,
    "term" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "meaning" TEXT,
    "note" TEXT,
    "ignoreInSpellcheck" BOOLEAN NOT NULL DEFAULT false,
    "refId" TEXT,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedItemTag" (
    "savedItemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "SavedItemTag_pkey" PRIMARY KEY ("savedItemId","tagId")
);

-- CreateTable
CREATE TABLE "ReviewState" (
    "savedItemId" TEXT NOT NULL,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewState_pkey" PRIMARY KEY ("savedItemId")
);

-- CreateTable
CREATE TABLE "ExerciseAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "itemRef" TEXT,
    "prompt" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "status" "FileJobStatus" NOT NULL DEFAULT 'QUEUED',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "inputKey" TEXT NOT NULL,
    "outputKey" TEXT,
    "outputName" TEXT,
    "outputMime" TEXT,
    "textKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "FileJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredObject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fileJobId" TEXT,
    "kind" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "sheets" JSONB NOT NULL,
    "sheetName" TEXT,
    "mapping" JSONB,
    "duplicateRule" TEXT,
    "preview" JSONB,
    "report" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchStat" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "misses" INTEGER NOT NULL DEFAULT 0,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "inputText" TEXT,
    "outputText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Source_title_key" ON "Source"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Idiom_key_key" ON "Idiom"("key");

-- CreateIndex
CREATE INDEX "Idiom_status_origin_idx" ON "Idiom"("status", "origin");

-- CreateIndex
CREATE INDEX "IdiomSense_idiomId_idx" ON "IdiomSense"("idiomId");

-- CreateIndex
CREATE UNIQUE INDEX "Loanword_key_key" ON "Loanword"("key");

-- CreateIndex
CREATE INDEX "Loanword_status_origin_idx" ON "Loanword"("status", "origin");

-- CreateIndex
CREATE INDEX "LoanwordKey_loanwordId_idx" ON "LoanwordKey"("loanwordId");

-- CreateIndex
CREATE INDEX "LoanwordAlternative_loanwordId_idx" ON "LoanwordAlternative"("loanwordId");

-- CreateIndex
CREATE INDEX "LoanwordExample_loanwordId_idx" ON "LoanwordExample"("loanwordId");

-- CreateIndex
CREATE INDEX "Lexeme_key_idx" ON "Lexeme"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Lexeme_key_pos_key" ON "Lexeme"("key", "pos");

-- CreateIndex
CREATE UNIQUE INDEX "SpellingPair_wrongKey_key" ON "SpellingPair"("wrongKey");

-- CreateIndex
CREATE UNIQUE INDEX "Discussion_loanwordId_key" ON "Discussion"("loanwordId");

-- CreateIndex
CREATE UNIQUE INDEX "Discussion_kind_key_key" ON "Discussion"("kind", "key");

-- CreateIndex
CREATE INDEX "Comment_discussionId_status_createdAt_idx" ON "Comment"("discussionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_userId_createdAt_idx" ON "Comment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_discussionId_userId_contentHash_key" ON "Comment"("discussionId", "userId", "contentHash");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_commentId_reporterId_key" ON "Report"("commentId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_userId_name_key" ON "Folder"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- CreateIndex
CREATE INDEX "SavedItem_userId_createdAt_idx" ON "SavedItem"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_kind_key_key" ON "SavedItem"("userId", "kind", "key");

-- CreateIndex
CREATE INDEX "ReviewState_dueAt_idx" ON "ReviewState"("dueAt");

-- CreateIndex
CREATE INDEX "ExerciseAttempt_userId_createdAt_idx" ON "ExerciseAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExerciseAttempt_userId_type_isCorrect_idx" ON "ExerciseAttempt"("userId", "type", "isCorrect");

-- CreateIndex
CREATE INDEX "FileJob_status_createdAt_idx" ON "FileJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FileJob_userId_createdAt_idx" ON "FileJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FileJob_expiresAt_idx" ON "FileJob"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredObject_key_key" ON "StoredObject"("key");

-- CreateIndex
CREATE INDEX "StoredObject_expiresAt_deletedAt_idx" ON "StoredObject"("expiresAt", "deletedAt");

-- CreateIndex
CREATE INDEX "ImportJob_actorId_createdAt_idx" ON "ImportJob"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchStat_kind_misses_idx" ON "SearchStat"("kind", "misses");

-- CreateIndex
CREATE INDEX "SearchStat_kind_hits_idx" ON "SearchStat"("kind", "hits");

-- CreateIndex
CREATE UNIQUE INDEX "SearchStat_kind_key_key" ON "SearchStat"("kind", "key");

-- CreateIndex
CREATE INDEX "HistoryEntry_userId_createdAt_idx" ON "HistoryEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idiom" ADD CONSTRAINT "Idiom_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdiomSense" ADD CONSTRAINT "IdiomSense_idiomId_fkey" FOREIGN KEY ("idiomId") REFERENCES "Idiom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loanword" ADD CONSTRAINT "Loanword_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanwordKey" ADD CONSTRAINT "LoanwordKey_loanwordId_fkey" FOREIGN KEY ("loanwordId") REFERENCES "Loanword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanwordAlternative" ADD CONSTRAINT "LoanwordAlternative_loanwordId_fkey" FOREIGN KEY ("loanwordId") REFERENCES "Loanword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanwordExample" ADD CONSTRAINT "LoanwordExample_loanwordId_fkey" FOREIGN KEY ("loanwordId") REFERENCES "Loanword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lexeme" ADD CONSTRAINT "Lexeme_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_loanwordId_fkey" FOREIGN KEY ("loanwordId") REFERENCES "Loanword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentVote" ADD CONSTRAINT "CommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentVote" ADD CONSTRAINT "CommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItemTag" ADD CONSTRAINT "SavedItemTag_savedItemId_fkey" FOREIGN KEY ("savedItemId") REFERENCES "SavedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItemTag" ADD CONSTRAINT "SavedItemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewState" ADD CONSTRAINT "ReviewState_savedItemId_fkey" FOREIGN KEY ("savedItemId") REFERENCES "SavedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAttempt" ADD CONSTRAINT "ExerciseAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileJob" ADD CONSTRAINT "FileJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredObject" ADD CONSTRAINT "StoredObject_fileJobId_fkey" FOREIGN KEY ("fileJobId") REFERENCES "FileJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEntry" ADD CONSTRAINT "HistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trigram indekslar (yaqin natijalar)
CREATE INDEX "Idiom_key_trgm_idx" ON "Idiom" USING GIN ("key" gin_trgm_ops);
CREATE INDEX "Loanword_key_trgm_idx" ON "Loanword" USING GIN ("key" gin_trgm_ops);
CREATE INDEX "LoanwordKey_key_trgm_idx" ON "LoanwordKey" USING GIN ("key" gin_trgm_ops);
CREATE INDEX "Lexeme_key_trgm_idx" ON "Lexeme" USING GIN ("key" gin_trgm_ops);

-- Ovoz qiymati faqat -1 yoki 1
ALTER TABLE "CommentVote" ADD CONSTRAINT "CommentVote_value_check" CHECK ("value" IN (-1, 1));
-- Rol va tarix rejimi qiymatlari
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("role" IN ('user', 'moderator', 'admin'));
ALTER TABLE "user" ADD CONSTRAINT "user_historyMode_check" CHECK ("historyMode" IN ('off', 'meta', 'full'));
