/**
 * AI tavsiyalari (ixtiyoriy): Google Gemini API (GEMINI_API_KEY, bepul tarif bor) yoki
 * Claude API (ANTHROPIC_API_KEY). Ikkalasi berilsa — Gemini. Kalit faqat serverda.
 * Ulanmagan bo‘lsa — xato qaytariladi, hech qanday natija to‘qib chiqarilmaydi.
 * Foydalanuvchi matni loglarga yozilmaydi.
 */
import Anthropic from "@anthropic-ai/sdk";
import { parseAiJson } from "@/lib/ai-json";
import { HttpError } from "./http";

let client: Anthropic | null = null;

export function aiProvider(): "gemini" | "anthropic" | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function aiConnected() {
  return aiProvider() !== null;
}

export const AI_MODEL = () => process.env.AI_MODEL || "claude-opus-5-5";
export const GEMINI_MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";

/**
 * @param schema berilsa — strukturali chiqish (output_config.format); berilmasa — javob matni
 *   ko‘rsatma bo‘yicha JSON deb kutiladi va xavfsiz parse qilinadi.
 */
export async function aiJson<T>(system: string, user: string, schema?: Record<string, unknown>, opts: { maxTokens?: number } = {}): Promise<T> {
  const provider = aiProvider();
  if (!provider) throw new HttpError(503, "Xizmat ulanmagan.", "AI_NOT_CONNECTED");
  const text = provider === "gemini" ? await geminiText(system, user, schema, opts) : await anthropicText(system, user, schema, opts);
  const parsed = parseAiJson(text);
  if (parsed === null || typeof parsed !== "object") throw new HttpError(502, "Javobni o‘qib bo‘lmadi. Qayta urinib ko‘ring.", "AI_BAD_JSON");
  return parsed as T;
}

async function anthropicText(system: string, user: string, schema: Record<string, unknown> | undefined, opts: { maxTokens?: number }) {
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
  return response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

type GeminiResponse = {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  promptFeedback?: { blockReason?: string };
};

/** Gemini generateContent (REST). Schema rad etilsa (400) — schema’siz qayta so‘raladi. */
async function geminiText(system: string, user: string, schema: Record<string, unknown> | undefined, opts: { maxTokens?: number }) {
  const base = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  const send = (withSchema: boolean) =>
    fetch(`${base}/v1beta/models/${encodeURIComponent(GEMINI_MODEL())}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          // Fikrlash tokenlari ham shu chegaraga kiradi, shuning uchun pastki chegara bor
          maxOutputTokens: Math.max(opts.maxTokens ?? 16000, 8192),
          responseMimeType: "application/json",
          ...(withSchema && schema ? { responseJsonSchema: schema } : {}),
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  let res: Response;
  try {
    res = await send(true);
    if (res.status === 400 && schema) res = await send(false);
  } catch {
    throw new HttpError(502, "Xizmatga ulanib bo‘lmadi.", "AI_ERROR");
  }
  if (res.status === 429) throw new HttpError(429, "Xizmat hozir band. Birozdan keyin urinib ko‘ring.", "AI_RATE_LIMIT");
  if (res.status === 401 || res.status === 403) throw new HttpError(503, "Xizmat noto‘g‘ri sozlangan.", "AI_AUTH");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 400 && /API key/i.test(detail)) throw new HttpError(503, "Xizmat noto‘g‘ri sozlangan.", "AI_AUTH");
    throw new HttpError(502, "Xizmatdan javob olinmadi.", "AI_ERROR");
  }
  const data = (await res.json()) as GeminiResponse;
  const cand = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(cand?.finishReason ?? ""))
    throw new HttpError(422, "Bu so‘rovni bajarib bo‘lmadi.", "AI_REFUSAL");
  if (cand?.finishReason === "MAX_TOKENS") throw new HttpError(422, "Matn juda uzun — javob to‘liq emas. Qisqaroq qism yuboring.", "AI_TRUNCATED");
  return (cand?.content?.parts ?? []).map((p) => (p.thought ? "" : (p.text ?? ""))).join("");
}
