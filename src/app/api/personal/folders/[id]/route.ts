import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, requireUser } from "@/lib/server/http";

/** Papka o‘chiriladi, ichidagi yozuvlar papkasiz qoladi. */
export const DELETE = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const f = await prisma.folder.findUnique({ where: { id } });
  if (!f || f.userId !== user.id) throw new HttpError(404, "Papka topilmadi.");
  await prisma.folder.delete({ where: { id } });
  return json({ ok: true });
});
