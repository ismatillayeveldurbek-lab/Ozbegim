import { after } from "next/server";
import { cleanupExpired, drainQueue } from "./file-jobs";

/**
 * Inline rejim: vazifalarni javob yuborilgandan keyin shu funksiyada bajarish.
 * after() so‘rov ichida SINXRON chaqirilishi shart (Vercel’da waitUntil bilan bog‘lanadi).
 * Faqat marshrut fayllaridan chaqiriladi — worker skriptlari bu modulni import qilmaydi.
 */
export function scheduleInlineProcessing() {
  if (process.env.FILE_PROCESSING !== "inline") return;
  after(async () => {
    await drainQueue(5).catch(() => {});
    // Kunlik cron’ni kutmasdan muddati o‘tganlarni ham tozalab boramiz.
    await cleanupExpired().catch(() => {});
  });
}
