/**
 * Bitta servisli joylashtirish (masalan, Railway): FILE_PROCESSING=inline bo‘lsa, alohida
 * fon ishchisi o‘rniga veb-jarayonning o‘zi navbatni ishlaydi va muddati o‘tgan fayllarni
 * davriy tozalaydi. Worker rejimida hech narsa qilmaydi.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.FILE_PROCESSING !== "inline") return;
  const { startInlineMaintenance } = await import("./lib/server/inline-maintenance");
  startInlineMaintenance();
}
