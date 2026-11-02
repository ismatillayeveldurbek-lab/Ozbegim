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
        required: ["original", "replacement", "type", "explanation"],
        properties: {
          original: { type: "string" },
          replacement: { type: "string" },
          type: { type: "string", enum: ["imlo", "grammatika", "tinish", "qoshib_yozish", "ajratib_yozish", "chiziqcha", "katta_harf"] },
          explanation: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `Siz o‘zbek tili (lotin yozuvi) bo‘yicha tajribali imlo muharririsiz. Matndagi BARCHA imlo xatolarini toping:
noto‘g‘ri yozilgan so‘zlar (texnalogiya → texnologiya, kere → kerak, qobilyat → qobiliyat), o‘/g‘ va tutuq belgisi tushib qolishi yoki
noto‘g‘ri harf (uqish → o‘qish), qo‘shib, ajratib yoki chiziqcha bilan yozish (dunyo qarash → dunyoqarash, ilm fan → ilm-fan),
qo‘shimchalar va so‘z shakllaridagi grammatik xatolar (kelishik, egalik, shaxs-son moslashuvi, noto‘g‘ri qo‘shimcha), katta-kichik harf.
Har bir tavsiyaga "type" bering: imlo, grammatika, tinish, qoshib_yozish, ajratib_yozish, chiziqcha yoki katta_harf.
Qoidalar: matn mazmuni va uslubini o‘zgartirmang; ism-familiya, joy nomlari, atamalar va to‘g‘ri yozilgan so‘zlarga tegmang;
apostrof turini (' yoki ‘) o‘zgartirishni tavsiya qilmang; bir xatoni bir marta ko‘rsating.
"original" — matndan HARFMA-HARF aynan ko‘chirilgan qisqa parcha (xatoli so‘z yoki so‘z birikmasi), "replacement" — uning to‘g‘ri yozilishi
(matndagi apostrof uslubida), "explanation" — o‘zbek tilida 1 gaplik izoh, iloji bo‘lsa imlo qoidasi bilan. Xato bo‘lmasa, bo‘sh ro‘yxat qaytaring.`;
const PUNCT_ON = `\nTinish belgilarini ham tekshiring: vergul (uyushiq bo‘laklar, kirish so‘z, undalma, qo‘shma gap qismlari, "lekin/ammo/chunki" oldidan), nuqta, so‘roq va undov belgilari, tire. Tinish tavsiyasida "original" — belgi qo‘yiladigan joydagi 1–3 so‘z, "replacement" — belgi qo‘yilgan holi.`;
const PUNCT_OFF = `\nTinish belgilari (vergul, nuqta, tire) bo‘yicha tavsiya bermang.`;

type Item = { original: string; replacement: string; type: string; explanation: string };

/** Uzun matn gap chegarasida ~3000 belgilik bo‘laklarga ajratiladi va parallel tekshiriladi. */
function chunks(text: string, size = 3000): string[] {
  const out: string[] = [];
  let cur = "";
  for (const part of text.match(/[^.!?…\n]+[.!?…]*\s*|\n+/g) ?? [text]) {
    if (cur && cur.length + part.length > size) {
      out.push(cur);
      cur = "";
    }
    cur += part;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Chuqur imlo tekshiruvi. Kirish majburiy emas; xarajatni cheklash uchun rate limit. Matn saqlanmaydi va loglarga yozilmaydi. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, z.object({ text: z.string().min(1).max(20_000, "Chuqur tekshiruv uchun matn 20 000 belgidan oshmasin."), punctuation: z.boolean().optional() }), 100_000);
  const user = await getCurrentUser(req.headers);
  if (user) await enforceRateLimit(`imlo:user:${user.id}`, 120, 3600);
  else await enforceRateLimit(`imlo:ip:${clientIp(req)}`, 40, 3600);
  const system = SYSTEM + (body.punctuation ? PUNCT_ON : PUNCT_OFF);
  const parts = await Promise.all(
    chunks(body.text).map((c) =>
      aiJson<{ suggestions: Item[] }>(system, c, SCHEMA, { maxTokens: 16000, effort: "high", usage: { feature: "spelling", userId: user?.id ?? null } }),
    ),
  );
  const r = { suggestions: parts.flatMap((p) => p.suggestions ?? []) };
  // Matnda uchramaydigan yoki hech narsani o‘zgartirmaydigan tavsiyalar tashlab yuboriladi; "original" aynan qoladi.
  const seen = new Set<string>();
  const suggestions = (r.suggestions ?? [])
    .filter((s) => s.original && s.original !== s.replacement && body.text.includes(s.original) && !seen.has(s.original) && seen.add(s.original))
    .slice(0, 200)
    .map((s) => ({ original: s.original, replacement: toTypographic(s.replacement), type: s.type, explanation: toTypographic(s.explanation ?? "") }));
  return json({ suggestions });
});
