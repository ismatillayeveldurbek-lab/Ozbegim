/**
 * PDF’ni asl ko‘rinishini saqlab o‘girish: sahifadagi matn chizish buyruqlari olib tashlanadi va o‘girilgan matn
 * xuddi o‘sha joyga, o‘lcham, burilish, rang va kenglikda (siqish orqali) qayta yoziladi. Rasmlar, chiziqlar,
 * jadval ramkalari va fonlar o‘zgarmaydi. Asl shrift o‘rniga o‘lchami mos Liberation shriftlari ishlatiladi
 * (Times → Liberation Serif, Arial → Liberation Sans, Calibri → Carlito, Courier → Liberation Mono), chunki PDF ichidagi shriftlarda
 * odatda faqat hujjatda ishlatilgan harflar bo‘ladi (kirill/lotin harflari yo‘q).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  beginText,
  decodePDFRawStream,
  endText,
  PDFArray,
  PDFDict,
  PDFDocument,
  type PDFFont,
  PDFName,
  type PDFObject,
  type PDFPage,
  PDFRawStream,
  PDFRef,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSqueeze,
  setFillingRgbColor,
  setFontAndSize,
  setTextMatrix,
  showText,
} from "pdf-lib";
import { transliterate, type TranslitOptions } from "@/lib/uz/translit";

type Opts = Omit<TranslitOptions, "withTokens">;

// ───────────── Kontent oqimidan matn chizish buyruqlarini olib tashlash ─────────────

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);
const SHOW_OPS = new Set(["Tj", "TJ", "'", '"']);

/**
 * PDF kontent oqimidagi Tj/TJ/'/" buyruqlarini (operandlari bilan) olib tashlaydi; qolgan baytlar o‘zgarmaydi.
 * Satrlar, massivlar, lug‘atlar va ichki rasmlar (BI … ID … EI) to‘g‘ri o‘tkazib yuboriladi.
 */
export function stripTextShowing(src: Uint8Array): { bytes: Uint8Array; removed: number } {
  const keep: Array<[number, number]> = [];
  let pos = 0;
  let operandStart = -1;
  let depth = 0; // massiv/lug‘at ichidami
  let removed = 0;
  let copyFrom = 0;
  const n = src.length;

  const skipString = (i: number) => {
    let level = 1;
    i++;
    while (i < n && level > 0) {
      const c = src[i];
      if (c === 0x5c) i += 2;
      else {
        if (c === 0x28) level++;
        else if (c === 0x29) level--;
        i++;
      }
    }
    return i;
  };

  while (pos < n) {
    const c = src[pos];
    if (WS.has(c)) {
      pos++;
      continue;
    }
    if (c === 0x25) {
      while (pos < n && src[pos] !== 0x0a && src[pos] !== 0x0d) pos++;
      continue;
    }
    const tokStart = pos;
    let operator: string | null = null;
    if (c === 0x28) pos = skipString(pos);
    else if (c === 0x3c && src[pos + 1] === 0x3c) {
      depth++;
      pos += 2;
    } else if (c === 0x3e && src[pos + 1] === 0x3e) {
      depth--;
      pos += 2;
    } else if (c === 0x3c) {
      while (pos < n && src[pos] !== 0x3e) pos++;
      pos++;
    } else if (c === 0x5b) {
      depth++;
      pos++;
    } else if (c === 0x5d) {
      depth--;
      pos++;
    } else if (c === 0x2f) {
      pos++;
      while (pos < n && !WS.has(src[pos]) && !DELIM.has(src[pos])) pos++;
    } else {
      while (pos < n && !WS.has(src[pos]) && !DELIM.has(src[pos])) pos++;
      if (pos === tokStart) pos++; // kutilmagan belgi
      const word = String.fromCharCode(...src.subarray(tokStart, pos));
      if (depth === 0 && !/^[+\-.\d]/.test(word) && word !== "true" && word !== "false" && word !== "null") operator = word;
    }
    if (operandStart < 0) operandStart = tokStart;
    if (operator === null) continue;

    if (operator === "ID") {
      // Ichki rasm ma’lumoti: bitta bo‘shliqdan keyin "EI" gacha
      let i = pos + 1;
      while (i < n - 1 && !(WS.has(src[i - 1]) && src[i] === 0x45 && src[i + 1] === 0x49 && (i + 2 >= n || WS.has(src[i + 2])))) i++;
      pos = Math.min(n, i + 2);
    } else if (SHOW_OPS.has(operator)) {
      keep.push([copyFrom, operandStart]);
      copyFrom = pos;
      removed++;
    }
    operandStart = -1;
  }
  keep.push([copyFrom, n]);
  if (!removed) return { bytes: src, removed: 0 };
  const total = keep.reduce((s, [a, b]) => s + (b - a) + 1, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const [a, b] of keep) {
    out.set(src.subarray(a, b), o);
    o += b - a;
    out[o++] = 0x0a;
  }
  return { bytes: out, removed };
}

function decodeStream(stream: PDFObject | undefined): Uint8Array | null {
  if (!(stream instanceof PDFRawStream)) return null;
  try {
    return decodePDFRawStream(stream).decode();
  } catch {
    return null;
  }
}

/** Sahifa va uning shakl (Form XObject) oqimlaridan matnni olib tashlaydi. */
function stripPage(doc: PDFDocument, page: PDFPage, seenForms: Set<string>): boolean {
  const ctx = doc.context;
  const contents = page.node.get(PDFName.of("Contents"));
  const refs: PDFObject[] = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  const parts: Uint8Array[] = [];
  for (const r of refs) {
    const s = r instanceof PDFRef ? ctx.lookup(r) : r;
    const bytes = decodeStream(s);
    if (!bytes) return false;
    parts.push(bytes);
  }
  const joined = new Uint8Array(parts.reduce((a, p) => a + p.length + 1, 0));
  let o = 0;
  for (const p of parts) {
    joined.set(p, o);
    o += p.length;
    joined[o++] = 0x0a;
  }
  const { bytes } = stripTextShowing(joined);
  page.node.set(PDFName.of("Contents"), ctx.register(ctx.flateStream(bytes)));

  const stripForms = (resources: PDFObject | undefined) => {
    const res = resources instanceof PDFRef ? ctx.lookup(resources) : resources;
    if (!(res instanceof PDFDict)) return;
    const xobjs = res.lookup(PDFName.of("XObject"));
    if (!(xobjs instanceof PDFDict)) return;
    for (const [, ref] of xobjs.entries()) {
      if (!(ref instanceof PDFRef) || seenForms.has(ref.toString())) continue;
      const s = ctx.lookup(ref);
      if (!(s instanceof PDFRawStream) || s.dict.lookup(PDFName.of("Subtype"))?.toString() !== "/Form") continue;
      seenForms.add(ref.toString());
      const raw = decodeStream(s);
      if (!raw) continue;
      const stripped = stripTextShowing(raw);
      if (stripped.removed) {
        const dict = s.dict.clone(ctx);
        dict.delete(PDFName.of("Filter"));
        dict.delete(PDFName.of("DecodeParms"));
        dict.set(PDFName.of("Length"), ctx.obj(stripped.bytes.length));
        ctx.assign(ref, PDFRawStream.of(dict, stripped.bytes));
      }
      stripForms(s.dict.get(PDFName.of("Resources")));
    }
  };
  stripForms(page.node.Resources());
  return true;
}

// ───────────── Matn bo‘laklari, shrift va rang (pdf.js) ─────────────

interface TextPiece {
  str: string;
  transform: number[];
  width: number;
  font: { serif: boolean; mono: boolean; calibri: boolean; bold: boolean; italic: boolean };
  color: [number, number, number];
}

const hexToRgb = (h: string): [number, number, number] =>
  /^#[0-9a-f]{6}$/i.test(h) ? [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255] : [0, 0, 0];

async function readPieces(buf: Buffer): Promise<{ pages: TextPiece[][]; glyphs: number; unmapped: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const g = globalThis as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true, useSystemFonts: false, fontExtraProperties: true, stopAtErrors: false });
  const doc = await task.promise;
  const OPS = pdfjs.OPS as Record<string, number>;
  let glyphs = 0;
  let unmapped = 0;
  try {
    const pages: TextPiece[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const ops = await page.getOperatorList();
      // Rang: showText buyruqlari ketma-ketligi bo‘yicha (matn bo‘laklari bilan tartibi bir xil)
      const segs: Array<{ start: number; color: string }> = [];
      let joined = "";
      let color = "#000000";
      const stack: string[] = [];
      ops.fnArray.forEach((fn: number, i: number) => {
        const args = ops.argsArray[i] as unknown[];
        if (fn === OPS.save) stack.push(color);
        else if (fn === OPS.restore) color = stack.pop() ?? color;
        else if (fn === OPS.setFillRGBColor && typeof args[0] === "string") color = args[0];
        else if (fn === OPS.showText || fn === OPS.showSpacedText || fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText) {
          const list = (args[0] ?? []) as Array<{ unicode?: string; isSpace?: boolean } | number | null>;
          let t = "";
          for (const gl of list) {
            if (!gl || typeof gl === "number") continue;
            if (gl.isSpace || gl.unicode === " ") continue;
            glyphs++;
            if (!gl.unicode) unmapped++;
            t += gl.unicode ?? "";
          }
          segs.push({ start: joined.length, color });
          joined += t.replace(/\s+/g, "");
        }
      });
      const content = await page.getTextContent();
      const pieces: TextPiece[] = [];
      let cursor = 0;
      for (const item of content.items as Array<{ str?: string; transform?: number[]; width?: number; fontName?: string }>) {
        if (typeof item.str !== "string" || !item.str.trim() || !item.transform) continue;
        const key = item.str.replace(/\s+/g, "");
        const at = joined.indexOf(key, cursor);
        let c = segs.length ? segs[segs.length - 1].color : "#000000";
        if (at >= 0) {
          cursor = at + key.length;
          for (let k = segs.length - 1; k >= 0; k--)
            if (segs[k].start <= at) {
              c = segs[k].color;
              break;
            }
        }
        const f = item.fontName && page.commonObjs.has(item.fontName) ? (page.commonObjs.get(item.fontName) as { name?: string; isSerifFont?: boolean; isMonospace?: boolean }) : {};
        const name = (f.name ?? "").replace(/^[A-Z]{6}\+/, "");
        const style = content.styles[item.fontName ?? ""] as { fontFamily?: string } | undefined;
        pieces.push({
          str: item.str,
          transform: item.transform,
          width: item.width ?? 0,
          color: hexToRgb(c),
          font: {
            calibri: /calibri|carlito/i.test(name),
            mono: !!f.isMonospace || /mono|courier|consol/i.test(name) || style?.fontFamily === "monospace",
            // Nomdagi belgi ustun: "…Serif-Italic" kabi shriftlarda isSerifFont bayrog‘i ba’zan noto‘g‘ri
            serif: /sans|arial|helvetica|calibri|carlito|verdana|tahoma|segoe|roboto|open ?sans/i.test(name)
              ? false
              : /times|serif|roman|georgia|garamond|cambria|caladea|book|minion|palatino/i.test(name) || !!f.isSerifFont || style?.fontFamily === "serif",
            bold: /bold|black|heavy|semibold|demi/i.test(name),
            italic: /italic|oblique/i.test(name),
          },
        });
      }
      pages.push(pieces);
      page.cleanup();
    }
    return { pages, glyphs, unmapped };
  } finally {
    await task.destroy();
  }
}

// ───────────── Qayta yozish ─────────────

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const FONT_FILES = {
  serif: ["LiberationSerif-Regular", "LiberationSerif-Bold", "LiberationSerif-Italic", "LiberationSerif-BoldItalic"],
  sans: ["LiberationSans-Regular", "LiberationSans-Bold", "LiberationSans-Italic", "LiberationSans-BoldItalic"],
  calibri: ["Carlito-Regular", "Carlito-Bold", "Carlito-Italic", "Carlito-BoldItalic"],
  mono: ["LiberationMono-Regular", "LiberationMono-Regular", "LiberationMono-Regular", "LiberationMono-Regular"],
};

export class PdfLayoutUnsupported extends Error {}

/**
 * Har bir bo‘lak uchun egallashi mumkin bo‘lgan kenglik: bir qatordagi keyingi bo‘lak boshlanguncha
 * (oradagi bo‘shliq ham), qator oxiridagisi uchun — asl kenglik + ozgina zaxira (o‘ng hoshiyaga).
 */
function availableWidths(pieces: TextPiece[]): number[] {
  const room = pieces.map((p) => p.width);
  const lines = new Map<string, number[]>();
  pieces.forEach((p, i) => {
    const [a, b, , , , f] = p.transform;
    if (Math.abs(b) > 1e-3 || a <= 0) return; // faqat gorizontal matn
    const key = `${Math.round(f / Math.max(1, a * 0.4))}|${a.toFixed(1)}`;
    lines.set(key, [...(lines.get(key) ?? []), i]);
  });
  for (const idxs of lines.values()) {
    idxs.sort((x, y) => pieces[x].transform[4] - pieces[y].transform[4]);
    idxs.forEach((i, k) => {
      const p = pieces[i];
      const size = p.transform[0];
      const next = idxs[k + 1];
      room[i] = next !== undefined ? Math.max(p.width, pieces[next].transform[4] - p.transform[4] - size * 0.15) : p.width + Math.min(p.width * 0.2, size * 3);
    });
  }
  return room;
}

/**
 * @returns o‘girilgan PDF; matn qatlamini ishonchli o‘qib bo‘lmasa (masalan, harflar Unicode’ga bog‘lanmagan) — PdfLayoutUnsupported
 */
export async function convertPdfLayout(buf: Buffer, opts: Opts): Promise<{ data: Buffer; pieces: number }> {
  const { pages, glyphs, unmapped } = await readPieces(buf);
  // Ko‘p harf Unicode’ga bog‘lanmagan bo‘lsa, ularni o‘chirib, qayta yozib bo‘lmaydi — joylashuvni saqlash rejimi ishlatilmaydi
  if (!glyphs || unmapped / glyphs > 0.02) throw new PdfLayoutUnsupported("PDF matni Unicode’ga to‘liq bog‘lanmagan.");

  const doc = await PDFDocument.load(buf, { updateMetadata: false });
  doc.registerFontkit(fontkit);
  const fontCache = new Map<string, PDFFont>();
  const getFont = async (f: TextPiece["font"]) => {
    const family = f.mono ? "mono" : f.calibri ? "calibri" : f.serif ? "serif" : "sans";
    const file = FONT_FILES[family][(f.bold ? 1 : 0) + (f.italic ? 2 : 0)];
    let font = fontCache.get(file);
    if (!font) {
      // Carlito’ni fontkit qism-to‘plamga (subset) to‘g‘ri ajrata olmaydi — to‘liq joylanadi
      font = await doc.embedFont(await readFile(path.join(FONT_DIR, `${file}.ttf`)), { subset: !file.startsWith("Carlito") });
      fontCache.set(file, font);
    }
    return font;
  };

  const seenForms = new Set<string>();
  const docPages = doc.getPages();
  let count = 0;
  for (let i = 0; i < docPages.length; i++) {
    const page = docPages[i];
    const pieces = pages[i] ?? [];
    if (!pieces.length) continue;
    if (!stripPage(doc, page, seenForms)) throw new PdfLayoutUnsupported("Sahifa kontentini o‘qib bo‘lmadi.");
    const keys = new Map<PDFFont, PDFName>();
    const ops = [pushGraphicsState()];
    const room = availableWidths(pieces);
    for (const [idx, p] of pieces.entries()) {
      const [a, b, c, d, e, f] = p.transform;
      const sx = Math.hypot(a, b);
      if (!sx) continue;
      const text = transliterate(p.str, opts).text;
      const font = await getFont(p.font);
      let key = keys.get(font);
      if (!key) {
        key = page.node.newFontDictionary(font.name, font.ref);
        keys.set(font, key);
      }
      const natural = font.widthOfTextAtSize(text, 1) * sx;
      // Joy yetmasa siqiladi (qatorlar, ustunlar va tekislash buzilmaydi); qisqa bo‘lsa cho‘zilmaydi
      const squeeze = natural > 0 && room[idx] > 0 ? Math.min(100, Math.max(50, (room[idx] / natural) * 100)) : 100;
      ops.push(
        setFillingRgbColor(...p.color),
        beginText(),
        setFontAndSize(key, 1),
        setTextMatrix(a, b, c, d, e, f),
        setCharacterSqueeze(squeeze),
        showText(font.encodeText(text)),
        endText(),
      );
      count++;
    }
    ops.push(popGraphicsState());
    page.pushOperators(...ops);
  }
  return { data: Buffer.from(await doc.save({ useObjectStreams: true })), pieces: count };
}
