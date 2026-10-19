/**
 * Faylning haqiqiy turini aniqlash: kengaytma VA ichidagi baytlar mos kelishi shart.
 */
import { inspectZip, ZipCheckError, type ZipEntryInfo } from "./zip-inspect";

export type FileFormat = "txt" | "csv" | "srt" | "vtt" | "docx" | "xlsx" | "pptx" | "pdf" | "png" | "jpg";

export type { SupportLevel, FormatInfo } from "./format-table";

export class FileRejectError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const LEGACY: Record<string, string> = {
  doc: "Eski .doc formati bevosita qo‘llanmaydi. Faylni Microsoft Word yoki LibreOffice Writer’da oching va “Saqlash” → “Word hujjati (.docx)” ni tanlang, so‘ng .docx faylni yuklang.",
  xls: "Eski .xls formati bevosita qo‘llanmaydi. Faylni Excel yoki LibreOffice Calc’da oching va “Excel kitobi (.xlsx)” sifatida saqlang.",
  ppt: "Eski .ppt formati bevosita qo‘llanmaydi. Faylni PowerPoint yoki LibreOffice Impress’da oching va “.pptx” sifatida saqlang.",
};

const MACRO = new Set(["docm", "xlsm", "pptm", "dotm", "xltm", "potm", "xlsb"]);
const MEDIA = new Set(["mp3", "wav", "m4a", "ogg", "oga", "flac", "aac", "mp4", "mov", "mkv", "webm", "avi", "wma", "wmv"]);

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

function isValidUtf8(buf: Buffer): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

function looksText(buf: Buffer): boolean {
  const n = Math.min(buf.length, 64 * 1024);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return false;
  return true;
}

function startsWith(buf: Buffer, bytes: number[], offset = 0) {
  return bytes.every((b, i) => buf[offset + i] === b);
}

export interface DetectResult {
  format: FileFormat;
  zipEntries?: ZipEntryInfo[];
}

export function detectFile(name: string, buf: Buffer): DetectResult {
  const ext = extensionOf(name);
  if (!buf.length) throw new FileRejectError("EMPTY", "Fayl bo‘sh.");
  if (LEGACY[ext] || startsWith(buf, [...OLE_MAGIC])) {
    throw new FileRejectError("LEGACY", LEGACY[ext] ?? "Eski Microsoft Office formati (.doc/.xls/.ppt) bevosita qo‘llanmaydi. Faylni .docx/.xlsx/.pptx sifatida qayta saqlang.");
  }
  if (MACRO.has(ext)) throw new FileRejectError("MACRO", "Makros saqlovchi fayllar (.docm, .xlsm, .pptm) xavfsizlik sababli qabul qilinmaydi. Faylni makrossiz formatda saqlang.");
  if (MEDIA.has(ext))
    throw new FileRejectError(
      "MEDIA",
      "Audio va video fayllar uchun avval transkripsiya (nutqni matnga aylantirish) kerak. Transkripsiya xizmati hozircha ulanmagan.",
    );

  const isZip = startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);
  const isPdf = buf.subarray(0, 1024).includes(Buffer.from("%PDF-"));
  const isPng = startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpg = startsWith(buf, [0xff, 0xd8, 0xff]);

  const mismatch = () => new FileRejectError("TYPE_MISMATCH", `Fayl kengaytmasi (.${ext}) uning haqiqiy mazmuniga mos emas.`);

  switch (ext) {
    case "docx":
    case "xlsx":
    case "pptx": {
      if (!isZip) throw mismatch();
      let entries: ZipEntryInfo[];
      try {
        entries = inspectZip(buf);
      } catch (e) {
        if (e instanceof ZipCheckError) throw new FileRejectError(e.code, e.message);
        throw e;
      }
      const names = new Set(entries.map((e) => e.name));
      if (!names.has("[Content_Types].xml")) throw new FileRejectError("CORRUPT", "Fayl buzilgan: Office hujjati tuzilmasi topilmadi.");
      if (entries.some((e) => /vbaProject\.bin$/i.test(e.name)))
        throw new FileRejectError("MACRO", "Faylda makros (VBA) bor. Xavfsizlik sababli makrosli fayllar qabul qilinmaydi.");
      const main = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" }[ext];
      if (!names.has(main)) throw mismatch();
      return { format: ext, zipEntries: entries };
    }
    case "pdf":
      if (!isPdf) throw mismatch();
      return { format: "pdf" };
    case "png":
      if (!isPng) throw mismatch();
      return { format: "png" };
    case "jpg":
    case "jpeg":
      if (!isJpg) throw mismatch();
      return { format: "jpg" };
    case "txt":
    case "csv":
    case "srt":
    case "vtt":
      if (isZip || isPdf || isPng || isJpg || !looksText(buf)) throw mismatch();
      if (ext === "vtt" && !/^﻿?WEBVTT/.test(buf.subarray(0, 16).toString("utf8")))
        throw new FileRejectError("CORRUPT", "VTT fayli “WEBVTT” sarlavhasi bilan boshlanishi kerak.");
      return { format: ext };
    default:
      throw new FileRejectError("UNSUPPORTED", ext ? `.${ext} formati qo‘llab-quvvatlanmaydi.` : "Fayl kengaytmasi aniqlanmadi.");
  }
}

/** Matnli faylni o‘qish: UTF-8 (BOM bilan yoki BOMsiz), aks holda Windows-1251. */
export function decodeText(buf: Buffer): { text: string; bom: boolean; encoding: string } {
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const body = bom ? buf.subarray(3) : buf;
  if (isValidUtf8(body)) return { text: body.toString("utf8"), bom, encoding: "utf-8" };
  return { text: new TextDecoder("windows-1251").decode(body), bom: false, encoding: "windows-1251" };
}

