import { z } from "zod";
import { assertSameOrigin, clientIp, handle, json, readJson } from "@/lib/server/http";
import { analyzeMorphAi } from "@/lib/server/morph-ai";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/session";

/** So‘z tarkibi tahlili (tashqi xizmat). Kirish majburiy emas; xarajatni cheklash uchun rate limit. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, z.object({ word: z.unknown() }), 2000);
  const user = await getCurrentUser(req.headers);
  if (user) await enforceRateLimit(`tarkib:user:${user.id}`, 120, 3600);
  else await enforceRateLimit(`tarkib:ip:${clientIp(req)}`, 40, 3600);
  return json(await analyzeMorphAi(body.word, user?.id));
});
