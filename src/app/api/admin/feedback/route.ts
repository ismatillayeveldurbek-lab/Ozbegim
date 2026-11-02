import { z } from "zod";
import { listForStaff } from "@/lib/server/feedback";
import { handle, json, requireStaff } from "@/lib/server/http";

/** Murojaatlar ro‘yxati (admin va moderatorlar) */
export const GET = handle(async (req: Request) => {
  await requireStaff(req);
  const status = z.enum(["OPEN", "ANSWERED", "CLOSED"]).default("OPEN").parse(new URL(req.url).searchParams.get("status") || undefined);
  return json({ items: await listForStaff(status) });
});
