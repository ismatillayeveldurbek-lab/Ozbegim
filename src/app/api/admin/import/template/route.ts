import { z } from "zod";
import { handle, requireAdmin } from "@/lib/server/http";
import { templateCsv, templateXlsx } from "@/lib/server/templates";

/** Lug‘at importi uchun namuna shablon (CSV yoki XLSX). */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const target = z.enum(["idiom", "loanword", "lexeme", "spelling"]).parse(url.searchParams.get("target"));
  const format = z.enum(["csv", "xlsx"]).parse(url.searchParams.get("format") ?? "csv");
  if (format === "csv")
    return new Response(templateCsv(target), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ozbegim-${target}-shablon.csv"` },
    });
  return new Response(new Uint8Array(await templateXlsx(target)), {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="ozbegim-${target}-shablon.xlsx"` },
  });
});
