/**
 * Fayl vazifalari: yaratish, navbatdan olish (FOR UPDATE SKIP LOCKED), bajarish va tozalash.
 */
import { convertFile, type ConvertOptions } from "@/lib/files/convert";
import { FileRejectError, type FileFormat } from "@/lib/files/detect";
import type { FileJob, Prisma } from "@generated/prisma/client";
import { prisma } from "./db";
import { newObjectKey, ObjectMissingError, storage } from "./storage";

export const RETENTION_HOURS = Math.max(1, Number(process.env.FILE_RETENTION_HOURS ?? 24));
export const MAX_FILE_MB = Math.max(1, Number(process.env.FILE_MAX_MB ?? 20));
/** Bitta javob hajmi chegarasi (masalan, Vercel funksiyalarida 4,5 MB). 0 — cheklanmagan. */
export const MAX_RESPONSE_MB = Number(process.env.MAX_RESPONSE_MB ?? 0);
const MAX_ATTEMPTS = 3;
const STALE_MINUTES = 10;

export function expiry(from = new Date()) {
  return new Date(from.getTime() + RETENTION_HOURS * 3600_000);
}

export async function storeObject(ownerId: string, kind: string, data: Buffer, expiresAt: Date, fileJobId?: string) {
  const key = newObjectKey(ownerId, kind);
  await storage().put(key, data);
  await prisma.storedObject.create({ data: { key, ownerId, kind, sizeBytes: data.length, expiresAt, fileJobId } });
  return key;
}

export async function deleteObject(key: string | null | undefined) {
  if (!key) return;
  await storage().delete(key).catch(() => {});
  await prisma.storedObject.updateMany({ where: { key, deletedAt: null }, data: { deletedAt: new Date() } });
}

/**
 * Kirish faylini saqlab, so‘ng vazifa va saqlash yozuvini bitta tranzaksiyada yaratadi.
 * Tranzaksiya muvaffaqiyatsiz bo‘lsa, saqlangan fayl o‘chiriladi (yetim fayl qolmaydi).
 */
export async function createJobWithInput(
  userId: string,
  data: Buffer,
  job: { originalName: string; format: string; sizeBytes: number; direction: string; options: object; expiresAt: Date },
): Promise<FileJob> {
  const inputKey = newObjectKey(userId, "input");
  await storage().put(inputKey, data);
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.fileJob.create({ data: { ...job, userId, options: job.options as Prisma.InputJsonValue, inputKey } });
      await tx.storedObject.create({ data: { key: inputKey, ownerId: userId, kind: "input", sizeBytes: data.length, expiresAt: job.expiresAt, fileJobId: created.id } });
      return created;
    });
  } catch (e) {
    await storage().delete(inputKey).catch(() => {});
    throw e;
  }
}

/** Navbatdagi bitta vazifani atomik ravishda egallaydi. */
export async function claimNextJob(): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "FileJob" SET "status" = 'PROCESSING', "lockedAt" = now(), "startedAt" = now(), "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id" FROM "FileJob"
      WHERE "status" = 'QUEUED' AND "cancelRequested" = false AND "expiresAt" > now()
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING "id"`;
  return rows[0]?.id ?? null;
}

/** Qotib qolgan (ishchi to‘xtab qolgan) vazifalarni qayta navbatga qo‘yadi yoki xato deb belgilaydi. */
export async function recoverStaleJobs() {
  const stale = new Date(Date.now() - STALE_MINUTES * 60_000);
  await prisma.fileJob.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: stale }, attempts: { lt: MAX_ATTEMPTS } },
    data: { status: "QUEUED", lockedAt: null },
  });
  await prisma.fileJob.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: stale }, attempts: { gte: MAX_ATTEMPTS } },
    data: { status: "FAILED", errorCode: "TIMEOUT", errorMessage: "Faylni ishlash juda uzoq davom etdi va to‘xtatildi.", finishedAt: new Date() },
  });
}

export async function processJob(id: string): Promise<FileJob | null> {
  const job = await prisma.fileJob.findUnique({ where: { id } });
  if (!job || job.status !== "PROCESSING") return job;
  try {
    const input = await storage().get(job.inputKey);
    const outcome = await convertFile(job.format as FileFormat, job.originalName, input, job.options as unknown as ConvertOptions);
    if (MAX_RESPONSE_MB && outcome.kind === "file" && outcome.data.length > MAX_RESPONSE_MB * 1024 * 1024)
      throw new FileRejectError("OUTPUT_TOO_LARGE", `Natija fayli juda katta (${(outcome.data.length / 1024 / 1024).toFixed(1)} MB). Bu serverda ${MAX_RESPONSE_MB} MB gacha natija yuklab olinadi — faylni qismlarga bo‘lib yuklang.`);
    const fresh = await prisma.fileJob.findUnique({ where: { id } });
    if (!fresh || fresh.cancelRequested) {
      return prisma.fileJob.update({ where: { id }, data: { status: "CANCELLED", finishedAt: new Date(), lockedAt: null } });
    }
    if (outcome.kind === "file") {
      const outputKey = await storeObject(job.userId, "output", outcome.data, job.expiresAt, id);
      return prisma.fileJob.update({
        where: { id },
        data: {
          status: "DONE",
          outputKey,
          outputName: outcome.fileName,
          outputMime: outcome.mime,
          warnings: outcome.warnings,
          direction: outcome.direction,
          finishedAt: new Date(),
          lockedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });
    }
    const payload = Buffer.from(JSON.stringify({ originalText: outcome.originalText, text: outcome.text, note: outcome.note }), "utf8");
    const textKey = await storeObject(job.userId, "text", payload, job.expiresAt, id);
    return prisma.fileJob.update({
      where: { id },
      data: { status: "NEEDS_REVIEW", textKey, warnings: outcome.warnings, direction: outcome.direction, finishedAt: new Date(), lockedAt: null, errorCode: null, errorMessage: null },
    });
  } catch (err) {
    let e = err;
    if (e instanceof ObjectMissingError) e = new FileRejectError("INPUT_MISSING", "Yuklangan fayl serverda topilmadi (muddati o‘tgan yoki server qayta ishga tushgan). Faylni qayta yuklang.");
    const known = e instanceof FileRejectError ? e : null;
    // Foydalanuvchi matni loglarga yozilmaydi — faqat xato kodi.
    if (!known) console.error(`[file-job ${id}] kutilmagan xato:`, e instanceof Error ? e.name : "noma’lum");
    if (!known && process.env.DEBUG_JOBS === "1") console.error(`[file-job ${id}]`, e instanceof Error ? `${e.message.slice(0, 300)}\n${e.stack?.split("\n").slice(1, 6).join("\n")}` : e);
    return prisma.fileJob.update({
      where: { id },
      data: {
        status: "FAILED",
        errorCode: known ? known.code : "INTERNAL",
        errorMessage: known ? known.message : "Faylni ishlashda kutilmagan xato yuz berdi. Qayta urinib ko‘ring yoki boshqa formatda saqlang.",
        finishedAt: new Date(),
        lockedAt: null,
      },
    });
  }
}

/** Navbatni bo‘shatguncha ishlaydi (inline rejim va testlar uchun). */
export async function drainQueue(max = 50) {
  let n = 0;
  for (; n < max; n++) {
    const id = await claimNextJob();
    if (!id) break;
    await processJob(id);
  }
  return n;
}

/** Muddati o‘tgan fayl va vazifalarni o‘chiradi. */
export async function cleanupExpired(now = new Date()) {
  const jobs = await prisma.fileJob.findMany({ where: { expiresAt: { lte: now } }, select: { id: true } });
  for (const j of jobs) await deleteJob(j.id);
  const orphans = await prisma.storedObject.findMany({ where: { expiresAt: { lte: now }, deletedAt: null }, select: { key: true } });
  for (const o of orphans) await deleteObject(o.key);
  return { jobs: jobs.length, objects: orphans.length };
}

export async function deleteJob(id: string) {
  const objs = await prisma.storedObject.findMany({ where: { fileJobId: id, deletedAt: null }, select: { key: true } });
  const job = await prisma.fileJob.findUnique({ where: { id }, select: { inputKey: true, outputKey: true, textKey: true } });
  const keys = new Set([...objs.map((o) => o.key), job?.inputKey, job?.outputKey, job?.textKey].filter(Boolean) as string[]);
  for (const k of keys) await deleteObject(k);
  await prisma.fileJob.deleteMany({ where: { id } });
}

export function serializeJob(j: FileJob) {
  return {
    id: j.id,
    originalName: j.originalName,
    format: j.format,
    sizeBytes: j.sizeBytes,
    direction: j.direction,
    status: j.status,
    errorCode: j.errorCode,
    errorMessage: j.errorMessage,
    warnings: j.warnings,
    outputName: j.outputName,
    hasOutput: !!j.outputKey,
    hasText: !!j.textKey,
    expiresAt: j.expiresAt.toISOString(),
    createdAt: j.createdAt.toISOString(),
  };
}


