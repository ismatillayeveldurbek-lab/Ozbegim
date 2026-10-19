import { z } from "zod";
import type { Prisma } from "@generated/prisma/client";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireAdmin } from "@/lib/server/http";
import { loadJob, pickSheet } from "@/lib/server/import-job";
import { commit, prepare } from "@/lib/server/importer";

/** 7–9-qadamlar: takrorlar qoidasi, tasdiqlash va natija hisoboti. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const body = await readJson(req, z.object({ duplicateRule: z.enum(["skip", "update"]), skipInvalid: z.boolean().default(false) }));
  const { job, sheets, target } = await loadJob(id, admin.id);
  if (!job.sheetName || !job.mapping) throw new HttpError(400, "Avval oldindan ko‘rishni bajaring.");
  const { __defaultStatus, ...mapping } = job.mapping as Record<string, number | string>;
  const prep = await prepare(target, pickSheet(sheets, job.sheetName), mapping as Record<string, number>, (__defaultStatus as "VERIFIED" | "PENDING") ?? "VERIFIED");
  if (prep.errors.length && !body.skipInvalid)
    throw new HttpError(400, `${prep.errors.length} ta qatorda xato bor. Xatolarni tuzating yoki “xatoli qatorlarni o‘tkazib yuborish”ni tanlang.`, "HAS_ERRORS");
  let result;
  try {
    result = await commit(target, prep, body.duplicateRule, admin.id, id);
  } catch (e) {
    await prisma.importJob.update({ where: { id }, data: { status: "FAILED", report: { error: (e as Error).message } } });
    throw e;
  }
  const report = { ...result, invalidSkipped: prep.errors.length, duplicatesInFile: prep.duplicatesInFile.length, errors: prep.errors.slice(0, 500) };
  await prisma.importJob.update({ where: { id }, data: { status: "COMMITTED", duplicateRule: body.duplicateRule, report: report as unknown as Prisma.InputJsonValue, committedAt: new Date(), sheets: [] } });
  return json(report);
});
