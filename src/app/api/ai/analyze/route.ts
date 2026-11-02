import { z } from "zod";
import { assertSameOrigin, clientIp, handle, json, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { analyzeSentenceAi } from "@/lib/server/sentence-ai";
import { getCurrentUser } from "@/lib/server/session";

/** Gap bo‘laklari tahlili (tashqi xizmat). Kirish majburiy emas; xarajatni cheklash uchun rate limit. Matn loglarga yozilmaydi. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, z.object({ sentence: z.unknown() }), 4000);
  const user = await getCurrentUser(req.headers);
  if (user) await enforceRateLimit(`gap:user:${user.id}`, 60, 3600);
  else await enforceRateLimit(`gap:ip:${clientIp(req)}`, 20, 3600);
  return json(await analyzeSentenceAi(body.sentence, user?.id));
});
