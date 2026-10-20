import { z } from "zod";
import { clientIp, handle, json, readJson, assertSameOrigin } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/session";
import { analyzeWordAi, validateWord } from "@/lib/server/word-analyzer";

/** So‘z tahlilchisi. Kirish majburiy emas; AI xarajatini cheklash uchun rate limit. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, z.object({ word: z.unknown() }), 2000);
  const word = validateWord(body.word);
  const user = await getCurrentUser(req.headers);
  if (user) await enforceRateLimit(`wa:user:${user.id}`, 60, 3600);
  else await enforceRateLimit(`wa:ip:${clientIp(req)}`, 20, 3600);
  const { result, cached } = await analyzeWordAi(word);
  return json({ word, result, cached, label: "AI taxmini" });
});
