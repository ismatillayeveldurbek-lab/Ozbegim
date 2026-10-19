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
});
