import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizeKey } from "@/lib/uz/normalize";
import { prisma } from "./helpers";

// Soxta Anthropic Messages API: faqat test uchun, SDK -> HTTP -> parse yo‘lini tekshiradi.
let server: Server;
const requests: any[] = [];
let nextText = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      requests.push({ url: req.url, headers: req.headers, body: JSON.parse(body || "{}") });
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [{ type: "text", text: nextText }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_BASE_URL;
  server.close();
  await prisma.$disconnect();
});

describe("So‘z tahlilchisi (soxta AI bilan)", () => {
  it("ko‘rsatma yuboriladi, ```json olib tashlanadi, natija keshlanadi", async () => {
    const { analyzeWordAi, WORD_ANALYZER_PROMPT } = await import("@/lib/server/word-analyzer");
    const word = `kitobtest${Date.now()}`;
    nextText = '```json\n{"manosi": "Varaqlardan iborat asar", "sinonimlar": ["asar", "nashr", "daftar"], "antonimlar": [], "misol": "Men kitob o‘qidim.", "turkum": "ot"}\n```';
    const first = await analyzeWordAi(word);
    expect(first.cached).toBe(false);
    expect(first.result).toEqual({ found: true, manosi: "Varaqlardan iborat asar", sinonimlar: ["asar", "nashr", "daftar"], antonimlar: [], misollar: ["Men kitob o‘qidim."], turkum: "ot" });
    const req = requests.at(-1);
    expect(req.headers["x-api-key"]).toBe("test-key");
    expect(req.body.model).toBe("claude-opus-5-5");
    expect(req.body.system).toBe(WORD_ANALYZER_PROMPT);
    expect(req.body.messages).toEqual([{ role: "user", content: word }]);
    const n = requests.length;
    const second = await analyzeWordAi(word.toUpperCase());
    expect(second.cached).toBe(true);
    expect(requests.length).toBe(n);
    await prisma.aiWordCache.delete({ where: { key: normalizeKey(word) } });
  });

  it("topilmagan so‘z keshlanmaydi; buzilgan JSON tushunarli xato beradi", async () => {
    const { analyzeWordAi } = await import("@/lib/server/word-analyzer");
    nextText = '{"xato": "So\'z topilmadi"}';
    const r = await analyzeWordAi("qwrtxyz");
    expect(r.result.found).toBe(false);
    expect(await prisma.aiWordCache.findUnique({ where: { key: "qwrtxyz" } })).toBeNull();
    nextText = "kechirasiz, javob yo‘q";
    await expect(analyzeWordAi("boshqaso")).rejects.toThrow(/o‘qib bo‘lmadi/);
  });
});

describe("Turistlar tarjimoni (soxta AI bilan)", () => {
  it("tarjima, til va qoidalar ko‘rsatmasi", async () => {
    const { translateForTourist, TRANSLATOR_PROMPT } = await import("@/lib/server/tourist-translator");
    nextText = '{"source_language": "Ingliz tili", "translation": "Mehmonxonamdan Registonga qanday borsam bo‘ladi?"}';
    const r = await translateForTourist("How can I get to the Registan from my hotel?");
    expect(r).toEqual({ source_language: "Ingliz tili", translation: "Mehmonxonamdan Registonga qanday borsam bo‘ladi?", understood: true });
    expect(requests.at(-1).body.system).toBe(TRANSLATOR_PROMPT);
    expect(TRANSLATOR_PROMPT).toContain("Samarkand → Samarqand");
  });
  it("bo‘sh yoki belgilardan iborat matn AI’ga yuborilmaydi", async () => {
    const { translateForTourist, NOT_UNDERSTOOD } = await import("@/lib/server/tourist-translator");
    const n = requests.length;
    expect(await translateForTourist("   ")).toMatchObject({ understood: false, translation: NOT_UNDERSTOOD });
    expect(await translateForTourist("?!... ###")).toMatchObject({ understood: false });
    expect(requests.length).toBe(n);
  });
  it("model 8-qoida xabarini qaytarsa — tushunilmadi holati", async () => {
    const { translateForTourist } = await import("@/lib/server/tourist-translator");
    nextText = '{"source_language": "", "translation": "Matnni tushunib bo\'lmadi, iltimos qaytadan yozing."}';
    expect(await translateForTourist("asdkjh qwe")).toMatchObject({ understood: false });
  });
});
