/**
 * Fon ishchisi: fayl vazifalarini navbatdan olib bajaradi va muddati o‘tgan fayllarni tozalaydi.
 *   npm run worker
 * Bir nechta ishchi parallel ishlashi mumkin (navbat FOR UPDATE SKIP LOCKED bilan himoyalangan).
 */
import "dotenv/config";
import { prisma } from "../src/lib/server/db";
import { claimNextJob, cleanupExpired, processJob, recoverStaleJobs } from "../src/lib/server/file-jobs";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2000);
const CLEANUP_EVERY_MS = Number(process.env.CLEANUP_EVERY_MS ?? 10 * 60_000);
let stopping = false;
let lastCleanup = 0;

async function loop() {
  console.log("[worker] ishga tushdi");
  while (!stopping) {
    try {
      if (Date.now() - lastCleanup > CLEANUP_EVERY_MS) {
        await recoverStaleJobs();
        const r = await cleanupExpired();
        if (r.jobs || r.objects) console.log(`[worker] tozalandi: ${r.jobs} vazifa, ${r.objects} obyekt`);
        lastCleanup = Date.now();
      }
      const id = await claimNextJob();
      if (id) {
        const job = await processJob(id);
        console.log(`[worker] ${id}: ${job?.status}`);
        continue;
      }
    } catch (e) {
      console.error("[worker] xato:", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await prisma.$disconnect();
  console.log("[worker] to‘xtadi");
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));
loop();
