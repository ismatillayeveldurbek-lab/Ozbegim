import { addMessage, messageInput } from "@/lib/server/feedback";
import { handle, json, readJson, requireUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Yozishmaga xabar: muallif — qo‘shimcha; admin/moderator — javob */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser(req);
  const body = await readJson(req, messageInput, 30_000);
  await enforceRateLimit(`feedback-msg:${user.id}`, 60, 3600);
  return json({ item: await addMessage((await ctx.params).id, user, body.body) });
});
