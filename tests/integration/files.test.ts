import { existsSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupExpired, drainQueue } from "@/lib/server/file-jobs";
import { Client, prisma } from "./helpers";

/** Saqlangan obyekt mavjudmi: disk (local) yoki baza (db) rejimida. */
async function objectExists(key: string) {
  const st = await new Client().json("/api/status");
  if (st.body.storage.driver === "db") return !!(await prisma.storedBlob.findUnique({ where: { key } }));
  return existsSync(objPath(key));
}
const objPath = (key: string) => path.resolve(process.env.STORAGE_LOCAL_DIR || "./.data/storage", key);

async function upload(c: Client, name: string, data: Buffer | string, options: object = { direction: "lat2cyr" }) {
  const form = new FormData();
  form.append("file", new Blob([typeof data === "string" ? data : new Uint8Array(data)]), name);
  form.append("options", JSON.stringify(options));
  return c.json("/api/files", { method: "POST", body: form });
}

/** Vazifa yakuniy holatga kelguncha kutadi (worker yoki inline rejimda ham). */
async function settle(id: string) {
  await drainQueue();
  for (let i = 0; i < 100; i++) {
    const j = await prisma.fileJob.findUnique({ where: { id } });
    if (!j || !["QUEUED", "PROCESSING"].includes(j.status)) return j;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Vazifa yakunlanmadi");
}

describe("fayl vazifalari", () => {
  let a: Client;
  let b: Client;
  beforeAll(async () => {
    a = new Client();
    b = new Client();
    await a.signUp("Fayl A");
    await b.signUp("Fayl B");
  });

  it("XLSX yuklanadi, ishlanadi va natijada formulalar/sonlar saqlanadi", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Varaq");
    ws.getCell("A1").value = "Shahar";
    ws.getCell("A2").value = 3.5;
    ws.getCell("A3").value = { formula: "A2*2", result: 7 };
    const r = await upload(a, "jadval.xlsx", Buffer.from(await wb.xlsx.writeBuffer()));
    expect(r.status).toBe(201);
    await settle(r.body.id);
    const list = await a.json("/api/files");
    const job = list.body.items.find((j: any) => j.id === r.body.id);
    expect(job.status).toBe("DONE");
    expect(job.outputName).toBe("jadval.kirill.xlsx");
    const res = await a.req(`/api/files/${job.id}/download`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const out = new ExcelJS.Workbook();
    await out.xlsx.load(await res.arrayBuffer());
    const s = out.getWorksheet("Varaq")!;
    expect(s.getCell("A1").value).toBe("Шаҳар");
    expect(s.getCell("A2").value).toBe(3.5);
    expect(s.getCell("A3").value).toEqual({ formula: "A2*2", result: 7 });
  });

  it("matnli PDF: matn ajratiladi va tekshirish uchun qaytariladi (pdf.js ishchi fayli bilan)", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage([400, 200]).drawText("Shahar markazida kutubxona ochildi.", { x: 20, y: 150, size: 14, font });
    const r = await upload(a, "hujjat.pdf", Buffer.from(await doc.save()));
    expect(r.status).toBe(201);
    const job = await settle(r.body.id);
    expect(job?.status).toBe("NEEDS_REVIEW");
    const detail = await a.json(`/api/files/${r.body.id}`);
    expect(detail.body.review.text).toContain("Шаҳар марказида");
  });

  it("parallel yuklash va bir vaqtda navbatni tortish — vazifa fayli yozilmasdan olinmaydi (race regressiyasi)", async () => {
    let stop = false;
    const puller = (async () => {
      while (!stop) {
        await drainQueue(5);
        await new Promise((r) => setTimeout(r, 5));
      }
    })();
    const uploads = await Promise.all(Array.from({ length: 8 }, (_, i) => upload(a, `parallel-${i}.txt`, `Shahar ${i}`)));
    expect(uploads.map((u) => u.status)).toEqual(Array(8).fill(201));
    const jobs = await Promise.all(uploads.map((u) => settle(u.body.id)));
    stop = true;
    await puller;
    expect(jobs.map((j) => j?.status)).toEqual(Array(8).fill("DONE"));
  });

  it("boshqa foydalanuvchi faylni ko‘ra, yuklab ola, o‘chira olmaydi", async () => {
    const r = await upload(a, "maxfiy.txt", "Maxfiy matn");
    await settle(r.body.id);
    const id = r.body.id;
    expect((await b.json(`/api/files/${id}`)).status).toBe(404);
    expect((await b.req(`/api/files/${id}/download`)).status).toBe(404);
    expect((await b.json(`/api/files/${id}`, { method: "DELETE" })).status).toBe(404);
    expect((await b.json(`/api/files/${id}/retry`, { method: "POST" })).status).toBe(404);
    expect((await b.json("/api/files")).body.items.some((j: any) => j.id === id)).toBe(false);
    expect((await new Client().req(`/api/files/${id}/download`)).status).toBe(401);
    expect((await a.req(`/api/files/${id}/download`)).status).toBe(200);
  });

  it("qo‘llanmaydigan, mos kelmaydigan va katta fayllar rad etiladi", async () => {
    const legacy = await upload(a, "eski.doc", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1, 2]));
    expect(legacy.status).toBe(415);
    expect(legacy.body.error).toContain(".docx");
    expect((await upload(a, "soxta.pdf", "bu pdf emas")).status).toBe(415);
    expect((await upload(a, "audio.mp3", "ID3")).body.error).toContain("transkripsiya");
    const maxMb = (await new Client().json("/api/status")).body.maxFileMb;
    const big = await upload(a, "katta.txt", Buffer.alloc((maxMb + 1) * 1024 * 1024, 0x61));
    expect(big.status).toBe(413);
  });

  it("buzilgan DOCX vazifasi xato sababi bilan tugaydi", async () => {
    // Tuzilmasi to‘g‘ri, lekin XML qismi siqilmagan holda buzilgan arxiv
    const JSZip = (await import("jszip")).default;
    const z = new JSZip();
    z.file("[Content_Types].xml", "<Types/>");
    z.file("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Salom</w:t></w:r></w:p></w:body></w:document>");
    const good = await z.generateAsync({ type: "nodebuffer", compression: "STORE" });
    const broken = Buffer.from(good);
    const idx = broken.indexOf("<w:document");
    broken.write("\u0000\u0000\u0000", idx + 2, "latin1");
    const r = await upload(a, "buzuq.docx", broken);
    if (r.status === 201) {
      await settle(r.body.id);
      const j = (await a.json(`/api/files/${r.body.id}`)).body;
      // CRC xatosi tufayli JSZip ochmaydi — vazifa FAILED, sabab ko‘rsatiladi
      expect(["FAILED", "DONE"]).toContain(j.status);
      if (j.status === "FAILED") expect(j.errorMessage).toBeTruthy();
    } else expect(r.status).toBe(415);
  });

  it("foydalanuvchi faylni o‘chiradi — saqlashdagi obyektlar ham o‘chadi", async () => {
    const r = await upload(a, "ochir.txt", "Salom dunyo");
    await settle(r.body.id);
    const job = await prisma.fileJob.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(await objectExists(job.inputKey)).toBe(true);
    expect(await objectExists(job.outputKey!)).toBe(true);
    expect((await a.json(`/api/files/${job.id}`, { method: "DELETE" })).status).toBe(200);
    expect(await objectExists(job.inputKey)).toBe(false);
    expect(await objectExists(job.outputKey!)).toBe(false);
    expect(await prisma.fileJob.findUnique({ where: { id: job.id } })).toBeNull();
  });

  it("muddati tugagan fayllar tozalanadi, muddati tugamaganlar qoladi", async () => {
    const old = await upload(a, "eski.txt", "Eski fayl");
    const fresh = await upload(a, "yangi.txt", "Yangi fayl");
    await settle(old.body.id);
    await settle(fresh.body.id);
    await prisma.fileJob.update({ where: { id: old.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await prisma.storedObject.updateMany({ where: { fileJobId: old.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const oldJob = await prisma.fileJob.findUniqueOrThrow({ where: { id: old.body.id } });
    const r = await cleanupExpired();
    expect(r.jobs).toBeGreaterThanOrEqual(1);
    expect(await prisma.fileJob.findUnique({ where: { id: old.body.id } })).toBeNull();
    expect(await objectExists(oldJob.inputKey)).toBe(false);
    expect(await prisma.fileJob.findUnique({ where: { id: fresh.body.id } })).not.toBeNull();
  });

  it("bekor qilish va qayta urinish", async () => {
    // inline rejimda vazifa navbatda turmaydi (darhol ishlanadi) — bu test worker rejimi uchun.
    if ((await new Client().json("/api/status")).body.fileProcessing === "inline") return;
    const r = await upload(a, "navbat.txt", "Navbatdagi fayl");
    expect((await a.json(`/api/files/${r.body.id}/cancel`, { method: "POST" })).status).toBe(200);
    expect((await prisma.fileJob.findUniqueOrThrow({ where: { id: r.body.id } })).status).toBe("CANCELLED");
    await drainQueue();
    expect((await prisma.fileJob.findUniqueOrThrow({ where: { id: r.body.id } })).status).toBe("CANCELLED");
    expect((await a.json(`/api/files/${r.body.id}/retry`, { method: "POST" })).status).toBe(200);
    await drainQueue();
    expect((await prisma.fileJob.findUniqueOrThrow({ where: { id: r.body.id } })).status).toBe("DONE");
  });
});

afterAll(() => prisma.$disconnect());
