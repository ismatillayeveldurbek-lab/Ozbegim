/**
 * Bazada yo‘q o‘zlashma so‘zlar uchun tashqi xizmatdan izoh: ma’nosi, kelib chiqishi, o‘zbekcha muqobillari va misol.
 * AiWordCache’da "ozlashma:" kaliti bilan 30 kun saqlanadi.
 */
import { z } from "zod";
import type { Prisma } from "@generated/prisma/client";
import { toTypographic } from "@/lib/uz/alphabet";
import { normalizeKey } from "@/lib/uz/normalize";
import { AI_MODEL, aiJson } from "./ai";
import { prisma } from "./db";
import { HttpError } from "./http";

export const LOANWORD_PROMPT = `Sen o‘zbek adabiy tili va leksikologiyasi bo‘yicha mutaxassissan. Berilgan so‘z o‘zbek tiliga boshqa tildan (rus, ingliz, arab, fors va h.k.) kirgan o‘zlashma so‘z bo‘lishi mumkin.
Faqat quyidagi JSON formatda javob ber:
{"soz": "...", "manosi": "...", "kelib_chiqishi": "...", "soha": "...", "muqobillar": [{"soz": "...", "qachon": "..."}], "misol": "...", "izoh": "..."}
Qoidalar:
- "soz" — so‘zning o‘zbek lotin yozuvidagi to‘g‘ri (me’yoriy) yozilishi.
- "manosi" — 1–2 gaplik aniq ma’no.
- "kelib_chiqishi" — qaysi tildan kirgani (masalan: "ingliz tili", "rus tili orqali lotin tilidan"); aniq bilmasang — "".
- "soha" — qo‘llanish sohasi (iqtisod, texnika, ish yuritish, kundalik nutq...) yoki "".
- "muqobillar" — o‘zbek tilida keng qo‘llanadigan, ma’nosi mos muqobil so‘zlar (ko‘pi bilan 4 ta); "qachon" — qaysi vaziyatda ishlatiladi (yoki ""). Muqobili yo‘q yoki o‘zlashma so‘zning o‘zi me’yor bo‘lsa — [] va buni "izoh"da ayt.
- "misol" — muqobil so‘z bilan tuzilgan bitta tabiiy gap.
- "izoh" — ixtiyoriy: yozilish variantlari, uslubiy belgi (so‘zlashuv, rasmiy) yoki "".
- Faqat aniq bilgan narsangni yoz, so‘z yoki muqobil to‘qib chiqarma. Barcha matn o‘zbek lotin yozuvida.
- Agar bu ma’nosiz harflar to‘plami yoki o‘zbek tilida mavjud bo‘lmagan so‘z bo‘lsa: {"xato": "Topilmadi"}.`;

export type LoanwordAiResult =
  | { found: true; soz: string; manosi: string; kelibChiqishi: string; soha: string; muqobillar: Array<{ soz: string; qachon: string }>; misol: string; izoh: string }
  | { found: false };

const s = (max: number) => z.string().trim().max(max).optional().default("");
const schema = z.object({
  soz: s(80),
  manosi: z.string().trim().min(1).max(1000),
  kelib_chiqishi: s(200),
  soha: s(120),
  muqobillar: z
    .array(z.union([z.object({ soz: z.string().trim().min(1).max(80), qachon: s(200) }), z.string().trim().min(1).max(80)]))
    .optional()
    .default([])
    .transform((v) => v.map((x) => (typeof x === "string" ? { soz: x, qachon: "" } : x)).slice(0, 4)),
  misol: s(500),
  izoh: s(500),
});

export function normalizeLoanwordAi(raw: unknown, word: string): LoanwordAiResult {
  if (raw && typeof raw === "object" && "xato" in raw && !("manosi" in raw)) return { found: false };
  const p = schema.safeParse(raw);
  if (!p.success) throw new HttpError(502, "Xizmat javobi kutilgan ko‘rinishda emas. Qayta urinib ko‘ring.", "AI_BAD_SHAPE");
  const t = toTypographic;
  return {
    found: true,
    soz: t(p.data.soz || word),
    manosi: t(p.data.manosi),
    kelibChiqishi: t(p.data.kelib_chiqishi),
    soha: t(p.data.soha),
    muqobillar: p.data.muqobillar.map((m) => ({ soz: t(m.soz), qachon: t(m.qachon) })),
    misol: t(p.data.misol),
    izoh: t(p.data.izoh),
  };
}

export function validateLoanword(input: unknown): string {
  const w = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  if (!w) throw new HttpError(400, "Iltimos, so‘z kiriting.", "EMPTY");
  if (w.length > 60 || w.split(" ").length > 3) throw new HttpError(400, "Bitta so‘z yoki qisqa birikma kiriting (60 belgigacha).", "TOO_LONG");
  if (!/^[\p{L}'`‘’ʻʼ\- ]+$/u.test(w)) throw new HttpError(400, "So‘z faqat harflardan iborat bo‘lsin.", "BAD_CHARS");
  return w;
}

const CACHE_DAYS = 30;
const PROMPT_VERSION = 1;
const cacheTag = () => `${AI_MODEL()}|v${PROMPT_VERSION}`;

export async function explainLoanwordAi(word: string, userId?: string | null): Promise<{ result: LoanwordAiResult; cached: boolean }> {
  const key = `ozlashma:${normalizeKey(word)}`;
  const hit = await prisma.aiWordCache.findUnique({ where: { key } });
  const { model: tag, ...cached } = (hit?.result ?? {}) as unknown as LoanwordAiResult & { model?: string };
  if (hit && tag === cacheTag() && hit.createdAt.getTime() > Date.now() - CACHE_DAYS * 86_400_000) return { result: cached as LoanwordAiResult, cached: true };
  const raw = await aiJson<unknown>(LOANWORD_PROMPT, word, undefined, { maxTokens: 3000, effort: "medium", usage: { feature: "loanword", userId } });
  const result = normalizeLoanwordAi(raw, word);
  if (result.found)
    await prisma.aiWordCache.upsert({
      where: { key },
      create: { key, word, result: { ...result, model: cacheTag() } as unknown as Prisma.InputJsonValue },
      update: { word, result: { ...result, model: cacheTag() } as unknown as Prisma.InputJsonValue, createdAt: new Date() },
    });
  return { result, cached: false };
}
