import { z } from "zod";
import { assertSameOrigin, clientIp, handle, json, readJson } from "@/lib/server/http";
import { explainLoanwordAi, validateLoanword } from "@/lib/server/loanword-ai";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/session";

/** Bazada yo‘q o‘zlashma so‘z uchun izoh. Kirish majburiy emas; xarajatni cheklash uchun rate limit. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, z.object({ word: z.unknown() }), 2000);
  const word = validateLoanword(body.word);
  const user = await getCurrentUser(req.headers);
  if (user) await enforceRateLimit(`oz:user:${user.id}`, 60, 3600);
  else await enforceRateLimit(`oz:ip:${clientIp(req)}`, 20, 3600);
  const { result, cached } = await explainLoanwordAi(word, user?.id);
  return json({ word, result, cached });
});
