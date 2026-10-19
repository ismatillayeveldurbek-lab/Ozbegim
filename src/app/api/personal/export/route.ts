import { z } from "zod";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/server/db";
import { handle, readJson, requireUser } from "@/lib/server/http";

/** Tanlangan shaxsiy yozuvlarni CSV yoki JSON ko‘rinishida eksport qilish (faqat o‘ziniki). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { ids, format } = await readJson(req, z.object({ ids: z.array(z.string().max(40)).min(1).max(5000), format: z.enum(["csv", "json"]) }));
  const items = await prisma.savedItem.findMany({
    where: { id: { in: ids }, userId: user.id },
    include: { folder: true, tags: { include: { tag: true } } },
    orderBy: { createdAt: "asc" },
  });
  const rows = items.map((i) => ({ turi: i.kind, soz: i.term, manosi: i.meaning ?? "", qayd: i.note ?? "", papka: i.folder?.name ?? "", teglar: i.tags.map((t) => t.tag.name).join(", ") }));
  const body = format === "csv" ? toCsv([["Turi", "So‘z yoki ibora", "Ma’nosi", "Qayd", "Papka", "Teglar"], ...rows.map((r) => Object.values(r))]) : JSON.stringify(rows, null, 2);
  return new Response(body, {
    headers: {
      "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="shaxsiy-lugat.${format}"`,
      "cache-control": "private, no-store",
    },
  });
});
