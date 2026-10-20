import { z } from "zod";
import { assertSameOrigin, clientIp, handle, json, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/session";
import { MAX_TRANSLATE_CHARS, translateForTourist } from "@/lib/server/tourist-translator";

/** Turistlar uchun tarjima (istalgan til → o‘zbek, lotin). Matn saqlanmaydi va loglarga yozilmaydi. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, z.object({ text: z.string().max(MAX_TRANSLATE_CHARS * 2) }), 20_000);
  const user = await getCurrentUser(req.headers);
  if (user) await enforceRateLimit(`tr:user:${user.id}`, 100, 3600);
  else await enforceRateLimit(`tr:ip:${clientIp(req)}`, 30, 3600);
  return json(await translateForTourist(body.text));
});
