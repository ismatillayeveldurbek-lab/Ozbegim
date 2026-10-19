import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Tesseract o‘rnatilmagan muhitda test o‘tkazib yuboriladi (natija to‘qilmaydi).
const hasTesseract = spawnSync("tesseract", ["--version"]).status === 0;

describe.skipIf(!hasTesseract)("OCR (Tesseract)", () => {
  it("rasmdan matn ajratiladi va tekshirish uchun qaytariladi", async () => {
    process.env.OCR_PROVIDER = "tesseract";
    const { convertFile } = await import("@/lib/files/convert");
    const r = await convertFile("png", "rasm.png", readFileSync("tests/fixtures/ocr-sample.png"), { direction: "lat2cyr" });
    expect(r.kind).toBe("review");
    if (r.kind !== "review") return;
    expect(r.originalText).toMatch(/Shahar markazida/);
    expect(r.text).toMatch(/Шаҳар марказида/);
    expect(r.warnings[0]).toContain("OCR");
  });

  it("skanerlangan PDF (faqat rasm) sahifalari OCR qilinadi", async () => {
    process.env.OCR_PROVIDER = "tesseract";
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const png = await doc.embedPng(readFileSync("tests/fixtures/ocr-sample.png"));
    for (let i = 0; i < 2; i++) doc.addPage([900, 200]).drawImage(png, { x: 0, y: 0, width: 900, height: 200 });
    const { convertFile } = await import("@/lib/files/convert");
    const r = await convertFile("pdf", "skan.pdf", Buffer.from(await doc.save()), { direction: "lat2cyr" });
    expect(r.kind).toBe("review");
    if (r.kind !== "review") return;
    expect(r.originalText.match(/Shahar markazida/g)).toHaveLength(2);
    expect(r.text).toContain("Шаҳар марказида");
  });
});
