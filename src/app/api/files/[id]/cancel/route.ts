import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, requireUser } from "@/lib/server/http";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const job = await prisma.fileJob.findUnique({ where: { id } });
  if (!job || job.userId !== user.id) throw new HttpError(404, "Fayl topilmadi.");
  if (job.status === "QUEUED") {
    await prisma.fileJob.update({ where: { id }, data: { status: "CANCELLED", cancelRequested: true, finishedAt: new Date() } });
  } else if (job.status === "PROCESSING") {
    await prisma.fileJob.update({ where: { id }, data: { cancelRequested: true } });
  } else throw new HttpError(409, "Bu vazifani endi bekor qilib bo‘lmaydi.");
  return json({ ok: true });
});
