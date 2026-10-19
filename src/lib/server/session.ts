import { headers } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./db";

export type Role = "user" | "moderator" | "admin";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
  historyMode: "off" | "meta" | "full";
}

/**
 * Joriy foydalanuvchi. Rol va bloklanganlik holati har safar bazadan o‘qiladi —
 * sessiya keshiga yoki frontendga ishonilmaydi.
 */
export async function getCurrentUser(reqHeaders?: Headers): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: reqHeaders ?? (await headers()) });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, banned: true, historyMode: true },
  });
  if (!user) return null;
  return user as CurrentUser;
}

export function isStaff(user: CurrentUser | null): boolean {
  return !!user && !user.banned && (user.role === "admin" || user.role === "moderator");
}

export function isAdmin(user: CurrentUser | null): boolean {
  return !!user && !user.banned && user.role === "admin";
}
