import ExcelJS from "exceljs";
import { z } from "zod";
import { neutralizeFormula, toCsv } from "@/lib/csv";
import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { handle, requireAdmin } from "@/lib/server/http";
import { FIELDS } from "@/lib/server/importer";

const status = (s: string) => ({ VERIFIED: "tasdiqlangan", PENDING: "tekshirilmoqda", REJECTED: "rad etilgan" })[s] ?? s;

async function rowsFor(target: string, includeDemo: boolean): Promise<string[][]> {
  const origin = includeDemo ? {} : { origin: { not: "DEMO" as const } };
  if (target === "idiom") {
    const items = await prisma.idiom.findMany({ where: origin, include: { senses: { orderBy: { order: "asc" } }, source: true }, orderBy: { key: "asc" } });
    return items.flatMap((i) => i.senses.map((s) => [i.phrase, s.meaning, s.example ?? "", s.synonyms.join("; "), i.tags.join("; "), i.source?.title ?? "", i.source?.url ?? "", status(i.status)]));
  }
  if (target === "loanword") {
    const items = await prisma.loanword.findMany({ where: origin, include: { alternatives: { orderBy: { order: "asc" } }, examples: { orderBy: { order: "asc" } }, source: true }, orderBy: { key: "asc" } });
    return items.map((l) => [
      l.word,
      l.alternatives.map((a) => a.text).join("; "),
      l.alternatives.map((a) => a.usageNote ?? "").join("; "),
      l.meaning ?? "",
      l.domain ?? "",
      l.originLanguage ?? "",
      l.spellingVariants.join("; "),
      l.examples.map((e) => e.text).join("; "),
      l.tags.join("; "),
      l.source?.title ?? "",
      l.source?.url ?? "",
      status(l.status),
    ]);
  }
  if (target === "lexeme") return (await prisma.lexeme.findMany({ where: origin, orderBy: { key: "asc" } })).map((x) => [x.lemma, x.pos, x.meaning ?? "", x.examples.join("; "), status(x.status)]);
  return (await prisma.spellingPair.findMany({ where: origin, orderBy: { wrongKey: "asc" } })).map((x) => [x.wrong, x.correct, x.note ?? "", status(x.status)]);
}

/** Eksport: import shabloni bilan bir xil ustunlar — qayta import qilish mumkin. Formula injection’dan himoyalangan. */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const url = new URL(req.url);
  const target = z.enum(["idiom", "loanword", "lexeme", "spelling"]).parse(url.searchParams.get("target"));
  const format = z.enum(["csv", "xlsx"]).parse(url.searchParams.get("format") ?? "csv");
  const includeDemo = url.searchParams.get("includeDemo") === "1";
  const headers = FIELDS[target].map((f) => f.key);
  const rows = await rowsFor(target, includeDemo);
  await audit(admin.id, "export", target, null, { format, rows: rows.length, includeDemo });
  const date = new Date().toISOString().slice(0, 10);
  if (format === "csv")
    return new Response(toCsv([headers, ...rows]), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ozbegim-${target}-${date}.csv"`, "cache-control": "no-store" },
    });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(target);
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r.map(neutralizeFormula));
  return new Response(new Uint8Array(await wb.xlsx.writeBuffer()), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="ozbegim-${target}-${date}.xlsx"`,
      "cache-control": "no-store",
    },
  });
});
