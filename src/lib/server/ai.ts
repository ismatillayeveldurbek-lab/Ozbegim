/**
 * AI tavsiyalari (ixtiyoriy). Ulangan xizmatlar navbat bilan sinaladi: Google Gemini (GEMINI_API_KEY),
 * Claude API (ANTHROPIC_API_KEY).
 * Biri limitga yetsa yoki ishlamasa — keyingisiga o‘tiladi. Kalitlar faqat serverda.
 * Ulanmagan bo‘lsa — xato qaytariladi, hech qanday natija to‘qib chiqarilmaydi.
 * Foydalanuvchi matni loglarga yozilmaydi.
 */
import Anthropic from "@anthropic-ai/sdk";
import { parseAiJson } from "@/lib/ai-json";
import { prisma } from "./db";
import { HttpError } from "./http";

let client: Anthropic | null = null;

type Provider = "gemini" | "anthropic";

export function aiProviders(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GEMINI_API_KEY) list.push("gemini");
  if (process.env.ANTHROPIC_API_KEY) list.push("anthropic");
  return list;
}

export function aiConnected() {
  return aiProviders().length > 0;
}

export const AI_MODEL = () => process.env.AI_MODEL || "claude-haiku-5-5";
export const GEMINI_MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

/** Keyingi xizmatga o‘tish mumkin bo‘lgan xatolar: limit, vaqtinchalik nosozlik, ulanish. */
const RETRYABLE = new Set(["AI_RATE_LIMIT", "AI_ERROR", "AI_AUTH", "AI_BAD_JSON"]);
/** Bitta xizmatni kutish chegarasi; oshsa — keyingisiga o‘tiladi. */
const PROVIDER_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 45_000);
/** Limitga yetgan yoki javob bermagan xizmat bir muddat chetlab o‘tiladi (jarayon xotirasida). */
const cooldownUntil = new Map<Provider, number>();
const COOLDOWN_MS: Record<string, number> = { AI_RATE_LIMIT: 15 * 60_000, AI_AUTH: 30 * 60_000, AI_ERROR: 2 * 60_000 };

type Usage = { model: string; input: number; output: number };
type Reply = { text: string; usage: Usage };
export type UsageTag = { feature: "spelling" | "analyze" | "word" | "translate" | "check"; userId?: string | null };

/** Narx, USD / 1 mln token [kirish, chiqish]. Taxminiy — aniq hisob xizmatning o‘z panelida. Env bilan o‘zgartiriladi. */
function priceFor(provider: Provider, model: string): [number, number] {
  const env = (k: string) => (process.env[k] ? Number(process.env[k]) : undefined);
  const pick = (prefix: string, def: [number, number]): [number, number] => [env(`${prefix}_PRICE_IN`) ?? def[0], env(`${prefix}_PRICE_OUT`) ?? def[1]];
  if (provider === "gemini") return pick("GEMINI", /lite/i.test(model) ? [0.25, 1.5] : [0.5, 3]);
  // Claude API narxlari (2026-10): Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20
  return pick("ANTHROPIC", /haiku/i.test(model) ? [0.1, 0.5] : /sonnet/i.test(model) ? [2, 10] : [4, 20]);
}

/** Sarf bazaga yoziladi (matnsiz: faqat kim, qaysi bo‘lim, model va token soni). Xato so‘rovni buzmaydi. */
async function recordUsage(tag: UsageTag | undefined, provider: Provider, u: Usage) {
  const [pin, pout] = priceFor(provider, u.model);
  try {
    await prisma.aiUsage.create({
      data: {
        userId: tag?.userId ?? null,
        feature: tag?.feature ?? "boshqa",
        provider,
        model: u.model,
        inputTokens: u.input,
        outputTokens: u.output,
        costUsd: (u.input * pin + u.output * pout) / 1_000_000,
      },
    });
  } catch (e) {
    console.error("AI sarfi yozilmadi:", e instanceof Error ? e.message : e);
  }
}

/**
 * @param schema berilsa — strukturali chiqish (output_config.format); berilmasa — javob matni
 *   ko‘rsatma bo‘yicha JSON deb kutiladi va xavfsiz parse qilinadi.
 */
export async function aiJson<T>(system: string, user: string, schema?: Record<string, unknown>, opts: { maxTokens?: number; usage?: UsageTag } = {}): Promise<T> {
  const providers = aiProviders();
  if (!providers.length) throw new HttpError(503, "Xizmat ulanmagan.", "AI_NOT_CONNECTED");
  // Hammasi "dam olayotgan" bo‘lsa — baribir hammasi sinaladi
  const ready = providers.filter((p) => (cooldownUntil.get(p) ?? 0) < Date.now());
  let lastError: unknown;
  for (const provider of ready.length ? ready : providers) {
    const started = Date.now();
    try {
      const { text, usage } =
        provider === "gemini" ? await geminiText(system, user, schema, opts) : await anthropicText(system, user, schema, opts);
      await recordUsage(opts.usage, provider, usage);
      const parsed = parseAiJson(text);
      if (parsed === null || typeof parsed !== "object") throw new HttpError(502, "Javobni o‘qib bo‘lmadi. Qayta urinib ko‘ring.", "AI_BAD_JSON");
      console.log(`AI: "${provider}" ${Date.now() - started} ms`);
      return parsed as T;
    } catch (e) {
      lastError = e;
      if (!(e instanceof HttpError && e.code && RETRYABLE.has(e.code))) throw e;
      const pause = COOLDOWN_MS[e.code] ?? 0;
      if (pause) cooldownUntil.set(provider, Date.now() + pause);
      console.error(`AI xizmati "${provider}" ishlamadi (${e.code}, ${Date.now() - started} ms), ${Math.round(pause / 60_000)} daqiqa chetlab o‘tiladi`);
    }
  }
  throw lastError;
}

async function anthropicText(system: string, user: string, schema: Record<string, unknown> | undefined, opts: { maxTokens?: number }): Promise<Reply> {
  client ??= new Anthropic({ timeout: PROVIDER_TIMEOUT_MS, maxRetries: 1 });
  const model = AI_MODEL();
  // Qisqa vazifalar (tarjima, so‘z tahlili) uchun past effort yetarli va arzon
  const effort = (process.env.AI_EFFORT as "low" | "medium" | "high" | undefined) || "low";
  const params = {
    model,
    max_tokens: opts.maxTokens ?? 16000,
    output_config: schema ? { effort, format: { type: "json_schema" as const, schema } } : { effort },
    system,
    messages: [{ role: "user" as const, content: user }],
  };
  // Server tomonidagi zaxira modeli faqat Opus/Sonnet 5.5 va Fable’da bor (Haiku’da yo‘q)
  const serverFallback = /opus|sonnet-5-5|fable/i.test(model);
  let response;
  try {
    response = serverFallback
      ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await client.messages.create(params);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "Xizmat hozir band. Birozdan keyin urinib ko‘ring.", "AI_RATE_LIMIT");
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      console.error(`Claude xatosi ${e.status}: ${e.message.slice(0, 300)}`);
      throw new HttpError(503, "Xizmat noto‘g‘ri sozlangan.", "AI_AUTH");
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`Claude xatosi ${e.status}: ${e.message.slice(0, 300)}`);
      throw new HttpError(502, "Xizmatdan javob olinmadi.", "AI_ERROR");
    }
    console.error("Claude: ulanib bo‘lmadi yoki javob kechikdi");
    throw new HttpError(502, "Xizmatga ulanib bo‘lmadi.", "AI_ERROR");
  }
  if (response.stop_reason === "refusal") throw new HttpError(422, "Bu so‘rovni bajarib bo‘lmadi.", "AI_REFUSAL");
  if (response.stop_reason === "max_tokens") throw new HttpError(422, "Matn juda uzun — javob to‘liq emas. Qisqaroq qism yuboring.", "AI_TRUNCATED");
  return {
    text: response.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
    usage: { model: response.model, input: response.usage.input_tokens, output: response.usage.output_tokens },
  };
}

type GeminiResponse = {
  modelVersion?: string;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  promptFeedback?: { blockReason?: string };
};

/**
 * Gemini generateContent (REST). Tezlik uchun fikrlash darajasi past ("low", GEMINI_THINKING bilan o‘zgaradi).
 * 400 bo‘lsa — avval thinkingConfig’siz, so‘ng schema’siz qayta so‘raladi; 5xx bo‘lsa — 1 marta qayta urinish.
 */
async function geminiText(system: string, user: string, schema: Record<string, unknown> | undefined, opts: { maxTokens?: number }): Promise<Reply> {
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
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  let res: Response;
  try {
    let withThinking = !!thinking;
    let withSchema = !!schema;
    for (let attempt = 0; ; attempt++) {
      res = await send(withThinking, withSchema);
      if (res.status === 400 && withThinking) withThinking = false;
      else if (res.status === 400 && withSchema) withSchema = false;
      else if (res.status >= 500 && attempt < 1) await new Promise((r) => setTimeout(r, 1500));
      else break;
      await res.body?.cancel();
    }
  } catch (e) {
    console.error(`Gemini: ${e instanceof Error && e.name === "TimeoutError" ? `${PROVIDER_TIMEOUT_MS / 1000} s ichida javob bermadi (model: ${GEMINI_MODEL()})` : "ulanib bo‘lmadi"}`);
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
  const um = data.usageMetadata;
  return {
    text: (cand?.content?.parts ?? []).map((p) => (p.thought ? "" : (p.text ?? ""))).join(""),
    // Fikrlash tokenlari ham chiqish narxida hisoblanadi
    usage: { model: data.modelVersion || GEMINI_MODEL(), input: um?.promptTokenCount ?? 0, output: (um?.candidatesTokenCount ?? 0) + (um?.thoughtsTokenCount ?? 0) },
  };
}

/** Admin uchun: har bir ulangan xizmatga kichik so‘rov yuborib, ishlayotganini tekshiradi (navbat va dam olishdan qat’i nazar). */
export async function checkProviders(userId: string) {
  const system = 'Faqat JSON qaytaring: {"ok": true}';
  return Promise.all(
    aiProviders().map(async (provider) => {
      const started = Date.now();
      try {
        const { text, usage } = provider === "gemini" ? await geminiText(system, "ping", undefined, { maxTokens: 50 }) : await anthropicText(system, "ping", undefined, { maxTokens: 50 });
        await recordUsage({ feature: "check", userId }, provider, usage);
        cooldownUntil.delete(provider);
        return { provider, ok: parseAiJson(text) !== null, model: usage.model, ms: Date.now() - started, error: null as string | null };
      } catch (e) {
        return { provider, ok: false, model: null, ms: Date.now() - started, error: e instanceof HttpError ? `${e.code}: ${e.message}` : "noma’lum xato" };
      }
    }),
  );
}
