/**
 * Claude API orqali AI tavsiyalari (ixtiyoriy). Kalit faqat serverda (ANTHROPIC_API_KEY).
 * Ulanmagan bo‘lsa — xato qaytariladi, hech qanday natija to‘qib chiqarilmaydi.
 * Foydalanuvchi matni loglarga yozilmaydi.
 */
import Anthropic from "@anthropic-ai/sdk";
import { parseAiJson } from "@/lib/ai-json";
import { HttpError } from "./http";

let client: Anthropic | null = null;

export function aiConnected() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export const AI_MODEL = () => process.env.AI_MODEL || "claude-opus-5-5";

/**
 * @param schema berilsa — strukturali chiqish (output_config.format); berilmasa — javob matni
 *   ko‘rsatma bo‘yicha JSON deb kutiladi va xavfsiz parse qilinadi.
 */
export async function aiJson<T>(system: string, user: string, schema?: Record<string, unknown>, opts: { maxTokens?: number } = {}): Promise<T> {
  if (!aiConnected()) throw new HttpError(503, "Xizmat ulanmagan.", "AI_NOT_CONNECTED");
  client ??= new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: AI_MODEL(),
      max_tokens: opts.maxTokens ?? 16000,
      // Xavfsizlik klassifikatori rad etsa, server mos zaxira modelga o‘tkazadi.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: schema ? { effort: "medium", format: { type: "json_schema", schema } } : { effort: "medium" },
      system,
      messages: [{ role: "user", content: user }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "Xizmat hozir band. Birozdan keyin urinib ko‘ring.", "AI_RATE_LIMIT");
    if (e instanceof Anthropic.AuthenticationError) throw new HttpError(503, "Xizmat noto‘g‘ri sozlangan.", "AI_AUTH");
    if (e instanceof Anthropic.APIError) throw new HttpError(502, "Xizmatdan javob olinmadi.", "AI_ERROR");
    throw new HttpError(502, "Xizmatga ulanib bo‘lmadi.", "AI_ERROR");
  }
  if (response.stop_reason === "refusal") throw new HttpError(422, "Bu so‘rovni bajarib bo‘lmadi.", "AI_REFUSAL");
  if (response.stop_reason === "max_tokens") throw new HttpError(422, "Matn juda uzun — javob to‘liq emas. Qisqaroq qism yuboring.", "AI_TRUNCATED");
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const parsed = parseAiJson(text);
  if (parsed === null || typeof parsed !== "object") throw new HttpError(502, "Javobni o‘qib bo‘lmadi. Qayta urinib ko‘ring.", "AI_BAD_JSON");
  return parsed as T;
}
