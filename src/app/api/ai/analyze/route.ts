import { z } from "zod";
import { aiJson } from "@/lib/server/ai";
import { toTypographic } from "@/lib/uz/alphabet";
import { handle, json, readJson, requireUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["parts", "note"],
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["words", "role", "question", "explanation"],
        properties: {
          words: { type: "string" },
          role: { type: "string", enum: ["ega", "kesim", "aniqlovchi", "to‘ldiruvchi", "hol", "undalma", "kirish so‘z", "boshqa"] },
          question: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
    note: { type: "string" },
  },
};

const SYSTEM = `Siz o‘zbek tili sintaksisi bo‘yicha mutaxassissiz. Berilgan gapni gap bo‘laklariga ajrating.
Gap bo‘lagini faqat kelishik qo‘shimchasiga yoki bitta so‘roqqa qarab emas, gapdagi ma’no va bog‘lanishga qarab aniqlang.
Har bir bo‘lak uchun so‘roq va qisqa izoh bering (o‘zbek tilida, lotin yozuvida). Noaniq holatni "note" maydonida ayting. Foiz yoki ishonch darajasini yozmang.`;

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req, z.object({ sentence: z.string().trim().min(2).max(500), consent: z.literal(true) }));
  await enforceRateLimit(`ai:${user.id}`, 20, 3600);
  const r = await aiJson<{ parts: Array<{ words: string; role: string; question: string; explanation: string }>; note: string }>(SYSTEM, body.sentence, SCHEMA);
  // "words" foydalanuvchi gapidan olingan — o‘zgartirilmaydi
  const parts = (r.parts ?? []).map((p) => ({ ...p, role: toTypographic(p.role ?? ""), question: toTypographic(p.question ?? ""), explanation: toTypographic(p.explanation ?? "") }));
  return json({ ...r, parts, note: toTypographic(r.note ?? ""), label: "Taxmin" });
});
