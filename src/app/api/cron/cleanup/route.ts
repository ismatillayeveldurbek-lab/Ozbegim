import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/server/db";
import { cleanupExpired, drainQueue, recoverStaleJobs } from "@/lib/server/file-jobs";
import { handle, HttpError, json } from "@/lib/server/http";

export const maxDuration = 300;

/**
 * Davriy tozalash (Vercel Cron yoki boshqa rejalashtiruvchi).
 * Faqat `Authorization: Bearer <CRON_SECRET>` bilan; CRON_SECRET sozlanmagan bo‘lsa — o‘chirilgan.
 */
export const GET = handle(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) throw new HttpError(503, "Cron sozlanmagan (CRON_SECRET).", "CRON_DISABLED");
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, "Ruxsat yo‘q.", "UNAUTHORIZED");
  await recoverStaleJobs();
  const processed = await drainQueue(20);
  const cleaned = await cleanupExpired();
  // Eskirgan rate-limit yozuvlari (1 kundan eski oynalar)
  const rl = await prisma.appRateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } } });
  return json({ processed, ...cleaned, rateLimitRowsDeleted: rl.count });
});
