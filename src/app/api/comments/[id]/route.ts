import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, requireUser } from "@/lib/server/http";

/** Muallif o‘z izohini o‘chirishi. */
export const DELETE = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const c = await prisma.comment.findUnique({ where: { id } });
  if (!c || c.userId !== user.id) throw new HttpError(404, "Izoh topilmadi.");
  await prisma.comment.delete({ where: { id } });
  return json({ ok: true });
});
