import ExcelJS from "exceljs";
import { toCsv } from "@/lib/csv";
import { FIELDS, type ImportTarget } from "./importer";

export const SAMPLE: Record<ImportTarget, string[][]> = {
  idiom: [
    ["ko‘z ochib yumguncha", "Juda tez, bir lahzada.", "Ko‘z ochib yumguncha bayram ham o‘tdi.", "bir zumda", "vaqt", "", "", "tasdiqlangan"],
    ["boshini qotirmoq", "(O‘z boshini) uzoq o‘ylamoq.", "Kun bo‘yi boshimni qotirdim.", "", "fikrlash", "", "", "tasdiqlangan"],
    ["boshini qotirmoq", "(Birovning boshini) gap bilan chalg‘itmoq.", "", "", "fikrlash", "", "", "tasdiqlangan"],
  ],
  loanword: [["prezentatsiya", "taqdimot", "Barcha vaziyatlarda", "Loyiha yoki g‘oyani tanishtirish.", "ish yuritish", "lotin", "", "Ertaga loyiha taqdimoti bo‘ladi.", "", "", "", "tasdiqlangan"]],
  lexeme: [["kitob", "ot", "Bosma yoki qo‘lyozma asar.", "Kitob o‘qidim.", "tasdiqlangan"]],
  spelling: [["malumot", "ma’lumot", "Tutuq belgisi tushib qolgan.", "tasdiqlangan"]],
};

export function templateCsv(target: ImportTarget) {
  return toCsv([FIELDS[target].map((f) => f.key), ...SAMPLE[target]]);
}

export async function templateXlsx(target: ImportTarget) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(target);
  ws.addRow(FIELDS[target].map((f) => f.key));
  SAMPLE[target].forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  const info = wb.addWorksheet("Yo‘riqnoma");
  info.addRow(["Ustun", "Maydon", "Majburiylik", "Izoh"]);
  FIELDS[target].forEach((f) => info.addRow([f.key, f.label, f.required ? "majburiy" : "ixtiyoriy", f.hint ?? ""]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
