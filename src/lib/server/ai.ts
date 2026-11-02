/**
 * AI tavsiyalari (ixtiyoriy): Claude API (ANTHROPIC_API_KEY), standart model — Claude Sonnet 5.5 (AI_MODEL bilan o‘zgaradi). Kalit faqat serverda.
 * Ulanmagan bo‘lsa — xato qaytariladi, hech qanday natija to‘qib chiqarilmaydi.
 * Foydalanuvchi matni loglarga yozilmaydi.
 */
import Anthropic from "@anthropic-ai/sdk";
import { parseAiJson } from "@/lib/ai-json";
import { prisma } from "./db";
import { HttpError } from "./http";

let client: Anthropic | null = null;

export function aiConnected() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export const AI_MODEL = () => process.env.AI_MODEL || "claude-sonnet-5-5";

/** Javob kutish chegarasi */
const PROVIDER_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 45_000);

type Effort = "low" | "medium" | "high";
type Usage = { model: string; input: number; output: number };
type Reply = { text: string; usage: Usage };
export type UsageTag = { feature: "spelling" | "analyze" | "word" | "translate" | "idiom" | "check"; userId?: string | null };

/** Narx, USD / 1 mln token [kirish, chiqish]. Taxminiy — aniq hisob Claude Console’da. Env bilan o‘zgartiriladi. */
function priceFor(model: string): [number, number] {
  const env = (k: string) => (process.env[k] ? Number(process.env[k]) : undefined);
  // Claude API narxlari (2026-10): Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20
  const def: [number, number] = /haiku/i.test(model) ? [0.1, 0.5] : /sonnet/i.test(model) ? [2, 10] : [4, 20];
  return [env("ANTHROPIC_PRICE_IN") ?? def[0], env("ANTHROPIC_PRICE_OUT") ?? def[1]];
}

/** Sarf bazaga yoziladi (matnsiz: faqat kim, qaysi bo‘lim, model va token soni). Xato so‘rovni buzmaydi. */
async function recordUsage(tag: UsageTag | undefined, u: Usage) {
  const [pin, pout] = priceFor(u.model);
  try {
    await prisma.aiUsage.create({
      data: {
        userId: tag?.userId ?? null,
        feature: tag?.feature ?? "boshqa",
        provider: "anthropic",
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
export async function aiJson<T>(system: string, user: string, schema?: Record<string, unknown>, opts: { maxTokens?: number; effort?: Effort; usage?: UsageTag } = {}): Promise<T> {
  if (!aiConnected()) throw new HttpError(503, "Xizmat ulanmagan.", "AI_NOT_CONNECTED");
  const started = Date.now();
  const { text, usage } = await anthropicText(system, user, schema, opts);
  await recordUsage(opts.usage, usage);
  console.log(`AI: ${usage.model} ${Date.now() - started} ms`);
  const parsed = parseAiJson(text);
  if (parsed === null || typeof parsed !== "object") throw new HttpError(502, "Javobni o‘qib bo‘lmadi. Qayta urinib ko‘ring.", "AI_BAD_JSON");
  return parsed as T;
}

async function anthropicText(system: string, user: string, schema: Record<string, unknown> | undefined, opts: { maxTokens?: number; effort?: Effort }): Promise<Reply> {
  client ??= new Anthropic({ timeout: PROVIDER_TIMEOUT_MS, maxRetries: 1 });
  const model = AI_MODEL();
  // Qisqa vazifalar (tarjima, so‘z tahlili) uchun past effort yetarli va arzon
  const effort = opts.effort ?? ((process.env.AI_EFFORT as Effort | undefined) || "low");
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

/** Admin uchun: Claude’ga kichik so‘rov yuborib, ishlayotganini tekshiradi. */
export async function checkProviders(userId: string) {
  if (!aiConnected()) return [];
  const started = Date.now();
  try {
    const { text, usage } = await anthropicText('Faqat JSON qaytaring: {"ok": true}', "ping", undefined, { maxTokens: 200 });
    await recordUsage({ feature: "check", userId }, usage);
    return [{ provider: "anthropic", ok: parseAiJson(text) !== null, model: usage.model, ms: Date.now() - started, error: null as string | null }];
  } catch (e) {
    return [{ provider: "anthropic", ok: false, model: null, ms: Date.now() - started, error: e instanceof HttpError ? `${e.code}: ${e.message}` : "noma’lum xato" }];
  }
}
