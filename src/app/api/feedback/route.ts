import { createFeedback, createInput, listOwn } from "@/lib/server/feedback";
import { handle, json, readJson, requireUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

/** Foydalanuvchining o‘z murojaatlari */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  return json({ items: await listOwn(user) });
});

/** Yangi murojaat */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req, createInput, 30_000);
  await enforceRateLimit(`feedback:${user.id}`, 10, 3600);
  return json({ item: await createFeedback(user, body) }, { status: 201 });
});
