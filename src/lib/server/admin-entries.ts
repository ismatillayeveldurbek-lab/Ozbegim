import type { Prisma } from "@generated/prisma/client";
import { z } from "zod";
import { normalizeKey } from "@/lib/uz/normalize";
import { prisma } from "./db";
import {
  idiomInput,
  lexemeInput,
  loanwordInput,
  saveIdiom,
  saveLexeme,
  saveLoanword,
  saveSpelling,
  spellingInput,
} from "./entries";
import { HttpError } from "./http";

export const ENTRY_TYPES = ["idiom", "loanword", "lexeme", "spelling"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export function parseType(t: string): EntryType {
  if (!(ENTRY_TYPES as readonly string[]).includes(t)) throw new HttpError(404, "Noma’lum bo‘lim.");
  return t as EntryType;
}

export const listQuery = z.object({
  q: z.string().max(120).optional(),
  status: z.enum(["VERIFIED", "PENDING", "REJECTED"]).optional(),
  origin: z.enum(["OFFICIAL", "COMMUNITY", "DEMO"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

const PAGE = 25;

export async function listEntries(type: EntryType, query: z.infer<typeof listQuery>) {
  const key = query.q ? normalizeKey(query.q) : undefined;
  const common = { status: query.status, origin: query.origin };
  const skip = (query.page - 1) * PAGE;
  switch (type) {
    case "idiom": {
      const where: Prisma.IdiomWhereInput = { ...common, ...(key ? { key: { contains: key } } : {}) };
      const [items, total] = await Promise.all([
        prisma.idiom.findMany({ where, include: { senses: { orderBy: { order: "asc" } }, source: true }, orderBy: { updatedAt: "desc" }, skip, take: PAGE }),
        prisma.idiom.count({ where }),
      ]);
      return { items, total, pageSize: PAGE };
    }
    case "loanword": {
      const where: Prisma.LoanwordWhereInput = { ...common, ...(key ? { key: { contains: key } } : {}) };
      const [items, total] = await Promise.all([
        prisma.loanword.findMany({
          where,
          include: { alternatives: { orderBy: { order: "asc" } }, examples: { orderBy: { order: "asc" } }, source: true },
          orderBy: { updatedAt: "desc" },
          skip,
          take: PAGE,
        }),
        prisma.loanword.count({ where }),
      ]);
      return { items, total, pageSize: PAGE };
    }
    case "lexeme": {
      const where: Prisma.LexemeWhereInput = { ...common, ...(key ? { key: { contains: key } } : {}) };
      const [items, total] = await Promise.all([
        prisma.lexeme.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take: PAGE }),
        prisma.lexeme.count({ where }),
      ]);
      return { items, total, pageSize: PAGE };
    }
    case "spelling": {
      const where: Prisma.SpellingPairWhereInput = { ...common, ...(key ? { wrongKey: { contains: key } } : {}) };
      const [items, total] = await Promise.all([
        prisma.spellingPair.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE }),
        prisma.spellingPair.count({ where }),
      ]);
      return { items, total, pageSize: PAGE };
    }
  }
}

export const INPUT_SCHEMAS = { idiom: idiomInput, loanword: loanwordInput, lexeme: lexemeInput, spelling: spellingInput } as const;

export async function saveEntry(tx: Prisma.TransactionClient, type: EntryType, body: unknown, id?: string) {
  switch (type) {
    case "idiom":
      return saveIdiom(tx, idiomInput.parse(body), id);
    case "loanword":
      return saveLoanword(tx, loanwordInput.parse(body), id);
    case "lexeme":
      return saveLexeme(tx, lexemeInput.parse(body), id);
    case "spelling":
      return saveSpelling(tx, spellingInput.parse(body), id);
  }
}

export async function deleteEntry(type: EntryType, id: string) {
  const del = {
    idiom: () => prisma.idiom.delete({ where: { id } }),
    loanword: () => prisma.loanword.delete({ where: { id } }),
    lexeme: () => prisma.lexeme.delete({ where: { id } }),
    spelling: () => prisma.spellingPair.delete({ where: { id } }),
  }[type];
  try {
    return await del();
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") throw new HttpError(404, "Yozuv topilmadi.");
    throw e;
  }
}
