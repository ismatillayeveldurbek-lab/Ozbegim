/**
 * Lug‘at yozuvlarini yaratish/yangilash — admin CRUD va import uchun umumiy mantiq.
 */
import { z } from "zod";
import type { Prisma } from "@generated/prisma/client";
import { normalizeKey } from "@/lib/uz/normalize";
import { HttpError } from "./http";

type Tx = Prisma.TransactionClient;

const str = (max: number) => z.string().trim().max(max);
const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const strList = (maxItems: number, maxLen: number) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems).default([]);

export const statusSchema = z.enum(["VERIFIED", "PENDING", "REJECTED"]);
export const originSchema = z.enum(["OFFICIAL", "COMMUNITY", "DEMO"]);

export const sourceInput = z
  .object({
    title: str(300).min(1),
    author: optStr(200),
    url: optStr(500).refine((v) => !v || /^https?:\/\//i.test(v), "Havola http(s):// bilan boshlanishi kerak"),
    year: z.number().int().min(800).max(2100).nullish(),
  })
  .nullish();

export const idiomInput = z.object({
  phrase: str(200).min(1, "Ibora bo‘sh bo‘lmasin"),
  status: statusSchema.default("PENDING"),
  origin: originSchema.default("OFFICIAL"),
  tags: strList(20, 50),
  source: sourceInput,
  senses: z
    .array(z.object({ meaning: str(2000).min(1, "Ma’no bo‘sh bo‘lmasin"), example: optStr(1000), synonyms: strList(20, 200) }))
    .min(1, "Kamida bitta ma’no kiriting")
    .max(20),
});
export type IdiomInput = z.infer<typeof idiomInput>;

export const loanwordInput = z.object({
  word: str(120).min(1, "So‘z bo‘sh bo‘lmasin"),
  meaning: optStr(2000),
  domain: optStr(120),
  originLanguage: optStr(120),
  spellingVariants: strList(20, 120),
  status: statusSchema.default("PENDING"),
  origin: originSchema.default("OFFICIAL"),
  tags: strList(20, 50),
  source: sourceInput,
  alternatives: z.array(z.object({ text: str(200).min(1), usageNote: optStr(500) })).max(30).default([]),
  examples: strList(30, 1000),
});
export type LoanwordInput = z.infer<typeof loanwordInput>;

export const lexemeInput = z.object({
  lemma: str(80).min(1),
  pos: z.enum(["ot", "sifat", "son", "olmosh", "fe’l", "ravish", "ko‘makchi", "bog‘lovchi", "yuklama", "undov", "modal", "taqlid"]),
  meaning: optStr(2000),
  examples: strList(20, 500),
  status: statusSchema.default("PENDING"),
  origin: originSchema.default("OFFICIAL"),
});
export type LexemeInput = z.infer<typeof lexemeInput>;

export const spellingInput = z.object({
  wrong: str(80).min(1),
  correct: str(80).min(1),
  note: optStr(500),
  status: statusSchema.default("PENDING"),
  origin: originSchema.default("OFFICIAL"),
});
export type SpellingInput = z.infer<typeof spellingInput>;

async function resolveSource(tx: Tx, source: IdiomInput["source"]) {
  if (!source) return null;
  const s = await tx.source.upsert({
    where: { title: source.title },
    create: { title: source.title, author: source.author, url: source.url, year: source.year ?? null },
    update: {},
  });
  return s.id;
}

export async function saveIdiom(tx: Tx, input: IdiomInput, id?: string) {
  const key = normalizeKey(input.phrase);
  if (!key) throw new HttpError(400, "Ibora bo‘sh bo‘lmasin.");
  const clash = await tx.idiom.findUnique({ where: { key } });
  if (clash && clash.id !== id) throw new HttpError(409, `“${input.phrase}” iborasi bazada allaqachon bor.`, "DUPLICATE");
  const sourceId = await resolveSource(tx, input.source);
  const data = { phrase: input.phrase, key, status: input.status, origin: input.origin, tags: input.tags, sourceId };
  const senses = input.senses.map((s, i) => ({ order: i, meaning: s.meaning, example: s.example, synonyms: s.synonyms }));
  if (id) {
    await tx.idiomSense.deleteMany({ where: { idiomId: id } });
    return tx.idiom.update({ where: { id }, data: { ...data, senses: { create: senses } } });
  }
  return tx.idiom.create({ data: { ...data, senses: { create: senses } } });
}

export async function saveLoanword(tx: Tx, input: LoanwordInput, id?: string) {
  const key = normalizeKey(input.word);
  if (!key) throw new HttpError(400, "So‘z bo‘sh bo‘lmasin.");
  const clash = await tx.loanword.findUnique({ where: { key } });
  if (clash && clash.id !== id) throw new HttpError(409, `“${input.word}” so‘zi bazada allaqachon bor.`, "DUPLICATE");
  const sourceId = await resolveSource(tx, input.source);
  const variantKeys = [...new Set(input.spellingVariants.map(normalizeKey))].filter((k) => k && k !== key);
  const data = {
    word: input.word,
    key,
    meaning: input.meaning,
    domain: input.domain,
    originLanguage: input.originLanguage,
    spellingVariants: input.spellingVariants,
    status: input.status,
    origin: input.origin,
    tags: input.tags,
    sourceId,
  };
  const nested = {
    alternatives: { create: input.alternatives.map((a, i) => ({ text: a.text, usageNote: a.usageNote, order: i })) },
    examples: { create: input.examples.map((t, i) => ({ text: t, order: i })) },
  };
  let saved;
  if (id) {
    await tx.loanwordAlternative.deleteMany({ where: { loanwordId: id } });
    await tx.loanwordExample.deleteMany({ where: { loanwordId: id } });
    await tx.loanwordKey.deleteMany({ where: { loanwordId: id } });
    saved = await tx.loanword.update({ where: { id }, data: { ...data, ...nested } });
  } else {
    saved = await tx.loanword.create({ data: { ...data, ...nested } });
  }
  // Muqobil yozilish kalitlari: boshqa so‘zga tegishli kalit tortib olinmaydi.
  for (const k of variantKeys) {
    const taken = await tx.loanwordKey.findUnique({ where: { key: k } });
    const isMainKey = await tx.loanword.findUnique({ where: { key: k } });
    if (!taken && !isMainKey) await tx.loanwordKey.create({ data: { key: k, loanwordId: saved.id } });
  }
  // Muhokama shu so‘zga bog‘lanadi.
  await tx.discussion.updateMany({ where: { kind: "LOANWORD", key, loanwordId: null }, data: { loanwordId: saved.id } });
  return saved;
}

export async function saveLexeme(tx: Tx, input: LexemeInput, id?: string) {
  const key = normalizeKey(input.lemma);
  const clash = await tx.lexeme.findUnique({ where: { key_pos: { key, pos: input.pos } } });
  if (clash && clash.id !== id) throw new HttpError(409, `“${input.lemma}” (${input.pos}) bazada allaqachon bor.`, "DUPLICATE");
  const data = { ...input, key };
  return id ? tx.lexeme.update({ where: { id }, data }) : tx.lexeme.create({ data });
}

export async function saveSpelling(tx: Tx, input: SpellingInput, id?: string) {
  const wrongKey = normalizeKey(input.wrong);
  const clash = await tx.spellingPair.findUnique({ where: { wrongKey } });
  if (clash && clash.id !== id) throw new HttpError(409, `“${input.wrong}” uchun juftlik allaqachon bor.`, "DUPLICATE");
  const data = { ...input, wrongKey };
  return id ? tx.spellingPair.update({ where: { id }, data }) : tx.spellingPair.create({ data });
}
