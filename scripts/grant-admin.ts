/**
 * Dastlabki administratorni xavfsiz tayinlash (faqat serverga/bazaga kirish huquqi bor operator uchun):
 *   1) Foydalanuvchi saytda oddiy tartibda ro‘yxatdan o‘tadi.
 *   2) Serverda: npm run admin:grant -- foydalanuvchi@pochta.uz [--role=admin|moderator|user]
 * Ro‘yxatdan o‘tgan birinchi foydalanuvchi avtomatik admin bo‘lmaydi.
 */
import "dotenv/config";
import { prisma } from "../src/lib/server/db";
import { audit } from "../src/lib/server/audit";

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const roleArg = process.argv.find((a) => a.startsWith("--role="))?.split("=")[1] ?? "admin";
  if (!email) throw new Error("Foydalanish: npm run admin:grant -- email@example.uz [--role=admin|moderator|user]");
  if (!["admin", "moderator", "user"].includes(roleArg)) throw new Error("Rol noto‘g‘ri. admin, moderator yoki user bo‘lishi mumkin.");
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new Error(`“${email}” bilan ro‘yxatdan o‘tgan foydalanuvchi topilmadi. Avval saytda ro‘yxatdan o‘ting.`);
  await prisma.user.update({ where: { id: user.id }, data: { role: roleArg } });
  await audit(null, "user.role_cli", "User", user.id, { role: roleArg, via: "scripts/grant-admin.ts" });
  console.log(`${user.email} foydalanuvchisiga “${roleArg}” roli berildi.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
