/**
 * Muddati o‘tgan fayllarni bir martalik tozalash (cron uchun):
 *   npm run cleanup
 */
import "dotenv/config";
import { prisma } from "../src/lib/server/db";
import { cleanupExpired, recoverStaleJobs } from "../src/lib/server/file-jobs";

(async () => {
  await recoverStaleJobs();
  const r = await cleanupExpired();
  console.log(`Tozalandi: ${r.jobs} ta vazifa, ${r.objects} ta saqlangan obyekt.`);
})()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
