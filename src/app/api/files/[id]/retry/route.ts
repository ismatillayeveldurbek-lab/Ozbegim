import { prisma } from "@/lib/server/db";
import { scheduleInlineProcessing } from "@/lib/server/inline-after";
import { handle, HttpError, json, requireUser } from "@/lib/server/http";

export const maxDuration = 300;

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
  scheduleInlineProcessing();
  return json({ ok: true });
});
