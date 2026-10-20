/**
 * AI tavsiyalari (ixtiyoriy). Ulangan xizmatlar navbat bilan sinaladi: Google Gemini (GEMINI_API_KEY),
 * OpenAI bilan mos API — standart Groq (LLM_API_KEY, bepul tarif bor), Claude API (ANTHROPIC_API_KEY).
 * Biri limitga yetsa yoki ishlamasa — keyingisiga o‘tiladi. Kalitlar faqat serverda.
 * Ulanmagan bo‘lsa — xato qaytariladi, hech qanday natija to‘qib chiqarilmaydi.
 * Foydalanuvchi matni loglarga yozilmaydi.
 */
import Anthropic from "@anthropic-ai/sdk";
import { parseAiJson } from "@/lib/ai-json";
import { HttpError } from "./http";

let client: Anthropic | null = null;

type Provider = "gemini" | "openai" | "anthropic";

export function aiProviders(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GEMINI_API_KEY) list.push("gemini");
  if (process.env.LLM_API_KEY) list.push("openai");
  if (process.env.ANTHROPIC_API_KEY) list.push("anthropic");
  return list;
}

export function aiConnected() {
  return aiProviders().length > 0;
}

export const AI_MODEL = () => process.env.AI_MODEL || "claude-opus-5-5";
export const GEMINI_MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";
export const LLM_MODEL = () => process.env.LLM_MODEL || "openai/gpt-oss-120b";

/** Keyingi xizmatga o‘tish mumkin bo‘lgan xatolar: limit, vaqtinchalik nosozlik, ulanish. */
const RETRYABLE = new Set(["AI_RATE_LIMIT", "AI_ERROR", "AI_AUTH", "AI_BAD_JSON"]);

/**
 * @param schema berilsa — strukturali chiqish (output_config.format); berilmasa — javob matni
 *   ko‘rsatma bo‘yicha JSON deb kutiladi va xavfsiz parse qilinadi.
 */
export async function aiJson<T>(system: string, user: string, schema?: Record<string, unknown>, opts: { maxTokens?: number } = {}): Promise<T> {
  const providers = aiProviders();
  if (!providers.length) throw new HttpError(503, "Xizmat ulanmagan.", "AI_NOT_CONNECTED");
  let lastError: unknown;
  for (const provider of providers) {
    try {
      const text =
        provider === "gemini" ? await geminiText(system, user, schema, opts) : provider === "openai" ? await openaiText(system, user, schema, opts) : await anthropicText(system, user, schema, opts);
      const parsed = parseAiJson(text);
      if (parsed === null || typeof parsed !== "object") throw new HttpError(502, "Javobni o‘qib bo‘lmadi. Qayta urinib ko‘ring.", "AI_BAD_JSON");
      return parsed as T;
    } catch (e) {
      lastError = e;
      if (!(e instanceof HttpError && e.code && RETRYABLE.has(e.code))) throw e;
      console.error(`AI xizmati "${provider}" ishlamadi (${e.code}), keyingisi sinaladi`);
    }
  }
  throw lastError;
}

/** OpenAI bilan mos Chat Completions API (Groq, OpenRouter, Cerebras, Mistral va h.k.). */
async function openaiText(system: string, user: string, schema: Record<string, unknown> | undefined, opts: { maxTokens?: number }) {
  const base = (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const sys = schema ? `${system}\n\nJavobni faqat JSON ko‘rinishida, quyidagi JSON Schema bo‘yicha qaytaring:\n${JSON.stringify(schema)}` : `${system}\n\nJavobni faqat JSON ko‘rinishida qaytaring.`;
  const send = (jsonMode: boolean) =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL(),
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        max_tokens: Math.max(opts.maxTokens ?? 8000, 4000),
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
  let res: Response;
  try {
    res = await send(true);
    if (res.status === 400) {
      await res.body?.cancel();
      res = await send(false);
    }
  } catch {
    throw new HttpError(502, "Xizmatga ulanib bo‘lmadi.", "AI_ERROR");
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`LLM xatosi ${res.status}: ${detail}`);
    if (res.status === 429) throw new HttpError(429, "Xizmat hozir band. Birozdan keyin urinib ko‘ring.", "AI_RATE_LIMIT");
    if (res.status === 401 || res.status === 403) throw new HttpError(503, "Xizmat noto‘g‘ri sozlangan.", "AI_AUTH");
    throw new HttpError(502, "Xizmatdan javob olinmadi.", "AI_ERROR");
  }
  const data = (await res.json()) as { choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }> };
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new HttpError(422, "Matn juda uzun — javob to‘liq emas. Qisqaroq qism yuboring.", "AI_TRUNCATED");
  if (choice?.finish_reason === "content_filter") throw new HttpError(422, "Bu so‘rovni bajarib bo‘lmadi.", "AI_REFUSAL");
  return choice?.message?.content ?? "";
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

/**
 * Gemini generateContent (REST). Tezlik uchun fikrlash darajasi past ("low", GEMINI_THINKING bilan o‘zgaradi).
 * 400 bo‘lsa — avval thinkingConfig’siz, so‘ng schema’siz qayta so‘raladi; 5xx bo‘lsa — 2 marta qayta urinish.
 */
async function geminiText(system: string, user: string, schema: Record<string, unknown> | undefined, opts: { maxTokens?: number }) {
  const base = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  const thinking = process.env.GEMINI_THINKING ?? "low";
  const send = (withThinking: boolean, withSchema: boolean) =>
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
          ...(withThinking && thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });
  let res: Response;
  try {
    let withThinking = !!thinking;
    let withSchema = !!schema;
    for (let attempt = 0; ; attempt++) {
      res = await send(withThinking, withSchema);
      if (res.status === 400 && withThinking) withThinking = false;
      else if (res.status === 400 && withSchema) withSchema = false;
      else if (res.status >= 500 && attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      else break;
      await res.body?.cancel();
    }
  } catch {
    throw new HttpError(502, "Xizmatga ulanib bo‘lmadi.", "AI_ERROR");
  }
  if (res.status === 429) {
    // Bepul tarif limiti: qaysi kvota (daqiqalik yoki kunlik) tugagani logda ko‘rinadi
    console.error(`Gemini limiti (429): ${(await res.text().catch(() => "")).slice(0, 400)}`);
    throw new HttpError(429, "Xizmat hozir band. Birozdan keyin urinib ko‘ring.", "AI_RATE_LIMIT");
  }
  if (res.status === 401 || res.status === 403) throw new HttpError(503, "Xizmat noto‘g‘ri sozlangan.", "AI_AUTH");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Diagnostika uchun: faqat holat kodi va xizmat xabari (foydalanuvchi matni emas)
    console.error(`Gemini xatosi ${res.status}: ${detail.slice(0, 300)}`);
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
