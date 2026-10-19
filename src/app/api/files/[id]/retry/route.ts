import { prisma } from "@/lib/server/db";
import { drainQueue } from "@/lib/server/file-jobs";
import { handle, HttpError, json, requireUser } from "@/lib/server/http";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const job = await prisma.fileJob.findUnique({ where: { id } });
  if (!job || job.userId !== user.id) throw new HttpError(404, "Fayl topilmadi.");
  if (!["FAILED", "CANCELLED"].includes(job.status)) throw new HttpError(409, "Faqat xato bergan yoki bekor qilingan vazifani qayta boshlash mumkin.");
  await prisma.fileJob.update({
    where: { id },
    data: { status: "QUEUED", cancelRequested: false, errorCode: null, errorMessage: null, attempts: 0, lockedAt: null, finishedAt: null },
  });
  if (process.env.FILE_PROCESSING === "inline") void drainQueue(5).catch(() => {});
  return json({ ok: true });
});
