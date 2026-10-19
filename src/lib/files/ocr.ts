/**
 * OCR (rasmdan matn ajratish) provayderi. Hozircha yagona variant — serverda o‘rnatilgan
 * Tesseract CLI (bepul, matn tashqi xizmatga yuborilmaydi). Sozlanmagan bo‘lsa, natija
 * to‘qib chiqarilmaydi — "Xizmat ulanmagan" holati qaytadi.
 */
import { spawn, spawnSync } from "node:child_process";

export interface OcrStatus {
  connected: boolean;
  provider: string | null;
  message: string;
}

let cached: OcrStatus | null = null;

export function ocrStatus(): OcrStatus {
  if (cached) return cached;
  if (process.env.OCR_PROVIDER !== "tesseract") {
    cached = { connected: false, provider: null, message: "OCR xizmati ulanmagan (OCR_PROVIDER sozlanmagan)." };
    return cached;
  }
  const bin = process.env.TESSERACT_PATH || "tesseract";
  const r = spawnSync(bin, ["--list-langs"], { encoding: "utf8", timeout: 5000 });
  if (r.error || r.status !== 0) {
    cached = { connected: false, provider: "tesseract", message: "Tesseract dasturi serverda topilmadi." };
    return cached;
  }
  const langs = (process.env.TESSERACT_LANGS || "uzb+uzb_cyrl").split("+");
  const missing = langs.filter((l) => !r.stdout.split(/\s+/).includes(l));
  cached = missing.length
    ? { connected: false, provider: "tesseract", message: `Tesseract til paketlari o‘rnatilmagan: ${missing.join(", ")}.` }
    : { connected: true, provider: "tesseract", message: `Tesseract (${langs.join(", ")}) — server ichida ishlaydi, fayl tashqariga yuborilmaydi.` };
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
