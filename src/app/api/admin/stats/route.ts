import { prisma } from "@/lib/server/db";
import { handle, json, requireStaff } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  await requireStaff(req);
  const [notFound, popular, counts] = await Promise.all([
    prisma.searchStat.findMany({ where: { misses: { gt: 0 } }, orderBy: { misses: "desc" }, take: 50 }),
    prisma.searchStat.findMany({ orderBy: { hits: "desc" }, where: { hits: { gt: 0 } }, take: 50 }),
    Promise.all([
      prisma.idiom.groupBy({ by: ["status", "origin"], _count: true }),
      prisma.loanword.groupBy({ by: ["status", "origin"], _count: true }),
      prisma.comment.groupBy({ by: ["status"], _count: true }),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.user.count(),
    ]),
  ]);
  const [idioms, loanwords, comments, openReports, users] = counts;
  return json({ notFound, popular, idioms, loanwords, comments, openReports, users });
});
