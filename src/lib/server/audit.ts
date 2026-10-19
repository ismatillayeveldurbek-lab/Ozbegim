import type { Prisma } from "@generated/prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Muhim admin o‘zgarishlarini audit jurnaliga yozadi. Shaxsiy matnlar yozilmaydi. */
export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
  tx: Tx = prisma,
) {
  await tx.auditLog.create({
    data: { actorId, action, entityType, entityId, details: details as Prisma.InputJsonValue },
  });
}
