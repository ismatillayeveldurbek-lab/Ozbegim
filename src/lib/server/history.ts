import type { Prisma } from "@generated/prisma/client";
import { prisma } from "./db";
import type { CurrentUser } from "./session";

/**
 * Ish tarixini faqat foydalanuvchi rozilik bergan bo‘lsa yozadi.
 * "meta" rejimida matnlar saqlanmaydi, faqat metama’lumot.
 */
export async function recordHistory(
  user: CurrentUser,
  entry: { type: "convert" | "spellcheck" | "file" | "saved"; summary: string; meta?: Record<string, unknown>; inputText?: string; outputText?: string },
) {
  if (user.historyMode === "off") return null;
  const full = user.historyMode === "full";
  return prisma.historyEntry.create({
    data: {
      userId: user.id,
      type: entry.type,
      summary: entry.summary.slice(0, 300),
      meta: (entry.meta ?? {}) as Prisma.InputJsonValue,
      inputText: full ? entry.inputText?.slice(0, 200_000) : null,
      outputText: full ? entry.outputText?.slice(0, 200_000) : null,
    },
  });
}
