import { z } from "zod";
import { nextQuestion } from "@/lib/server/exercises";
import { handle, json, requireUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const type = z.enum(["idiom_meaning", "loanword_alternative", "spelling", "translit"]).parse(new URL(req.url).searchParams.get("type"));
  await enforceRateLimit(`ex:${user.id}`, 300, 3600);
  return json(await nextQuestion(user.id, type));
});
