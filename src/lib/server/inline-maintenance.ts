import { cleanupExpired, drainQueue, recoverStaleJobs } from "./file-jobs";

const QUEUE_EVERY_MS = 30_000;
const CLEANUP_EVERY_MS = Number(process.env.CLEANUP_EVERY_MS ?? 10 * 60_000);

let started = false;
let busy = false;
let lastCleanup = 0;

/** Navbatdagi (masalan, qayta ishga tushishdan oldin qolgan) vazifalar va tozalash. */
export function startInlineMaintenance() {
  if (started) return;
  started = true;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      if (Date.now() - lastCleanup > CLEANUP_EVERY_MS) {
        await recoverStaleJobs();
        const r = await cleanupExpired();
        if (r.jobs || r.objects) console.log(`[inline] tozalandi: ${r.jobs} vazifa, ${r.objects} obyekt`);
        lastCleanup = Date.now();
      }
      await drainQueue(10);
    } catch (e) {
      console.error("[inline] xato:", e instanceof Error ? e.message : "noma’lum");
    } finally {
      busy = false;
    }
  };
  setTimeout(tick, 5_000);
  setInterval(tick, QUEUE_EVERY_MS).unref();
}
