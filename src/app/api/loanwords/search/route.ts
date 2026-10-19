import { LOANWORD_NOT_FOUND_MESSAGE as NOT_FOUND_MESSAGE, listComments, searchLoanwords, serializeLoanword } from "@/lib/server/dictionary";
import { clientIp, handle, HttpError, json } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/session";

export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  if (!q.trim()) throw new HttpError(400, "Qidiruv so‘zini kiriting.");
  await enforceRateLimit(`search:${clientIp(req)}`, 120, 60);
  const r = await searchLoanwords(q, { record: url.searchParams.get("record") === "1" });
  const viewer = await getCurrentUser(req.headers);
  // Izohlar muhokamasi doim normallashtirilgan kalitga bog‘lanadi (lotin/kirill/apostrof variantlari — bitta muhokama).
  const discussionTerm = r.exact ? r.exact.word : q;
  const discussion = await listComments("LOANWORD", discussionTerm, viewer?.id);
  return json({
    key: r.key,
    exact: r.exact ? serializeLoanword(r.exact) : null,
    near: r.near.map(serializeLoanword),
    notFoundMessage: r.exact ? null : NOT_FOUND_MESSAGE,
    discussion,
  });
});
