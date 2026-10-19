import { prisma } from "@/lib/server/db";
import { deleteJob, serializeJob } from "@/lib/server/file-jobs";
import { handle, HttpError, json, requireUser } from "@/lib/server/http";
import { storage } from "@/lib/server/storage";


type Ctx = { params: Promise<{ id: string }> };

async function ownJob(req: Request, ctx: Ctx) {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const job = await prisma.fileJob.findUnique({ where: { id } });
  // Boshqa foydalanuvchining fayli mavjudligini ham oshkor qilmaymiz — 404.
  if (!job || job.userId !== user.id) throw new HttpError(404, "Fayl topilmadi.");
  return { user, job };
}

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { job } = await ownJob(req, ctx);
  let review = null;
  if (job.textKey) review = JSON.parse((await storage().get(job.textKey)).toString("utf8"));
  return json({ ...serializeJob(job), review });
});

/** Foydalanuvchi o‘z faylini muddatidan oldin o‘chiradi (asl fayl ham, natija ham). */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { job } = await ownJob(req, ctx);
  await deleteJob(job.id);
  return json({ ok: true });
});
