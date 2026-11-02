/**
 * Server ishga tushganda:
 * - Render’da (RENDER_EXTERNAL_URL bor) servis uxlab qolmasligi uchun o‘ziga davriy so‘rov yuboradi;
 * - bitta servisli joylashtirishda (FILE_PROCESSING=inline) alohida fon ishchisi o‘rniga
 *   veb-jarayonning o‘zi navbatni ishlaydi va muddati o‘tgan fayllarni davriy tozalaydi.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startKeepAwake } = await import("./lib/server/keep-awake");
  startKeepAwake();
  if (process.env.FILE_PROCESSING !== "inline") return;
  const { startInlineMaintenance } = await import("./lib/server/inline-maintenance");
  startInlineMaintenance();
}
