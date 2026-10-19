/**
 * OCR (rasmdan matn ajratish) provayderi. Hozircha yagona variant — serverda o‘rnatilgan
 * Tesseract CLI (bepul, matn tashqi xizmatga yuborilmaydi). Sozlanmagan bo‘lsa, natija
 * to‘qib chiqarilmaydi — "Xizmat ulanmagan" holati qaytadi.
 */
import { execFile, spawn, spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export interface OcrStatus {
  connected: boolean;
  provider: string | null;
  message: string;
  /** Skanerlangan PDF uchun sahifalarni rasmga aylantirish (pdftoppm) mavjudmi */
  pdf: boolean;
}

let cached: OcrStatus | null = null;

export function ocrStatus(): OcrStatus {
  if (cached) return cached;
  if (process.env.OCR_PROVIDER !== "tesseract") {
    cached = { connected: false, provider: null, message: "OCR xizmati ulanmagan (OCR_PROVIDER sozlanmagan).", pdf: false };
    return cached;
  }
  const bin = process.env.TESSERACT_PATH || "tesseract";
  const r = spawnSync(bin, ["--list-langs"], { encoding: "utf8", timeout: 5000 });
  if (r.error || r.status !== 0) {
    cached = { connected: false, provider: "tesseract", message: "Tesseract dasturi serverda topilmadi.", pdf: false };
    return cached;
  }
  const langs = (process.env.TESSERACT_LANGS || "uzb+uzb_cyrl").split("+");
  const missing = langs.filter((l) => !r.stdout.split(/\s+/).includes(l));
  const pdf = spawnSync(process.env.PDFTOPPM_PATH || "pdftoppm", ["-v"], { timeout: 5000 }).status === 0;
  cached = missing.length
    ? { connected: false, provider: "tesseract", message: `Tesseract til paketlari o‘rnatilmagan: ${missing.join(", ")}.`, pdf: false }
    : {
        connected: true,
        provider: "tesseract",
        message: `Tesseract (${langs.join(", ")}) — server ichida ishlaydi, fayl tashqariga yuborilmaydi.${pdf ? "" : " Skanerlangan PDF uchun pdftoppm (poppler-utils) o‘rnatilmagan."}`,
        pdf,
      };
  return cached;
}

export async function runOcr(image: Buffer): Promise<string> {
  const st = ocrStatus();
  if (!st.connected) throw Object.assign(new Error(st.message), { code: "OCR_NOT_CONNECTED" });
  const bin = process.env.TESSERACT_PATH || "tesseract";
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ["stdin", "stdout", "-l", process.env.TESSERACT_LANGS || "uzb+uzb_cyrl"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => p.kill("SIGKILL"), 120_000);
    p.stdout.on("data", (d) => (out += d.toString("utf8")));
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error("OCR bajarilmadi."));
    });
    p.stdin.end(image);
  });
}

export const OCR_PDF_MAX_PAGES = Number(process.env.OCR_PDF_MAX_PAGES ?? 30);

/**
 * Skanerlangan PDF: sahifalar vaqtinchalik papkada PNG’ga aylantiriladi (pdftoppm), har biri
 * Tesseract bilan o‘qiladi, so‘ng papka darhol o‘chiriladi.
 */
export async function runPdfOcr(pdf: Buffer, pages: number): Promise<{ text: string; pagesRead: number }> {
  const st = ocrStatus();
  if (!st.connected || !st.pdf) throw Object.assign(new Error("Skanerlangan PDF uchun OCR ulanmagan."), { code: "OCR_NOT_CONNECTED" });
  const count = Math.min(pages, OCR_PDF_MAX_PAGES);
  const dir = await mkdtemp(path.join(tmpdir(), "ozbegim-ocr-"));
  try {
    const src = path.join(dir, "kirish.pdf");
    await writeFile(src, pdf, { mode: 0o600 });
    await execFileP(process.env.PDFTOPPM_PATH || "pdftoppm", ["-r", "200", "-png", "-f", "1", "-l", String(count), src, path.join(dir, "sahifa")], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    const images = (await readdir(dir)).filter((f) => f.endsWith(".png")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const texts: string[] = [];
    for (const img of images) texts.push((await runOcr(await readFile(path.join(dir, img)))).trim());
    return { text: texts.join("\n\n"), pagesRead: images.length };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
