import { z } from "zod";
import { prisma } from "./db";
import { HttpError } from "./http";
import type { ImportTarget, SheetData } from "./importer";

export const previewInput = z.object({
  sheetName: z.string().max(200),
  mapping: z.record(z.string(), z.number().int().min(0).max(500)),
  defaultStatus: z.enum(["VERIFIED", "PENDING"]).default("VERIFIED"),
});

export async function loadJob(id: string, actorId: string) {
  const job = await prisma.importJob.findUnique({ where: { id } });
  if (!job || job.actorId !== actorId) throw new HttpError(404, "Import vazifasi topilmadi.");
  if (job.status === "COMMITTED") throw new HttpError(409, "Bu import allaqachon yakunlangan.");
  const sheets = job.sheets as unknown as SheetData[];
  return { job, sheets, target: job.target as ImportTarget };
}

export function pickSheet(sheets: SheetData[], name: string) {
  const s = sheets.find((x) => x.name === name);
  if (!s) throw new HttpError(400, "Varaq topilmadi.");
  return s;
}
