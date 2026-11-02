/**
 * Bazada yo‘q iboralar uchun tashqi xizmatdan taxminiy izoh. Natija "Taxmin" sifatida ko‘rsatiladi
 * (tasdiqlangan lug‘at ma’lumoti emas) va AiWordCache’da "ibora:" kaliti bilan 30 kun saqlanadi.
 */
import { z } from "zod";
import type { Prisma } from "@generated/prisma/client";
import { toTypographic } from "@/lib/uz/alphabet";
import { normalizeKey } from "@/lib/uz/normalize";
import { AI_MODEL, aiJson } from "./ai";
import { prisma } from "./db";
import { HttpError } from "./http";

export const IDIOM_PROMPT = `Sen o'zbek tili frazeologiyasi bo'yicha mutaxassissan. Berilgan ibora (frazeologizm, turg'un birikma yoki maqol) ma'nosini tushuntir va faqat quyidagi JSON formatda javob ber:
{"manosi": "...", "misol": "...", "manodoshlar": ["..."], "izoh": "..."}
Qoidalar:
- "manosi" — iboraning ko'chma (frazeologik) ma'nosi, so'zma-so'z emas; 1–2 gap.
- "misol" — iborani to'g'ri qo'llagan bitta tabiiy gap.
- "manodoshlar" — ma'nosi yaqin, o'zbek tilida keng ma'lum va lug'atlarda uchraydigan iboralar (ko'pi bilan 3 ta). Faqat aniq bilganingni yoz; o'zing yasagan yoki shubhali birikmalarni yozma. Ishonchsiz bo'lsang — [].
- "izoh" — ixtiyoriy: qo'llanish doirasi (so'zlashuv, kitobiy) yoki iboraning boshqa shakli; bo'lmasa — "".
- Ibora fe'l shaklida (bo'lmoq, qilmoq) yoki tuslangan holda (bo'ldi, qildi) berilishi mumkin — asosiy shaklini tushuntir.
- Barcha matn o'zbek lotin yozuvida.
- Agar bu o'zbek tilida ma'lum ibora bo'lmasa yoki ma'nosini aniq bilmasang: {"xato": "Ibora topilmadi"}. Ma'no to'qib chiqarma.`;

export type IdiomAiResult =
  | { found: true; manosi: string; misol: string; manodoshlar: string[]; izoh: string }
  | { found: false };

const schema = z.object({
  manosi: z.string().trim().min(1).max(1000),
  misol: z.string().trim().max(500).optional().default(""),
  manodoshlar: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? v.split(/[,;]/) : []).map((x) => x.trim()).filter((x) => x && x.length <= 120).slice(0, 3)),
  izoh: z.string().trim().max(500).optional().default(""),
});

export function normalizeIdiomAi(raw: unknown): IdiomAiResult {
  if (raw && typeof raw === "object" && "xato" in raw && !("manosi" in raw)) return { found: false };
  const p = schema.safeParse(raw);
  if (!p.success) throw new HttpError(502, "Xizmat javobi kutilgan ko‘rinishda emas. Qayta urinib ko‘ring.", "AI_BAD_SHAPE");
  return {
    found: true,
    manosi: toTypographic(p.data.manosi),
    misol: toTypographic(p.data.misol),
    manodoshlar: p.data.manodoshlar.map(toTypographic),
    izoh: toTypographic(p.data.izoh),
  };
}

const CACHE_DAYS = 30;
/** Ko‘rsatma o‘zgarsa oshiriladi — eski kesh yozuvlari qayta so‘raladi */
const PROMPT_VERSION = 2;
const cacheTag = () => `${AI_MODEL()}|v${PROMPT_VERSION}`;

export function validatePhrase(input: unknown): string {
  const s = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  if (!s) throw new HttpError(400, "Iltimos, ibora kiriting.", "EMPTY");
  if (s.length > 120 || s.split(" ").length > 10) throw new HttpError(400, "Ibora 120 belgidan (10 so‘zdan) oshmasin.", "TOO_LONG");
  if (!/^[\p{L}'`‘’ʻʼ\-,.!? ]+$/u.test(s)) throw new HttpError(400, "Ibora faqat harflardan iborat bo‘lsin.", "BAD_CHARS");
  return s;
}

export async function explainIdiomAi(phrase: string, userId?: string | null): Promise<{ result: IdiomAiResult; cached: boolean }> {
  const key = `ibora:${normalizeKey(phrase)}`;
  const hit = await prisma.aiWordCache.findUnique({ where: { key } });
  const { model: cachedModel, ...cached } = (hit?.result ?? {}) as IdiomAiResult & { model?: string };
  if (hit && cachedModel === cacheTag() && hit.createdAt.getTime() > Date.now() - CACHE_DAYS * 86_400_000) return { result: cached as IdiomAiResult, cached: true };
  const raw = await aiJson<unknown>(IDIOM_PROMPT, phrase, undefined, { maxTokens: 2000, effort: "medium", usage: { feature: "idiom", userId } });
  const result = normalizeIdiomAi(raw);
  if (result.found)
    await prisma.aiWordCache.upsert({
      where: { key },
      create: { key, word: phrase, result: { ...result, model: cacheTag() } as unknown as Prisma.InputJsonValue },
      update: { word: phrase, result: { ...result, model: cacheTag() } as unknown as Prisma.InputJsonValue, createdAt: new Date() },
    });
  return { result, cached: false };
}
