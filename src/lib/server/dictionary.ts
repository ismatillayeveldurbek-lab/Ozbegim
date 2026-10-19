/**
 * Lug‘at qidiruvi: iboralar va o‘zlashma so‘zlar.
 * Avval asosiy bazadan aniq moslik, keyin trigram (pg_trgm) asosidagi yaqin natijalar.
 */
import type { Prisma } from "@generated/prisma/client";
import { normalizeKey } from "@/lib/uz/normalize";
import { prisma } from "./db";

/** Talabda aynan shu matn ko‘rsatilishi kerak. */
export const LOANWORD_NOT_FOUND_MESSAGE =
  "Bu so‘z hozircha bazada mavjud emas. Ma’nosi yoki o‘zbekcha muqobilini bilsangiz, izoh qoldiring.";

const PUBLIC_STATUSES = ["VERIFIED", "PENDING"] as const;

export const idiomInclude = {
  senses: { orderBy: { order: "asc" } },
  source: { select: { title: true, author: true, url: true, year: true } },
} satisfies Prisma.IdiomInclude;

export const loanwordInclude = {
  alternatives: { orderBy: { order: "asc" } },
  examples: { orderBy: { order: "asc" } },
  source: { select: { title: true, author: true, url: true, year: true } },
} satisfies Prisma.LoanwordInclude;

export type IdiomWithSenses = Prisma.IdiomGetPayload<{ include: typeof idiomInclude }>;
export type LoanwordFull = Prisma.LoanwordGetPayload<{ include: typeof loanwordInclude }>;

async function recordSearch(kind: string, key: string, display: string, found: boolean) {
  if (!key || key.length > 80) return;
  await prisma.searchStat.upsert({
    where: { kind_key: { kind, key } },
    create: { kind, key, display: display.slice(0, 80), hits: found ? 1 : 0, misses: found ? 0 : 1 },
    update: { hits: { increment: found ? 1 : 0 }, misses: { increment: found ? 0 : 1 }, lastSearchedAt: new Date() },
  });
}

/** Trigram o‘xshashligi bo‘yicha yaqin kalitlar. */
async function nearKeys(table: "Idiom" | "Loanword" | "LoanwordKey", key: string, limit = 8): Promise<string[]> {
  const like = `%${key.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const rows =
    table === "Idiom"
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Idiom" WHERE "status" <> 'REJECTED' AND "key" <> ${key}
            AND ("key" % ${key} OR "key" LIKE ${like} OR ${key} LIKE '%' || "key" || '%')
          ORDER BY similarity("key", ${key}) DESC LIMIT ${limit}`
      : table === "Loanword"
        ? await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Loanword" WHERE "status" <> 'REJECTED' AND "key" <> ${key}
            AND ("key" % ${key} OR "key" LIKE ${like})
          ORDER BY similarity("key", ${key}) DESC LIMIT ${limit}`
        : await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "loanwordId" AS "id" FROM "LoanwordKey" WHERE "key" <> ${key} AND ("key" % ${key} OR "key" LIKE ${like})
          ORDER BY similarity("key", ${key}) DESC LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

export async function searchIdioms(query: string, opts: { record?: boolean } = {}) {
  const key = normalizeKey(query);
  if (!key) return { key, exact: [] as IdiomWithSenses[], near: [] as IdiomWithSenses[] };
  const exact = await prisma.idiom.findMany({
    where: { key, status: { in: [...PUBLIC_STATUSES] } },
    include: idiomInclude,
  });
  const nearIds = await nearKeys("Idiom", key);
  const near = nearIds.length
    ? await prisma.idiom.findMany({ where: { id: { in: nearIds }, status: { in: [...PUBLIC_STATUSES] } }, include: idiomInclude })
    : [];
  near.sort((a, b) => nearIds.indexOf(a.id) - nearIds.indexOf(b.id));
  if (opts.record) await recordSearch("idiom", key, query.trim(), exact.length > 0);
  return { key, exact, near };
}

export async function findLoanwordByKey(key: string) {
  const direct = await prisma.loanword.findFirst({
    where: { key, status: { in: [...PUBLIC_STATUSES] } },
    include: loanwordInclude,
  });
  if (direct) return direct;
  // Muqobil yozilish orqali (masalan, "kompyutor" → "kompyuter")
  const variant = await prisma.loanwordKey.findUnique({ where: { key } });
  if (!variant) return null;
  return prisma.loanword.findFirst({
    where: { id: variant.loanwordId, status: { in: [...PUBLIC_STATUSES] } },
    include: loanwordInclude,
  });
}

export async function searchLoanwords(query: string, opts: { record?: boolean } = {}) {
  const key = normalizeKey(query);
  if (!key) return { key, exact: null as LoanwordFull | null, near: [] as LoanwordFull[] };
  const exact = await findLoanwordByKey(key);
  // O‘zbekcha muqobil bo‘yicha teskari qidiruv ("taqdimot" → "prezentatsiya")
  const byAlternative = await prisma.loanwordAlternative.findMany({
    where: { text: { equals: query.trim(), mode: "insensitive" } },
    select: { loanwordId: true },
    take: 5,
  });
  const ids = [
    ...new Set([...byAlternative.map((a) => a.loanwordId), ...(await nearKeys("Loanword", key)), ...(await nearKeys("LoanwordKey", key))]),
  ].filter((id) => id !== exact?.id);
  const near = ids.length
    ? await prisma.loanword.findMany({ where: { id: { in: ids }, status: { in: [...PUBLIC_STATUSES] } }, include: loanwordInclude, take: 8 })
    : [];
  if (opts.record) await recordSearch("loanword", key, query.trim(), !!exact);
  return { key, exact, near };
}

/** Muhokamani topadi yoki yaratadi. Parallel so‘rovlar takroriy muhokama yaratmaydi (unique + qayta o‘qish). */
export async function getOrCreateDiscussion(kind: "LOANWORD" | "IDIOM", term: string) {
  const key = normalizeKey(term);
  const existing = await prisma.discussion.findUnique({ where: { kind_key: { kind, key } } });
  if (existing) return existing;
  const loanword = kind === "LOANWORD" ? await findLoanwordByKey(key) : null;
  try {
    return await prisma.discussion.create({
      data: { kind, key, displayTerm: term.trim().slice(0, 120), loanwordId: loanword?.id ?? null },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      const again = await prisma.discussion.findUnique({ where: { kind_key: { kind, key } } });
      if (again) return again;
    }
    throw e;
  }
}

/** Ommaga ko‘rinadigan izohlar (yashirilgan va rad etilganlar muallifning o‘ziga ko‘rinadi). */
export async function listComments(kind: "LOANWORD" | "IDIOM", term: string, viewerId?: string | null) {
  const key = normalizeKey(term);
  const discussion = await prisma.discussion.findUnique({ where: { kind_key: { kind, key } } });
  if (!discussion) return { discussion: null, comments: [] };
  const comments = await prisma.comment.findMany({
    where: {
      discussionId: discussion.id,
      OR: [{ status: { in: ["VISIBLE", "ACCEPTED"] } }, ...(viewerId ? [{ userId: viewerId }] : [])],
    },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    include: {
      user: { select: { name: true } },
      votes: viewerId ? { where: { userId: viewerId }, select: { value: true } } : false,
    },
    take: 200,
  });
  return {
    discussion: { id: discussion.id, key: discussion.key, displayTerm: discussion.displayTerm },
    comments: comments.map((c) => ({
      id: c.id,
      proposal: c.proposal,
      explanation: c.explanation,
      example: c.example,
      sourceUrl: c.sourceUrl,
      status: c.status,
      score: c.score,
      createdAt: c.createdAt.toISOString(),
      author: c.user.name,
      mine: viewerId ? c.userId === viewerId : false,
      myVote: (c as unknown as { votes?: Array<{ value: number }> }).votes?.[0]?.value ?? 0,
    })),
  };
}

export function serializeIdiom(i: IdiomWithSenses) {
  return {
    id: i.id,
    phrase: i.phrase,
    status: i.status,
    origin: i.origin,
    tags: i.tags,
    source: i.source,
    senses: i.senses.map((s) => ({ id: s.id, meaning: s.meaning, example: s.example, synonyms: s.synonyms })),
  };
}

export function serializeLoanword(l: LoanwordFull) {
  return {
    id: l.id,
    word: l.word,
    meaning: l.meaning,
    domain: l.domain,
    originLanguage: l.originLanguage,
    spellingVariants: l.spellingVariants,
    status: l.status,
    origin: l.origin,
    tags: l.tags,
    source: l.source,
    alternatives: l.alternatives.map((a) => ({ text: a.text, usageNote: a.usageNote })),
    examples: l.examples.map((e) => e.text),
  };
}
