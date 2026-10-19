import { z } from "zod";
import { aiJson } from "@/lib/server/ai";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

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

const SYSTEM = `Siz o‘zbek tili imlo muharririsiz. Faqat aniq imlo, yozilish va grammatik xatolarni ko‘rsating.
Qoidalar: matn mazmuni va uslubini o‘zgartirmang; ism-familiya, sheva so‘zlari va atamalarga tegmang; ishonchingiz komil bo‘lmasa tavsiya bermang.
"original" — matndan aynan ko‘chirilgan qisqa parcha (bir yoki bir necha so‘z), "replacement" — tuzatilgan varianti, "explanation" — o‘zbek tilida qisqa izoh.
Xato bo‘lmasa, bo‘sh ro‘yxat qaytaring.`;

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req, z.object({ text: z.string().min(1).max(8000, "AI tekshiruvi uchun matn 8000 belgidan oshmasin."), consent: z.literal(true) }));
  if (!body.consent) throw new HttpError(400, "Matnni tashqi xizmatga yuborishga rozilik berilmagan.");
  await enforceRateLimit(`ai:${user.id}`, 20, 3600);
  const r = await aiJson<{ suggestions: Array<{ original: string; replacement: string; explanation: string }> }>(SYSTEM, body.text, SCHEMA);
  // Matnda uchramaydigan "tavsiyalar" tashlab yuboriladi.
  const suggestions = r.suggestions.filter((s) => s.original && s.original !== s.replacement && body.text.includes(s.original)).slice(0, 100);
  return json({ suggestions, label: "AI taxmini" });
});
