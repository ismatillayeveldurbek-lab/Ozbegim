import { createHash } from "node:crypto";
import { z } from "zod";
import { normalizeKey } from "@/lib/uz/normalize";
import { prisma } from "./db";
import { HttpError } from "./http";

const httpUrl = z
  .string()
  .trim()
  .max(500, "Havola juda uzun")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Havola http:// yoki https:// bilan boshlanishi kerak");

export const commentSchema = z.object({
  kind: z.enum(["LOANWORD", "IDIOM"]),
  term: z.string().trim().min(1, "So‘z kiritilmagan").max(120, "So‘z juda uzun"),
  proposal: z.string().trim().min(1, "Taklif etilayotgan muqobil yoki ma’noni yozing").max(200, "Taklif juda uzun (200 belgigacha)"),
  explanation: z.string().trim().min(10, "Tushuntirish kamida 10 belgidan iborat bo‘lsin").max(2000, "Tushuntirish juda uzun"),
  example: z.string().trim().max(500, "Misol juda uzun").optional().or(z.literal("")),
  sourceUrl: httpUrl.optional().or(z.literal("")),
  /** Spam botlar uchun yashirin maydon — bo‘sh bo‘lishi shart. */
  website: z.string().max(0).optional().or(z.literal("")),
});

/** Spamga qarshi tekshiruvlar: havolalar soni, takroriy belgilar. */
export function assertNotSpam(text: string) {
  const links = (text.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links > 1) throw new HttpError(400, "Izoh matnida havolalar juda ko‘p. Manba havolasini alohida maydonga yozing.", "SPAM");
  if (/(.)\1{14,}/u.test(text)) throw new HttpError(400, "Izohda bir xil belgilar ketma-ket juda ko‘p takrorlangan.", "SPAM");
}

export function contentHash(proposal: string, explanation: string) {
  return createHash("sha256").update(normalizeKey(proposal) + "\n" + explanation.trim().toLowerCase()).digest("hex");
}

/** Ochiq shikoyatlar shu songa yetsa, izoh moderator ko‘rguncha vaqtincha yashiriladi. */
export const AUTO_HIDE_REPORTS = 3;

export async function recomputeScore(commentId: string) {
  const agg = await prisma.commentVote.aggregate({ where: { commentId }, _sum: { value: true } });
  await prisma.comment.update({ where: { id: commentId }, data: { score: agg._sum.value ?? 0 } });
  return agg._sum.value ?? 0;
}
