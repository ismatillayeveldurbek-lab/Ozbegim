import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { loanwordInput, saveLoanword } from "@/lib/server/entries";
import { handle, HttpError, json, readJson, requireAdmin } from "@/lib/server/http";
import { normalizeKey } from "@/lib/uz/normalize";

/**
 * Hamjamiyat taklifini admin tahriri bilan tasdiqlangan lug‘at yozuviga aylantirish.
 * Mavjud yozuv bo‘lsa yangilanadi (admin yuborgan to‘liq ma’lumot bilan).
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const input = await readJson(req, loanwordInput, 100_000);
  const comment = await prisma.comment.findUnique({ where: { id }, include: { discussion: true } });
  if (!comment) throw new HttpError(404, "Izoh topilmadi.");
  if (comment.discussion.kind !== "LOANWORD") throw new HttpError(400, "Faqat o‘zlashma so‘z takliflarini aylantirish mumkin.");
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.loanword.findUnique({ where: { key: normalizeKey(input.word) } });
    const saved = await saveLoanword(tx, { ...input, origin: existing?.origin ?? "COMMUNITY" }, existing?.id);
    await tx.comment.update({ where: { id }, data: { status: "ACCEPTED", moderatedById: admin.id, moderatedAt: new Date() } });
    await tx.discussion.update({ where: { id: comment.discussionId }, data: { loanwordId: saved.id } });
    await audit(admin.id, "comment.promote", "Loanword", saved.id, { commentId: id, status: input.status, updated: !!existing }, tx);
    return saved;
  });
  return json({ loanwordId: result.id });
});
