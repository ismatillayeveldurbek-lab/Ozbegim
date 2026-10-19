import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commit } from "@/lib/server/importer";
import { normalizeKey } from "@/lib/uz/normalize";
import { Client, makeAdmin, prisma } from "./helpers";

const tag = () => randomUUID().replace(/[^a-z]/g, "").slice(0, 6);

async function uploadImport(c: Client, name: string, data: Buffer | string, target: string) {
  const form = new FormData();
  form.append("file", new Blob([typeof data === "string" ? data : new Uint8Array(data)]), name);
  form.append("target", target);
  return c.json("/api/admin/import", { method: "POST", body: form });
}

describe("admin importi", () => {
  let admin: Client;
  let adminId: string;
  beforeAll(async () => {
    admin = new Client();
    adminId = (await admin.signUp("Import admin")).id;
    await makeAdmin(adminId);
  });

  it("oddiy foydalanuvchi import qila olmaydi", async () => {
    const u = new Client();
    await u.signUp();
    expect((await uploadImport(u, "a.csv", "word\nx", "loanword")).status).toBe(403);
  });

  it("xatolar satr raqami bilan, takrorlar va mavjud yozuvlar aniqlanadi; skip/update qoidasi", async () => {
    const t = tag();
    // Avval bitta yozuv bazada bo‘lsin
    expect((await admin.json("/api/admin/entries/loanword", { method: "POST", json: { word: `menejer${t}`, meaning: "eski", status: "VERIFIED" } })).status).toBe(201);
    const csv = [
      "word;alternatives;meaning;status",
      `menejer${t};boshqaruvchi;yangi ma’no;tasdiqlangan`,
      `dedlayn${t};"muddat; so‘nggi muddat";Ishni topshirish muddati;`,
      `;bo‘sh so‘z;;`,
      `fidbek${t};fikr-mulohaza;izoh;noma’lum holat`,
      `DEDLAYN${t};takror;;`,
    ].join("\n");
    const up = await uploadImport(admin, "lugat.csv", csv, "loanword");
    expect(up.status).toBe(201);
    expect(up.body.sheets[0].headers).toEqual(["word", "alternatives", "meaning", "status"]);
    const mapping = { word: 0, alternatives: 1, meaning: 2, status: 3 };
    const pv = await admin.json(`/api/admin/import/${up.body.id}/preview`, { method: "POST", json: { sheetName: "CSV", mapping } });
    expect(pv.status).toBe(200);
    expect(pv.body.errors.map((e: any) => e.row)).toEqual([4, 5]);
    expect(pv.body.errors[1].message).toContain("Holat noto‘g‘ri");
    expect(pv.body.duplicatesInFile).toMatchObject([{ display: `dedlayn${t}`, rows: [3, 6] }]);
    expect(pv.body.existing.map((e: any) => e.display)).toEqual([`menejer${t}`]);
    // Xato bo‘lsa va o‘tkazib yuborish tanlanmasa — rad etiladi, baza o‘zgarmaydi
    const refused = await admin.json(`/api/admin/import/${up.body.id}/commit`, { method: "POST", json: { duplicateRule: "skip" } });
    expect(refused.status).toBe(400);
    expect(await prisma.loanword.count({ where: { key: normalizeKey(`dedlayn${t}`) } })).toBe(0);
    const done = await admin.json(`/api/admin/import/${up.body.id}/commit`, { method: "POST", json: { duplicateRule: "skip", skipInvalid: true } });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ created: 1, updated: 0, skipped: 1, invalidSkipped: 2, duplicatesInFile: 1 });
    expect((await prisma.loanword.findUniqueOrThrow({ where: { key: normalizeKey(`menejer${t}`) } })).meaning).toBe("eski");
    const d = await prisma.loanword.findUniqueOrThrow({ where: { key: normalizeKey(`dedlayn${t}`) }, include: { alternatives: true } });
    expect(d.alternatives.map((a) => a.text)).toEqual(["muddat", "so‘nggi muddat"]);
    expect(d.status).toBe("VERIFIED");
    expect(d.origin).toBe("OFFICIAL");
    // Takroriy commit mumkin emas
    expect((await admin.json(`/api/admin/import/${up.body.id}/commit`, { method: "POST", json: { duplicateRule: "skip" } })).status).toBe(409);

    // Yangilash qoidasi
    const up2 = await uploadImport(admin, "l2.csv", `word;meaning\nmenejer${t};yangilangan`, "loanword");
    await admin.json(`/api/admin/import/${up2.body.id}/preview`, { method: "POST", json: { sheetName: "CSV", mapping: { word: 0, meaning: 1 } } });
    const r2 = await admin.json(`/api/admin/import/${up2.body.id}/commit`, { method: "POST", json: { duplicateRule: "update" } });
    expect(r2.body).toMatchObject({ created: 0, updated: 1 });
    expect((await prisma.loanword.findUniqueOrThrow({ where: { key: normalizeKey(`menejer${t}`) } })).meaning).toBe("yangilangan");
  });

  it("XLSX: varaq tanlash va bir iboraning bir nechta ma’nosi", async () => {
    const t = tag();
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Bo‘sh").addRow(["x"]);
    const ws = wb.addWorksheet("Iboralar");
    ws.addRow(["ibora", "ma’no", "misol"]);
    ws.addRow([`boshini qotirmoq ${t}`, "O‘ylamoq", "misol 1"]);
    ws.addRow([`boshini qotirmoq ${t}`, "Chalg‘itmoq", ""]);
    const up = await uploadImport(admin, "iboralar.xlsx", Buffer.from(await wb.xlsx.writeBuffer()), "idiom");
    expect(up.body.sheets.map((s: any) => s.name)).toEqual(["Bo‘sh", "Iboralar"]);
    await admin.json(`/api/admin/import/${up.body.id}/preview`, { method: "POST", json: { sheetName: "Iboralar", mapping: { phrase: 0, meaning: 1, example: 2 } } });
    const r = await admin.json(`/api/admin/import/${up.body.id}/commit`, { method: "POST", json: { duplicateRule: "skip" } });
    expect(r.body.created).toBe(1);
    const found = await new Client().json(`/api/idioms/search?q=${encodeURIComponent(`boshini qotirmoq ${t}`)}`);
    expect(found.body.exact[0].senses.map((s: any) => s.meaning)).toEqual(["O‘ylamoq", "Chalg‘itmoq"]);
  });

  it("xatoli import bazani yarim holatda qoldirmaydi (tranzaksiya qaytariladi)", async () => {
    const t = tag();
    const good = { key: normalizeKey(`yaxshi ${t}`), rows: [2], display: `yaxshi ${t}`, data: { phrase: `yaxshi ${t}`, status: "VERIFIED", origin: "OFFICIAL", tags: [], source: null, senses: [{ meaning: "m", example: null, synonyms: [] }] } };
    const bad = { key: "x", rows: [3], display: "buzuq", data: { phrase: "", status: "VERIFIED", origin: "OFFICIAL", tags: [], source: null, senses: [] } };
    await expect(commit("idiom", { total: 2, entries: [good, bad], errors: [], duplicatesInFile: [], existing: [] }, "skip", adminId, "test")).rejects.toThrow(/3-qator/);
    expect(await prisma.idiom.count({ where: { key: good.key } })).toBe(0);
  });

  it("eksport CSV/XLSX’da formula injection’ga qarshi himoya", async () => {
    const t = tag();
    await admin.json("/api/admin/entries/spelling", { method: "POST", json: { wrong: `=HYPERLINK("x")${t}`, correct: "+1+2", note: "@SUM(A1)", status: "VERIFIED" } });
    const csv = await (await admin.req("/api/admin/export?target=spelling&format=csv")).text();
    const line = csv.split("\r\n").find((l) => l.includes(t))!;
    expect(line.startsWith(`"'=HYPERLINK`)).toBe(true);
    expect(line).toContain(",'+1+2,'@SUM(A1),");
    const res = await admin.req("/api/admin/export?target=spelling&format=xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    const ws = wb.worksheets[0];
    let found = false;
    ws.eachRow((r) => {
      const v = String(r.getCell(1).value);
      if (v.includes(t)) {
        found = true;
        expect(v.startsWith("'=")).toBe(true);
        expect(r.getCell(1).type).not.toBe(ExcelJS.ValueType.Formula);
      }
    });
    expect(found).toBe(true);
  });
});

describe("shaxsiy lug‘at va tarix", () => {
  let a: Client;
  let b: Client;
  beforeAll(async () => {
    a = new Client();
    b = new Client();
    await a.signUp();
    await b.signUp();
  });

  it("boshqa foydalanuvchi shaxsiy yozuvni ocha, o‘zgartira, o‘chira, eksport qila olmaydi", async () => {
    const r = await a.json("/api/personal/items", { method: "POST", json: { kind: "WORD", term: "maxfiy so‘z", note: "shaxsiy qayd", tags: ["test"] } });
    expect(r.status).toBe(201);
    const id = r.body.id;
    expect((await b.json(`/api/personal/items/${id}`)).status).toBe(404);
    expect((await b.json(`/api/personal/items/${id}`, { method: "PATCH", json: { note: "buzildi" } })).status).toBe(404);
    expect((await b.json(`/api/personal/items/${id}`, { method: "DELETE" })).status).toBe(404);
    expect((await b.json("/api/personal/items")).body.items).toHaveLength(0);
    const exp = await b.req("/api/personal/export", { method: "POST", json: { ids: [id], format: "json" } });
    expect(JSON.parse(await exp.text())).toEqual([]);
    expect((await new Client().json("/api/personal/items")).status).toBe(401);
    const own = await a.json("/api/personal/items?q=maxfiy");
    expect(own.body.items[0].note).toBe("shaxsiy qayd");
    expect(own.body.tags).toEqual(["test"]);
  });

  it("boshqa foydalanuvchining papkasiga yozuv qo‘shib bo‘lmaydi", async () => {
    const f = await a.json("/api/personal/folders", { method: "POST", json: { name: "Mening papkam" } });
    expect((await b.json("/api/personal/items", { method: "POST", json: { kind: "WORD", term: "x", folderId: f.body.id } })).status).toBe(404);
  });

  it("tarix faqat rozilik bilan; meta rejimida matn saqlanmaydi; o‘chirish", async () => {
    const off = await a.json("/api/history", { method: "POST", json: { type: "convert", summary: "s", inputText: "maxfiy matn" } });
    expect(off.status).toBe(409);
    await a.json("/api/profile", { method: "PATCH", json: { historyMode: "meta" } });
    await a.json("/api/history", { method: "POST", json: { type: "convert", summary: "meta", inputText: "maxfiy matn" } });
    let h = await a.json("/api/history");
    expect(h.body.items[0].inputText).toBeNull();
    await a.json("/api/profile", { method: "PATCH", json: { historyMode: "full" } });
    await a.json("/api/history", { method: "POST", json: { type: "convert", summary: "full", inputText: "ochiq matn" } });
    h = await a.json("/api/history");
    expect(h.body.items[0].inputText).toBe("ochiq matn");
    expect((await b.json(`/api/history/${h.body.items[0].id}`, { method: "DELETE" })).status).toBe(404);
    expect((await a.json(`/api/history/${h.body.items[0].id}`, { method: "DELETE" })).status).toBe(200);
    expect((await a.json("/api/history", { method: "DELETE" })).body.deleted).toBe(1);
  });
});

afterAll(() => prisma.$disconnect());
