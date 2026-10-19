import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, makeAdmin, prisma } from "./helpers";

const uniq = () => `sinovso${randomUUID().replace(/[^a-z]/g, "").slice(0, 8)}`;

describe("autentifikatsiya va rollar", () => {
  it("ro‘yxatdan o‘tgan birinchi foydalanuvchi ham admin bo‘lmaydi; role maydonini yuborib bo‘lmaydi", async () => {
    const c = new Client();
    const email = `test-${randomUUID().slice(0, 8)}@sinov.uz`;
    const r = await c.json("/api/auth/sign-up/email", { method: "POST", json: { name: "Hiyla", email, password: "parol-12345", role: "admin" } });
    // role maydoni input:false — so‘rov rad etiladi yoki maydon e’tiborsiz qoldiriladi; har ikki holatda rol "user".
    if (r.status === 200) {
      const u = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(u.role).toBe("user");
    }
    // Birinchi foydalanuvchi ham avtomatik admin bo‘lmaydi: barcha yangi foydalanuvchilar "user".
    expect(await prisma.user.count({ where: { role: "admin", accounts: { none: {} } } })).toBe(0);
  });

  it("oddiy foydalanuvchi admin API’ga kira olmaydi, mehmon esa 401 oladi", async () => {
    const guest = new Client();
    expect((await guest.json("/api/admin/entries/idiom")).status).toBe(401);
    const user = new Client();
    await user.signUp();
    for (const path of ["/api/admin/entries/idiom", "/api/admin/comments", "/api/admin/reports", "/api/admin/users", "/api/admin/audit"]) {
      expect((await user.json(path)).status, path).toBe(403);
    }
    const r = await user.json("/api/admin/entries/idiom", { method: "POST", json: { phrase: "x", senses: [{ meaning: "y" }] } });
    expect(r.status).toBe(403);
  });

  it("boshqa saytdan kelgan (Origin mos emas) so‘rov rad etiladi", async () => {
    const c = new Client();
    await c.signUp();
    const res = await fetch("http://localhost:3000/api/discussions", {
      method: "POST",
      headers: { origin: "https://yovuz.example", "content-type": "application/json", cookie: [...c.cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: JSON.stringify({ kind: "LOANWORD", term: "x", proposal: "y", explanation: "uzun tushuntirish matni" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("lug‘at qidiruvi", () => {
  let admin: Client;
  const word = uniq();
  beforeAll(async () => {
    admin = new Client();
    const { id } = await admin.signUp("Admin");
    await makeAdmin(id);
    const r = await admin.json("/api/admin/entries/idiom", {
      method: "POST",
      json: { phrase: `o‘q ${word}`, status: "VERIFIED", senses: [{ meaning: "Birinchi ma’no" }, { meaning: "Ikkinchi ma’no" }] },
    });
    expect(r.status).toBe(201);
  });

  it("lotin, kirill va apostrof variantlari bir xil yozuvni topadi", async () => {
    const c = new Client();
    const { latinToCyrillic } = await import("@/lib/uz/translit");
    const variants = [`o‘q ${word}`, `O'Q ${word.toUpperCase()}`, `oʻq ${word}`, latinToCyrillic(`o‘q ${word}`)];
    const ids = new Set<string>();
    for (const v of variants) {
      const r = await c.json(`/api/idioms/search?q=${encodeURIComponent(v)}`);
      expect(r.status).toBe(200);
      expect(r.body.exact).toHaveLength(1);
      expect(r.body.exact[0].senses).toHaveLength(2);
      ids.add(r.body.exact[0].id);
    }
    expect(ids.size).toBe(1);
    // "oq" (apostrofsiz) — boshqa so‘z, aniq moslik bo‘lmasligi kerak
    const r = await c.json(`/api/idioms/search?q=${encodeURIComponent(`oq ${word}`)}`);
    expect(r.body.exact).toHaveLength(0);
  });

  it("ibora topilmasa bo‘sh natija va yaqin natijalar qaytadi", async () => {
    const r = await new Client().json(`/api/idioms/search?q=${encodeURIComponent(`o‘q ${word}x`)}`);
    expect(r.body.exact).toHaveLength(0);
    expect(r.body.near.length).toBeGreaterThan(0);
  });
});

describe("o‘zlashma so‘zlar va izohlar", () => {
  const term = uniq();
  let a: Client;
  let b: Client;
  beforeAll(async () => {
    a = new Client();
    b = new Client();
    await a.signUp("Alisher");
    await b.signUp("Bobur");
  });

  it("mavjud bo‘lmagan so‘z uchun aniq xabar va izoh bo‘limi (bo‘sh muhokama) qaytadi", async () => {
    const r = await new Client().json(`/api/loanwords/search?q=${term}`);
    expect(r.status).toBe(200);
    expect(r.body.exact).toBeNull();
    expect(r.body.notFoundMessage).toBe("Bu so‘z hozircha bazada mavjud emas. Ma’nosi yoki o‘zbekcha muqobilini bilsangiz, izoh qoldiring.");
    expect(r.body.discussion).toEqual({ discussion: null, comments: [] });
  });

  it("mehmon izoh qoldira olmaydi", async () => {
    const r = await new Client().json("/api/discussions", { method: "POST", json: { kind: "LOANWORD", term, proposal: "x", explanation: "yetarlicha uzun izoh" } });
    expect(r.status).toBe(401);
  });

  it("ikki foydalanuvchi bir muhokamadagi izohlarni ko‘radi; kirill varianti o‘sha muhokamaga tushadi", async () => {
    const { latinToCyrillic } = await import("@/lib/uz/translit");
    const r1 = await a.json("/api/discussions", { method: "POST", json: { kind: "LOANWORD", term, proposal: "muqobil bir", explanation: "Bu birinchi foydalanuvchi izohi." } });
    expect(r1.status).toBe(201);
    const r2 = await b.json("/api/discussions", {
      method: "POST",
      json: { kind: "LOANWORD", term: latinToCyrillic(term.toUpperCase()), proposal: "muqobil ikki", explanation: "Bu ikkinchi foydalanuvchi izohi." },
    });
    expect(r2.status).toBe(201);
    expect(r2.body.discussionId).toBe(r1.body.discussionId);
    for (const c of [a, b, new Client()]) {
      const r = await c.json(`/api/loanwords/search?q=${term}`);
      expect(r.body.discussion.comments.map((x: any) => x.proposal).sort()).toEqual(["muqobil bir", "muqobil ikki"]);
    }
    expect(await prisma.discussion.count({ where: { key: term } })).toBe(1);
  });

  it("parallel so‘rovlar takroriy muhokama yaratmaydi", async () => {
    const t = uniq();
    const users = await Promise.all([1, 2, 3, 4].map(async () => {
      const c = new Client();
      await c.signUp();
      return c;
    }));
    const results = await Promise.all(users.map((c, i) => c.json("/api/discussions", { method: "POST", json: { kind: "LOANWORD", term: t, proposal: `taklif ${i}`, explanation: "Parallel yuborilgan izoh matni." } })));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    expect(new Set(results.map((r) => r.body.discussionId)).size).toBe(1);
  });

  it("takroriy izoh, havolali spam va honeypot rad etiladi", async () => {
    const dup = await a.json("/api/discussions", { method: "POST", json: { kind: "LOANWORD", term, proposal: "muqobil bir", explanation: "Bu birinchi foydalanuvchi izohi." } });
    expect(dup.status).toBe(409);
    const spam = await a.json("/api/discussions", { method: "POST", json: { kind: "LOANWORD", term, proposal: "x", explanation: "http://a.uz va http://b.uz ga kiring" } });
    expect(spam.status).toBe(400);
    const bot = await a.json("/api/discussions", { method: "POST", json: { kind: "LOANWORD", term, proposal: "x", explanation: "oddiy izoh matni", website: "http://spam" } });
    expect(bot.status).toBe(400);
    const js = await a.json("/api/discussions", { method: "POST", json: { kind: "LOANWORD", term, proposal: "x", explanation: "oddiy izoh matni", sourceUrl: "javascript:alert(1)" } });
    expect(js.status).toBe(400);
  });

  it("ovozlar izohni tasdiqlangan qilmaydi; shikoyatlar uni yashiradi", async () => {
    const list = await a.json(`/api/loanwords/search?q=${term}`);
    const bComment = list.body.discussion.comments.find((x: any) => x.proposal === "muqobil ikki");
    expect((await a.json(`/api/comments/${bComment.id}/vote`, { method: "POST", json: { value: 1 } })).body.score).toBe(1);
    const row = await prisma.comment.findUniqueOrThrow({ where: { id: bComment.id } });
    expect(row.status).toBe("VISIBLE");
    expect((await b.json(`/api/comments/${bComment.id}/vote`, { method: "POST", json: { value: 1 } })).status).toBe(400);
    for (let i = 0; i < 3; i++) {
      const c = new Client();
      await c.signUp();
      expect((await c.json(`/api/comments/${bComment.id}/report`, { method: "POST", json: { reason: "SPAM" } })).status).toBe(201);
    }
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: bComment.id } })).status).toBe("HIDDEN");
    const guestView = await new Client().json(`/api/loanwords/search?q=${term}`);
    expect(guestView.body.discussion.comments.map((x: any) => x.proposal)).toEqual(["muqobil bir"]);
    const authorView = await b.json(`/api/loanwords/search?q=${term}`);
    expect(authorView.body.discussion.comments).toHaveLength(2);
  });

  it("rate limit: bir foydalanuvchi 10 daqiqada 5 tadan ortiq izoh qoldira olmaydi", async () => {
    const c = new Client();
    await c.signUp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await c.json("/api/discussions", { method: "POST", json: { kind: "LOANWORD", term: `${term}rl`, proposal: `taklif ${i}`, explanation: `Tushuntirish matni raqami ${i}.` } });
      statuses.push(r.status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });

  it("admin taklifni tasdiqlangan yozuvga aylantiradi va audit yoziladi", async () => {
    const admin = new Client();
    const { id } = await admin.signUp("Admin2");
    await makeAdmin(id);
    const list = await a.json(`/api/loanwords/search?q=${term}`);
    const c = list.body.discussion.comments[0];
    const r = await admin.json(`/api/admin/comments/${c.id}/promote`, {
      method: "POST",
      json: { word: term, meaning: "Sinov ma’nosi", status: "VERIFIED", alternatives: [{ text: "muqobil bir" }] },
    });
    expect(r.status).toBe(200);
    const found = await new Client().json(`/api/loanwords/search?q=${term}`);
    expect(found.body.exact.status).toBe("VERIFIED");
    expect(found.body.exact.origin).toBe("COMMUNITY");
    expect(found.body.discussion.comments.length).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { action: "comment.promote", actorId: id } })).toBe(1);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
