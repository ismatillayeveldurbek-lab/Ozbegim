import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { availability } from "@/lib/server/exercises";
import { Client, makeAdmin, prisma } from "./helpers";

describe("so‘z va gap tahlili API", () => {
  it("so‘z: bo‘g‘in, harflar, lug‘atdagi o‘zak (namuna lug‘at)", async () => {
    const r = await new Client().json(`/api/analyze?mode=word&q=${encodeURIComponent("kitoblarimizdan")}`);
    expect(r.status).toBe(200);
    expect(r.body.syllables).toEqual(["ki", "tob", "la", "ri", "miz", "dan"]);
    expect(r.body.analyses[0]).toMatchObject({ root: "kitob", pos: "ot", basis: "lug‘at" });
    expect(r.body.analyses[0].affixes.map((a: any) => a.form)).toEqual(["lar", "imiz", "dan"]);
  });
  it("kirill kiritish ham tahlil qilinadi", async () => {
    const r = await new Client().json(`/api/analyze?mode=word&q=${encodeURIComponent("китобга")}`);
    expect(r.body.word).toBe("kitobga");
  });
  it("gap tahlili", async () => {
    const r = await new Client().json(`/api/analyze?mode=sentence&q=${encodeURIComponent("Men bugun kitob o‘qidim")}`);
    expect(r.body.roles.map((x: any) => x.role)).toEqual(["ega", "hol", "to‘ldiruvchi", "kesim"]);
  });
});

describe("mashqlar", () => {
  let u: Client;
  beforeAll(async () => {
    u = new Client();
    await u.signUp();
    // Tasdiqlangan iboralar yetarli bo‘lsin
    const admin = new Client();
    await makeAdmin((await admin.signUp()).id);
    const t = randomUUID().replace(/[^a-z]/g, "").slice(0, 5);
    for (let i = 0; i < 4; i++)
      await admin.json("/api/admin/entries/idiom", { method: "POST", json: { phrase: `sinov ibora ${t} ${i}`, status: "VERIFIED", senses: [{ meaning: `ma’no ${t} ${i}` }] } });
  });

  it("namuna (DEMO) va tekshirilmagan yozuvlar savollar soniga kirmaydi", async () => {
    const a = await availability();
    expect(a.idiom_meaning).toBe(await prisma.idiom.count({ where: { status: "VERIFIED", origin: { not: "DEMO" } } }));
    expect(a.demoAllowed).toBe(false);
  });

  it("savol → javob → tushuntirish; urinish tarixga yoziladi; tokenni soxtalashtirib bo‘lmaydi", async () => {
    const q = await u.json("/api/exercises/next?type=idiom_meaning");
    expect(q.status).toBe(200);
    expect(q.body.options.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(q.body)).not.toContain("answer");
    const r = await u.json("/api/exercises/answer", { method: "POST", json: { token: q.body.token, answer: q.body.options[0] } });
    expect(r.status).toBe(200);
    expect(typeof r.body.isCorrect).toBe("boolean");
    expect(r.body.explanation).toBeTruthy();
    expect(q.body.options).toContain(r.body.correctAnswer);
    // Soxta token
    const [body] = q.body.token.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    payload.answer = "soxta javob";
    const forged = Buffer.from(JSON.stringify(payload)).toString("base64url") + "." + q.body.token.split(".")[1];
    expect((await u.json("/api/exercises/answer", { method: "POST", json: { token: forged, answer: "soxta javob" } })).status).toBe(400);
    const ov = await u.json("/api/exercises");
    const s = ov.body.stats.idiom_meaning;
    expect(s.correct + s.wrong).toBe(1);
  });

  it("kartochkalar: baho bo‘yicha keyingi takrorlash vaqti", async () => {
    const item = await u.json("/api/personal/items", { method: "POST", json: { kind: "WORD", term: "takror", meaning: "qayta" } });
    const cards = await u.json("/api/exercises/cards");
    expect(cards.body.cards.map((c: any) => c.id)).toContain(item.body.id);
    const good = await u.json(`/api/exercises/cards/${item.body.id}`, { method: "POST", json: { grade: 5 } });
    expect(good.body.intervalDays).toBe(1);
    expect(new Date(good.body.dueAt).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    const after = await u.json("/api/exercises/cards");
    expect(after.body.cards.map((c: any) => c.id)).not.toContain(item.body.id);
    // Boshqa foydalanuvchi bu kartochkani baholay olmaydi
    const other = new Client();
    await other.signUp();
    expect((await other.json(`/api/exercises/cards/${item.body.id}`, { method: "POST", json: { grade: 0 } })).status).toBe(404);
  });
});

describe("tashqi xizmatlar ulanmaganda natija to‘qilmaydi", () => {
  it("AI endpointlari 503 qaytaradi; holat sahifasi “ulanmagan” deydi", async () => {
    const u = new Client();
    await u.signUp();
    const r = await u.json("/api/ai/spelling", { method: "POST", json: { text: "kop malumot", consent: true } });
    expect(r.status).toBe(503);
    expect(r.body.error).toContain("ulanmagan");
    expect((await u.json("/api/ai/analyze", { method: "POST", json: { sentence: "Men keldim", consent: true } })).status).toBe(503);
    expect((await u.json("/api/ai/spelling", { method: "POST", json: { text: "x", consent: false } })).status).toBe(400);
    const st = await new Client().json("/api/status");
    expect(st.body.ai.connected).toBe(false);
    expect(st.body.ocr.connected).toBe(false);
  });
});

afterAll(() => prisma.$disconnect());
