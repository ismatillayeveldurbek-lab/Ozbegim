import { z } from "zod";
import { aiJson } from "@/lib/server/ai";
import { toTypographic } from "@/lib/uz/alphabet";
import { assertSameOrigin, clientIp, handle, json, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/session";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "replacement", "explanation"],
        properties: { original: { type: "string" }, replacement: { type: "string" }, explanation: { type: "string" } },
      },
    },
  },
};

const SYSTEM = `Siz o‘zbek tili (lotin yozuvi) bo‘yicha tajribali imlo muharririsiz. Matndagi BARCHA imlo xatolarini toping:
noto‘g‘ri yozilgan so‘zlar (texnalogiya → texnologiya, kere → kerak, qobilyat → qobiliyat), o‘/g‘ va tutuq belgisi tushib qolishi yoki
noto‘g‘ri harf (uqish → o‘qish), qo‘shib, ajratib yoki chiziqcha bilan yozish (dunyo qarash → dunyoqarash, ilm fan → ilm-fan),
qo‘shimchalar va so‘z shakllaridagi grammatik xatolar.
Qoidalar: matn mazmuni va uslubini o‘zgartirmang; ism-familiya, joy nomlari, atamalar va to‘g‘ri yozilgan so‘zlarga tegmang;
apostrof turini (' yoki ‘) o‘zgartirishni tavsiya qilmang.
"original" — matndan HARFMA-HARF aynan ko‘chirilgan qisqa parcha (xatoli so‘z yoki so‘z birikmasi), "replacement" — uning to‘g‘ri yozilishi
(matndagi apostrof uslubida), "explanation" — o‘zbek tilida 1 gaplik izoh. Xato bo‘lmasa, bo‘sh ro‘yxat qaytaring.`;

/** Chuqur imlo tekshiruvi. Kirish majburiy emas; xarajatni cheklash uchun rate limit. Matn saqlanmaydi va loglarga yozilmaydi. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, z.object({ text: z.string().min(1).max(8000, "Chuqur tekshiruv uchun matn 8000 belgidan oshmasin.") }), 40_000);
  const user = await getCurrentUser(req.headers);
  if (user) await enforceRateLimit(`imlo:user:${user.id}`, 120, 3600);
  else await enforceRateLimit(`imlo:ip:${clientIp(req)}`, 40, 3600);
  const r = await aiJson<{ suggestions: Array<{ original: string; replacement: string; explanation: string }> }>(SYSTEM, body.text, SCHEMA, {
    effort: "medium",
    usage: { feature: "spelling", userId: user?.id ?? null },
  });
  // Matnda uchramaydigan yoki hech narsani o‘zgartirmaydigan tavsiyalar tashlab yuboriladi; "original" aynan qoladi.
  const seen = new Set<string>();
  const suggestions = (r.suggestions ?? [])
    .filter((s) => s.original && s.original !== s.replacement && body.text.includes(s.original) && !seen.has(s.original) && seen.add(s.original))
    .slice(0, 100)
    .map((s) => ({ original: s.original, replacement: toTypographic(s.replacement), explanation: toTypographic(s.explanation ?? "") }));
  return json({ suggestions });
});
