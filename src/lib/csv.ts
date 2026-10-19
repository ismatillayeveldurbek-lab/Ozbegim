/**
 * Xavfsiz CSV eksporti: foydalanuvchi matni jadval dasturida formula sifatida bajarilmasligi
 * uchun = + - @ TAB CR bilan boshlanuvchi kataklar oldiga apostrof qo‘shiladi (CSV injection himoyasi).
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: unknown): string {
  const s = neutralizeFormula(value === null || value === undefined ? "" : String(value));
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
