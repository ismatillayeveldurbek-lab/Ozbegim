import { z } from "zod";
import { openThread, setStatus } from "@/lib/server/feedback";
import { handle, json, readJson, requireUser } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Yozishmani ochish (o‘qilgan deb belgilanadi) */
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser(req);
  return json({ item: await openThread((await ctx.params).id, user) });
});

/** Holatni o‘zgartirish: muallif — yopish; xodim — yopish yoki qayta ochish */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser(req);
  const body = await readJson(req, z.object({ status: z.enum(["OPEN", "CLOSED"]) }));
  return json({ item: await setStatus((await ctx.params).id, user, body.status) });
});
