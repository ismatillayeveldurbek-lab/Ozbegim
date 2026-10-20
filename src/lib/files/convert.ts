/**
 * Fayl konvertatsiyasi dispetcheri: formatga qarab mos ishlovchini chaqiradi.
 * Asl faylga tegilmaydi — natija har doim yangi bufer.
 */
import type { ApostropheStyle } from "@/lib/uz/alphabet";
import type { ProtectOptions } from "@/lib/uz/protect";
import { detectScript } from "@/lib/uz/script";
import { transliterate, type Direction } from "@/lib/uz/translit";
import { decodeText, FileRejectError, type FileFormat } from "./detect";
import { convertOffice, officeSampleText } from "./formats/office";
import { extractPdfText } from "./formats/pdf";
import { convertCsv, convertSrt, convertVtt } from "./formats/text-formats";
import { ocrStatus, runOcr, runPdfOcr } from "./ocr";

export interface ConvertOptions {
  direction: "auto" | Direction;
  apostrophe?: ApostropheStyle;
  protect?: ProtectOptions;
}

export type ConvertOutcome =
  | { kind: "file"; data: Buffer; fileName: string; mime: string; warnings: string[]; direction: Direction }
  | { kind: "review"; originalText: string; text: string; warnings: string[]; direction: Direction; note: string };

const MIME: Record<string, string> = {
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  srt: "application/x-subrip; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function outputName(original: string, direction: Direction, ext?: string): string {
  const m = /^(.*?)(\.[^.]+)?$/.exec(original.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_"))!;
  const base = (m[1] || "fayl").slice(0, 120);
  return `${base}.${direction === "lat2cyr" ? "kirill" : "lotin"}${ext ? "." + ext : m[2] ?? ""}`;
}

function resolveDirection(dir: ConvertOptions["direction"], sample: string): Direction {
  if (dir !== "auto") return dir;
  const s = detectScript(sample);
  return s.cyrillicLetters > s.latinLetters ? "cyr2lat" : "lat2cyr";
}

export async function convertFile(format: FileFormat, name: string, buf: Buffer, opts: ConvertOptions): Promise<ConvertOutcome> {
  const warnings: string[] = [];
  switch (format) {
    case "txt":
    case "csv":
    case "srt":
    case "vtt": {
      const { text, bom, encoding } = decodeText(buf);
      if (encoding !== "utf-8") warnings.push("Fayl Windows-1251 kodlashda deb aniqlandi; natija UTF-8 kodlashda saqlandi.");
      const direction = resolveDirection(opts.direction, text.slice(0, 50_000));
      const o = { direction, apostrophe: opts.apostrophe, protect: opts.protect };
      let out: string;
      if (format === "csv") out = convertCsv(text, o).text;
      else if (format === "srt") out = convertSrt(text, o).text;
      else if (format === "vtt") out = convertVtt(text, o).text;
      else out = transliterate(text, o).text;
      const data = Buffer.concat([bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(out, "utf8")]);
      return { kind: "file", data, fileName: outputName(name, direction), mime: MIME[format], warnings, direction };
    }
    case "docx":
    case "xlsx":
    case "pptx": {
      const sample = await officeSampleText(format, buf);
      const direction = resolveDirection(opts.direction, sample);
      const r = await convertOffice(format, buf, { direction, apostrophe: opts.apostrophe, protect: opts.protect });
      if (!r.changedElements) warnings.push("Faylda o‘giriladigan matn topilmadi.");
      return { kind: "file", data: r.data, fileName: outputName(name, direction), mime: MIME[format], warnings: [...warnings, ...r.warnings], direction };
    }
    case "pdf": {
      const r = await extractPdfText(buf).catch((e: Error & { code?: string }) => {
        if (e.code === "PDF_PAGES") throw new FileRejectError("PDF_PAGES", e.message);
        // Fayl mazmuni emas, faqat xato turi loglanadi.
        console.error("[pdf] o‘qib bo‘lmadi:", e?.name, e?.message?.slice(0, 120));
        throw new FileRejectError("CORRUPT", "PDF faylni o‘qib bo‘lmadi (buzilgan yoki parol bilan himoyalangan).");
      });
      if (r.scanned) {
        const st = ocrStatus();
        if (!st.connected || !st.pdf)
          throw new FileRejectError(
            "OCR_NOT_CONNECTED",
            "PDF ichida matn qatlami yo‘q (skanerlangan hujjat). Skanerlangan PDF uchun OCR kerak — bu format uchun OCR xizmati ulanmagan.",
          );
        const o = await runPdfOcr(buf, r.pages).catch(() => {
          throw new FileRejectError("OCR_FAILED", "Skanerlangan PDF’ni OCR orqali o‘qib bo‘lmadi.");
        });
        if (!/\p{L}/u.test(o.text)) throw new FileRejectError("OCR_FAILED", "OCR sahifalarda matn topmadi.");
        const direction = resolveDirection(opts.direction, o.text);
        const warnings = ["Skanerlangan PDF matni OCR orqali ajratildi; xatolar bo‘lishi mumkin. Asl joylashuv saqlanmaydi."];
        if (r.pages > o.pagesRead) warnings.push(`Faqat dastlabki ${o.pagesRead} sahifa o‘qildi (jami ${r.pages}).`);
        return {
          kind: "review",
          originalText: o.text,
          text: transliterate(o.text, { direction, apostrophe: opts.apostrophe, protect: opts.protect }).text,
          warnings,
          direction,
          note: "OCR natijasini albatta tekshiring va tahrirlang, so‘ng TXT yoki DOCX ko‘rinishida yuklab oling.",
        };
      }
      const direction = resolveDirection(opts.direction, r.text);
      return {
        kind: "review",
        originalText: r.text,
        text: transliterate(r.text, { direction, apostrophe: opts.apostrophe, protect: opts.protect }).text,
        warnings: [`${r.pages} sahifadan matn ajratildi. Asl joylashuv (ustunlar, jadvallar, rasmlar) saqlanmaydi.`],
        direction,
        note: "Matnni tekshirib, kerak bo‘lsa tahrirlang va TXT yoki DOCX ko‘rinishida yuklab oling.",
      };
    }
    case "png":
    case "jpg": {
      const raw = await runOcr(buf).catch((e: Error & { code?: string }) => {
        throw new FileRejectError(e.code === "OCR_NOT_CONNECTED" ? "OCR_NOT_CONNECTED" : "OCR_FAILED", e.message);
      });
      const direction = resolveDirection(opts.direction, raw);
      return {
        kind: "review",
        originalText: raw,
        text: transliterate(raw, { direction, apostrophe: opts.apostrophe, protect: opts.protect }).text,
        warnings: ["Rasmdan matn OCR orqali ajratildi; xatolar bo‘lishi mumkin. Rasmdagi yozuvning o‘zi almashtirilmaydi."],
        direction,
        note: "OCR natijasini albatta tekshiring.",
      };
    }
  }
}
