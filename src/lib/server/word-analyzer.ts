/**
 * "So‘z tahlilchisi": so‘z ma’nosi, sinonim/antonimlar, misol va turkum — AI orqali.
 * Natija "AI taxmini" sifatida ko‘rsatiladi (tasdiqlangan lug‘at ma’lumoti emas) va
 * takroriy so‘rovlar uchun bazada keshlanadi.
 */
import { z } from "zod";
import type { Prisma } from "@generated/prisma/client";
import { toTypographic } from "@/lib/uz/alphabet";
import { normalizeKey } from "@/lib/uz/normalize";
import { aiJson } from "./ai";
import { prisma } from "./db";
import { HttpError } from "./http";

export const WORD_ANALYZER_PROMPT = `Sen o'zbek tili mutaxassisisan. Berilgan so'zni tahlil qil va faqat quyidagi JSON formatda javob ber, boshqa hech narsa yozma:
{"manosi": "...", "sinonimlar": ["..."], "antonimlar": ["..."], "misol": "...", "turkum": "..."}
Agar so'z mavjud bo'lmasa yoki tushunarsiz bo'lsa: {"xato": "So'z topilmadi"}`;

export type WordAnalysis =
  | { found: true; manosi: string; sinonimlar: string[]; antonimlar: string[]; misollar: string[]; turkum: string }
  | { found: false; xato: string };

const str = z.string().trim().min(1).max(1000);
const list = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((v) => (Array.isArray(v) ? v : v ? v.split(/[,;]/) : []))
  .transform((v) => [...new Set(v.map((x) => x.trim()).filter((x) => x && x.length <= 80))]);

const okSchema = z.object({
  manosi: str,
  sinonimlar: list,
  antonimlar: list,
  misol: z.union([z.string(), z.array(z.string())]).optional(),
  turkum: z.string().trim().max(60).optional(),
});

/** Kiritilgan so‘zni tekshirish: 1–60 belgi, faqat harf, apostrof, chiziqcha va bo‘shliq (3 so‘zgacha). */
export function validateWord(input: unknown): string {
  const w = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  if (!w) throw new HttpError(400, "Iltimos, so‘z kiriting.", "EMPTY");
  if (w.length > 60 || w.split(" ").length > 3) throw new HttpError(400, "Bitta so‘z yoki qisqa birikma kiriting (60 belgigacha).", "TOO_LONG");
  if (!/^[\p{L}'`‘’ʻʼ\- ]+$/u.test(w)) throw new HttpError(400, "So‘z faqat harflardan iborat bo‘lsin (raqam va belgilarsiz).", "BAD_CHARS");
  return w;
}

/** AI javobini tekshirib, interfeys uchun normallashtiradi. Noto‘g‘ri tuzilma — xato. */
export function normalizeWordAnalysis(raw: unknown): WordAnalysis {
  if (raw && typeof raw === "object" && "xato" in raw && !("manosi" in raw)) {
    return { found: false, xato: "So‘z topilmadi. Yozilishini tekshirib, qayta urinib ko‘ring." };
  }
  const p = okSchema.safeParse(raw);
  if (!p.success) throw new HttpError(502, "Xizmat javobi kutilgan ko‘rinishda emas. Qayta urinib ko‘ring.", "AI_BAD_SHAPE");
  const misol = p.data.misol;
  const misollar = (Array.isArray(misol) ? misol : misol ? [misol] : []).map((m) => m.trim()).filter(Boolean).slice(0, 2);
  return typographicAnalysis({
    found: true,
    manosi: p.data.manosi,
    sinonimlar: p.data.sinonimlar.slice(0, 6),
    antonimlar: p.data.antonimlar.slice(0, 6),
    misollar,
    turkum: p.data.turkum || "aniqlanmadi",
  });
}

/** Javobdagi o'/g' va tutuqni saytdagi tipografik ko‘rinishga keltiradi (keshdagi eski yozuvlar uchun ham). */
function typographicAnalysis(r: WordAnalysis): WordAnalysis {
  if (!r.found) return r;
  return {
    ...r,
    manosi: toTypographic(r.manosi),
    sinonimlar: r.sinonimlar.map(toTypographic),
    antonimlar: r.antonimlar.map(toTypographic),
    misollar: r.misollar.map(toTypographic),
    turkum: toTypographic(r.turkum),
  };
}

const CACHE_DAYS = 30;

export async function analyzeWordAi(word: string): Promise<{ result: WordAnalysis; cached: boolean }> {
  const key = normalizeKey(word);
  const hit = await prisma.aiWordCache.findUnique({ where: { key } });
  if (hit && hit.createdAt.getTime() > Date.now() - CACHE_DAYS * 86_400_000) return { result: typographicAnalysis(hit.result as unknown as WordAnalysis), cached: true };
  const raw = await aiJson<unknown>(WORD_ANALYZER_PROMPT, word, undefined, { maxTokens: 2000 });
  const result = normalizeWordAnalysis(raw);
  // Faqat topilgan so‘zlar keshlanadi (topilmaganlar keyinroq qayta urinib ko‘rilishi mumkin).
  if (result.found)
    await prisma.aiWordCache.upsert({
      where: { key },
      create: { key, word, result: result as unknown as Prisma.InputJsonValue },
      update: { word, result: result as unknown as Prisma.InputJsonValue, createdAt: new Date() },
    });
  return { result, cached: false };
}
