/**
 * Lug‘at importi: CSV/XLSX → varaqlar → maydonlarga moslashtirish → tekshirish → tranzaksiyada yozish.
 */
import ExcelJS from "exceljs";
import { decodeText, extensionOf } from "@/lib/files/detect";
import { detectDelimiter } from "@/lib/files/formats/text-formats";
import { inspectZip } from "@/lib/files/zip-inspect";
import { normalizeKey } from "@/lib/uz/normalize";
import type { Prisma } from "@generated/prisma/client";
import { prisma } from "./db";
import { saveIdiom, saveLexeme, saveLoanword, saveSpelling, idiomInput, lexemeInput, loanwordInput, spellingInput } from "./entries";
import { HttpError } from "./http";

export const MAX_IMPORT_ROWS = 20_000;
export type ImportTarget = "idiom" | "loanword" | "lexeme" | "spelling";

export interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
}

export const FIELDS: Record<ImportTarget, FieldDef[]> = {
  idiom: [
    { key: "phrase", label: "Ibora", required: true },
    { key: "meaning", label: "Ma’nosi", required: true, hint: "Bir iboraning bir nechta ma’nosi — alohida qatorlarda" },
    { key: "example", label: "Misol" },
    { key: "synonyms", label: "Ma’nodosh iboralar", hint: "; bilan ajrating" },
    { key: "tags", label: "Teglar", hint: "; bilan ajrating" },
    { key: "source_title", label: "Manba nomi" },
    { key: "source_url", label: "Manba havolasi" },
    { key: "status", label: "Holat", hint: "tasdiqlangan / tekshirilmoqda / rad etilgan" },
  ],
  loanword: [
    { key: "word", label: "O‘zlashma so‘z", required: true },
    { key: "alternatives", label: "O‘zbekcha muqobillar", hint: "; bilan ajrating; bo‘sh bo‘lishi mumkin" },
    { key: "alternative_usage", label: "Muqobillarning qo‘llanish vaziyati", hint: "muqobillar tartibida ; bilan" },
    { key: "meaning", label: "O‘zbekcha ma’nosi (izoh)" },
    { key: "domain", label: "Qo‘llanish sohasi" },
    { key: "origin_language", label: "Kelib chiqish tili" },
    { key: "spelling_variants", label: "Muqobil yozilishlar", hint: "; bilan ajrating" },
    { key: "examples", label: "Misollar", hint: "; bilan ajrating" },
    { key: "tags", label: "Teglar", hint: "; bilan ajrating" },
    { key: "source_title", label: "Manba nomi" },
    { key: "source_url", label: "Manba havolasi" },
    { key: "status", label: "Holat" },
  ],
  lexeme: [
    { key: "lemma", label: "So‘z (o‘zak)", required: true },
    { key: "pos", label: "So‘z turkumi", required: true, hint: "ot, sifat, son, olmosh, fe’l, ravish …" },
    { key: "meaning", label: "Lug‘aviy ma’nosi" },
    { key: "examples", label: "Misollar", hint: "; bilan ajrating" },
    { key: "status", label: "Holat" },
  ],
  spelling: [
    { key: "wrong", label: "Xato yozilish", required: true },
    { key: "correct", label: "To‘g‘ri yozilish", required: true },
    { key: "note", label: "Izoh" },
    { key: "status", label: "Holat" },
  ],
};

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

export function parseCsv(text: string): string[][] {
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"' && field === "") inQ = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (rows.length > MAX_IMPORT_ROWS + 1) break;
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

export async function parseImportFile(name: string, buf: Buffer): Promise<SheetData[]> {
  const ext = extensionOf(name);
  let sheets: SheetData[];
  if (ext === "csv" || ext === "txt") {
    const rows = parseCsv(decodeText(buf).text);
    sheets = [{ name: "CSV", headers: (rows[0] ?? []).map(clean), rows: rows.slice(1).map((r) => r.map(clean)) }];
  } else if (ext === "xlsx") {
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new HttpError(415, "Fayl XLSX formatida emas.");
    try {
      inspectZip(buf);
    } catch (e) {
      throw new HttpError(415, (e as Error).message);
    }
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    } catch {
      throw new HttpError(422, "XLSX faylni o‘qib bo‘lmadi (buzilgan bo‘lishi mumkin).");
    }
    sheets = [];
    wb.eachSheet((ws) => {
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (r) => {
        if (rows.length > MAX_IMPORT_ROWS) return;
        const vals: string[] = [];
        for (let c = 1; c <= ws.columnCount; c++) vals.push(clean(r.getCell(c).text ?? ""));
        rows.push(vals);
      });
      sheets.push({ name: ws.name, headers: rows[0] ?? [], rows: rows.slice(1) });
    });
  } else throw new HttpError(415, "Import uchun faqat CSV yoki XLSX fayl qabul qilinadi.");
  for (const s of sheets) if (s.rows.length > MAX_IMPORT_ROWS) throw new HttpError(413, `“${s.name}” varag‘ida ${MAX_IMPORT_ROWS} dan ortiq qator bor. Faylni bo‘lib yuklang.`);
  if (!sheets.length || sheets.every((s) => !s.headers.length)) throw new HttpError(422, "Faylda ma’lumot topilmadi.");
  return sheets;
}

const list = (s: string | undefined) =>
  (s ?? "")
    .split(/[;|]/)
    .map((x) => x.trim())
    .filter(Boolean);

function parseStatus(s: string | undefined, fallback: "VERIFIED" | "PENDING"): "VERIFIED" | "PENDING" | "REJECTED" {
  const v = normalizeKey(s ?? "");
  if (!v) return fallback;
  if (["tasdiqlangan", "verified", "tasdiqlandi", "ha"].includes(v)) return "VERIFIED";
  if (["tekshirilmoqda", "pending", "kutilmoqda"].includes(v)) return "PENDING";
  if (["rad etilgan", "rejected", "rad"].includes(v)) return "REJECTED";
  throw new Error(`Holat noto‘g‘ri: “${s}”`);
}

export interface RowError {
  row: number;
  message: string;
}

export interface PreparedEntry {
  key: string;
  rows: number[];
  data: unknown;
  display: string;
}

export interface PreviewResult {
  total: number;
  entries: PreparedEntry[];
  errors: RowError[];
  duplicatesInFile: Array<{ key: string; display: string; rows: number[] }>;
  existing: Array<{ key: string; display: string }>;
}

/** Qatorlarni maydonlarga moslab tekshiradi. Qator raqamlari fayldagidek (sarlavha — 1-qator). */
export async function prepare(target: ImportTarget, sheet: SheetData, mapping: Record<string, number>, defaultStatus: "VERIFIED" | "PENDING"): Promise<PreviewResult> {
  for (const f of FIELDS[target]) if (f.required && mapping[f.key] === undefined) throw new HttpError(400, `“${f.label}” maydoni uchun ustun tanlanmagan.`);
  const errors: RowError[] = [];
  const byKey = new Map<string, PreparedEntry & { base: Record<string, unknown> }>();
  const duplicateKeys = new Map<string, number[]>();

  sheet.rows.forEach((cells, idx) => {
    const rowNo = idx + 2;
    const get = (k: string) => (mapping[k] !== undefined ? (cells[mapping[k]] ?? "").trim() : "");
    if (cells.every((c) => !c.trim())) return;
    try {
      const status = parseStatus(get("status"), defaultStatus);
      const source = get("source_title") ? { title: get("source_title"), url: get("source_url") || null, author: null } : null;
      let key: string;
      let data: Record<string, unknown>;
      let display: string;
      switch (target) {
        case "idiom": {
          display = get("phrase");
          key = normalizeKey(display);
          const sense = { meaning: get("meaning"), example: get("example") || null, synonyms: list(get("synonyms")) };
          const existing = byKey.get(key);
          if (existing) {
            // Bir iboraning keyingi ma’nosi
            const d = existing.data as { senses: unknown[] };
            const parsed = idiomInput.parse({ ...(existing.base as object), senses: [...d.senses, sense] });
            existing.data = parsed;
            existing.rows.push(rowNo);
            return;
          }
          data = idiomInput.parse({ phrase: display, status, origin: "OFFICIAL", tags: list(get("tags")), source, senses: [sense] });
          byKey.set(key, { key, rows: [rowNo], data, display, base: { phrase: display, status, origin: "OFFICIAL", tags: list(get("tags")), source } });
          return;
        }
        case "loanword": {
          display = get("word");
          key = normalizeKey(display);
          const alts = list(get("alternatives"));
          const usages = (get("alternative_usage") ?? "").split(";").map((x) => x.trim());
          data = loanwordInput.parse({
            word: display,
            meaning: get("meaning") || null,
            domain: get("domain") || null,
            originLanguage: get("origin_language") || null,
            spellingVariants: list(get("spelling_variants")),
            examples: list(get("examples")),
            tags: list(get("tags")),
            alternatives: alts.map((t, i) => ({ text: t, usageNote: usages[i] || null })),
            status,
            origin: "OFFICIAL",
            source,
          });
          break;
        }
        case "lexeme":
          display = `${get("lemma")} (${get("pos")})`;
          data = lexemeInput.parse({ lemma: get("lemma"), pos: get("pos"), meaning: get("meaning") || null, examples: list(get("examples")), status, origin: "OFFICIAL" });
          key = `${normalizeKey(get("lemma"))}|${get("pos")}`;
          break;
        case "spelling":
          display = `${get("wrong")} → ${get("correct")}`;
          data = spellingInput.parse({ wrong: get("wrong"), correct: get("correct"), note: get("note") || null, status, origin: "OFFICIAL" });
          key = normalizeKey(get("wrong"));
          break;
      }
      if (!key) throw new Error("Asosiy maydon bo‘sh.");
      if (byKey.has(key)) {
        const rows = duplicateKeys.get(key) ?? [...byKey.get(key)!.rows];
        rows.push(rowNo);
        duplicateKeys.set(key, rows);
        return; // fayldagi takror: birinchi qator olinadi
      }
      byKey.set(key, { key, rows: [rowNo], data, display, base: {} });
    } catch (e) {
      const msg =
        e && typeof e === "object" && "issues" in e
          ? (e as { issues: Array<{ path: PropertyKey[]; message: string }> }).issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
          : (e as Error).message;
      errors.push({ row: rowNo, message: msg });
    }
  });

  const entries = [...byKey.values()].map(({ base: _b, ...e }) => e);
  const keys = entries.map((e) => e.key);
  let existingKeys: string[] = [];
  if (target === "idiom") existingKeys = (await prisma.idiom.findMany({ where: { key: { in: keys } }, select: { key: true } })).map((x) => x.key);
  else if (target === "loanword") existingKeys = (await prisma.loanword.findMany({ where: { key: { in: keys } }, select: { key: true } })).map((x) => x.key);
  else if (target === "spelling") existingKeys = (await prisma.spellingPair.findMany({ where: { wrongKey: { in: keys } }, select: { wrongKey: true } })).map((x) => x.wrongKey);
  else {
    const lex = await prisma.lexeme.findMany({ where: { key: { in: keys.map((k) => k.split("|")[0]) } }, select: { key: true, pos: true } });
    existingKeys = lex.map((l) => `${l.key}|${l.pos}`).filter((k) => keys.includes(k));
  }
  const existingSet = new Set(existingKeys);
  return {
    total: sheet.rows.length,
    entries,
    errors,
    duplicatesInFile: [...duplicateKeys].map(([key, rows]) => ({ key, rows, display: byKey.get(key)!.display })),
    existing: entries.filter((e) => existingSet.has(e.key)).map((e) => ({ key: e.key, display: e.display })),
  };
}

/** Barcha yozuvlarni BITTA tranzaksiyada yozadi: xato bo‘lsa, hech narsa saqlanmaydi. */
export async function commit(target: ImportTarget, prep: PreviewResult, rule: "skip" | "update", actorId: string | null, jobId: string) {
  const existing = new Set(prep.existing.map((e) => e.key));
  return prisma.$transaction(
    async (tx) => {
      let created = 0;
      let updated = 0;
      let skipped = 0;
      for (const e of prep.entries) {
        const isExisting = existing.has(e.key);
        if (isExisting && rule === "skip") {
          skipped++;
          continue;
        }
        const id = isExisting ? await findId(tx, target, e.key) : undefined;
        try {
          if (target === "idiom") await saveIdiom(tx, e.data as never, id);
          else if (target === "loanword") await saveLoanword(tx, e.data as never, id);
          else if (target === "lexeme") await saveLexeme(tx, e.data as never, id);
          else await saveSpelling(tx, e.data as never, id);
        } catch (err) {
          throw new HttpError(400, `${e.rows[0]}-qator (“${e.display}”): ${(err as Error).message} Import bekor qilindi, bazaga hech narsa yozilmadi.`);
        }
        if (isExisting) updated++;
        else created++;
      }
      await tx.auditLog.create({
        data: { actorId, action: "import.commit", entityType: "ImportJob", entityId: jobId, details: { target, created, updated, skipped, rule } as Prisma.InputJsonValue },
      });
      return { created, updated, skipped };
    },
    { timeout: 300_000, maxWait: 20_000 },
  );
}

async function findId(tx: Prisma.TransactionClient, target: ImportTarget, key: string) {
  if (target === "idiom") return (await tx.idiom.findUnique({ where: { key } }))?.id;
  if (target === "loanword") return (await tx.loanword.findUnique({ where: { key } }))?.id;
  if (target === "spelling") return (await tx.spellingPair.findUnique({ where: { wrongKey: key } }))?.id;
  const [k, pos] = key.split("|");
  return (await tx.lexeme.findUnique({ where: { key_pos: { key: k, pos } } }))?.id;
}
