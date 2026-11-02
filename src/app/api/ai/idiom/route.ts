import { z } from "zod";
import { assertSameOrigin, clientIp, handle, json, readJson } from "@/lib/server/http";
import { explainIdiomAi, validatePhrase } from "@/lib/server/idiom-ai";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/session";

/** Bazada yo‘q ibora uchun taxminiy izoh. Kirish majburiy emas; xarajatni cheklash uchun rate limit. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, z.object({ phrase: z.unknown() }), 2000);
  const phrase = validatePhrase(body.phrase);
  const user = await getCurrentUser(req.headers);
  if (user) await enforceRateLimit(`ib:user:${user.id}`, 60, 3600);
  else await enforceRateLimit(`ib:ip:${clientIp(req)}`, 20, 3600);
  const { result, cached } = await explainIdiomAi(phrase, user?.id);
  return json({ phrase, result, cached, label: "Taxmin" });
});
