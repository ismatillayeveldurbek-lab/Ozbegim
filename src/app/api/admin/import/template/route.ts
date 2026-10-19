import ExcelJS from "exceljs";
import { z } from "zod";
import { toCsv } from "@/lib/csv";
import { handle, requireAdmin } from "@/lib/server/http";
import { FIELDS } from "@/lib/server/importer";

const SAMPLE: Record<string, string[][]> = {
  idiom: [
    ["ko‘z ochib yumguncha", "Juda tez, bir lahzada.", "Ko‘z ochib yumguncha bayram ham o‘tdi.", "bir zumda", "vaqt", "", "", "tasdiqlangan"],
    ["boshini qotirmoq", "(O‘z boshini) uzoq o‘ylamoq.", "Kun bo‘yi boshimni qotirdim.", "", "fikrlash", "", "", "tasdiqlangan"],
    ["boshini qotirmoq", "(Birovning boshini) gap bilan chalg‘itmoq.", "", "", "fikrlash", "", "", "tasdiqlangan"],
  ],
  loanword: [["prezentatsiya", "taqdimot", "Barcha vaziyatlarda", "Loyiha yoki g‘oyani tanishtirish.", "ish yuritish", "lotin", "", "Ertaga loyiha taqdimoti bo‘ladi.", "", "", "", "tasdiqlangan"]],
  lexeme: [["kitob", "ot", "Bosma yoki qo‘lyozma asar.", "Kitob o‘qidim.", "tasdiqlangan"]],
  spelling: [["malumot", "ma’lumot", "Tutuq belgisi tushib qolgan.", "tasdiqlangan"]],
};

/** Lug‘at importi uchun namuna shablon (CSV yoki XLSX). */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const target = z.enum(["idiom", "loanword", "lexeme", "spelling"]).parse(url.searchParams.get("target"));
  const format = z.enum(["csv", "xlsx"]).parse(url.searchParams.get("format") ?? "csv");
  const headers = FIELDS[target].map((f) => f.key);
  if (format === "csv")
    return new Response(toCsv([headers, ...SAMPLE[target]]), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ozbegim-${target}-shablon.csv"` },
    });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(target);
  ws.addRow(headers);
  SAMPLE[target].forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  const info = wb.addWorksheet("Yo‘riqnoma");
  FIELDS[target].forEach((f) => info.addRow([f.key, f.label, f.required ? "majburiy" : "ixtiyoriy", f.hint ?? ""]));
  return new Response(new Uint8Array(await wb.xlsx.writeBuffer()), {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="ozbegim-${target}-shablon.xlsx"` },
  });
});
