import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { handle, requireAdmin } from "@/lib/server/http";

/** Lug‘at ma’lumotlarining to‘liq JSON zaxirasi (foydalanuvchi ma’lumotlarisiz). To‘liq zaxira uchun pg_dump — README’ga qarang. */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const [sources, idioms, loanwords, lexemes, spelling, discussions] = await Promise.all([
    prisma.source.findMany(),
    prisma.idiom.findMany({ include: { senses: true } }),
    prisma.loanword.findMany({ include: { alternatives: true, examples: true, variantKeys: true } }),
    prisma.lexeme.findMany(),
    prisma.spellingPair.findMany(),
    prisma.discussion.findMany({ include: { comments: { select: { id: true, proposal: true, explanation: true, example: true, sourceUrl: true, status: true, score: true, createdAt: true } } } }),
  ]);
  await audit(admin.id, "backup.download", "Dictionary", null, { idioms: idioms.length, loanwords: loanwords.length });
  const body = JSON.stringify({ format: "ozbegim-backup-v1", createdAt: new Date().toISOString(), sources, idioms, loanwords, lexemes, spelling, discussions }, null, 1);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="ozbegim-zaxira-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});
