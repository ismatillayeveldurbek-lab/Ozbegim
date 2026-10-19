import type { Prisma } from "@generated/prisma/client";
import { prisma } from "@/lib/server/db";
import { handle, json, readJson, requireAdmin } from "@/lib/server/http";
import { loadJob, pickSheet, previewInput } from "@/lib/server/import-job";
import { prepare } from "@/lib/server/importer";

/** 2–6-qadamlar: moslashtirish, oldindan ko‘rish, xatolar va takrorlar. Baza o‘zgarmaydi. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const body = await readJson(req, previewInput);
  const { sheets, target } = await loadJob(id, admin.id);
  const prep = await prepare(target, pickSheet(sheets, body.sheetName), body.mapping, body.defaultStatus);
  await prisma.importJob.update({
    where: { id },
    data: { status: "PREVIEWED", sheetName: body.sheetName, mapping: { ...body.mapping, __defaultStatus: body.defaultStatus } as Prisma.InputJsonValue },
  });
  return json({
    total: prep.total,
    valid: prep.entries.length,
    errors: prep.errors.slice(0, 500),
    errorCount: prep.errors.length,
    duplicatesInFile: prep.duplicatesInFile.slice(0, 200),
    existing: prep.existing.slice(0, 200),
    existingCount: prep.existing.length,
    sample: prep.entries.slice(0, 10).map((e) => ({ display: e.display, rows: e.rows, data: e.data })),
  });
});
