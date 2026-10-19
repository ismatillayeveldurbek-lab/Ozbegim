import { z } from "zod";
import { assertNotSpam, commentSchema, contentHash } from "@/lib/server/comments";
import { prisma } from "@/lib/server/db";
import { getOrCreateDiscussion, listComments } from "@/lib/server/dictionary";
import { clientIp, handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/session";

/** Muhokamadagi izohlar (kirish talab qilinmaydi). */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const kind = z.enum(["LOANWORD", "IDIOM"]).parse(url.searchParams.get("kind") ?? "LOANWORD");
  const term = z.string().trim().min(1).max(120).parse(url.searchParams.get("term") ?? "");
  const viewer = await getCurrentUser(req.headers);
  return json(await listComments(kind, term, viewer?.id));
});

/** Yangi izoh (kirish talab qilinadi). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req, commentSchema, 20_000);
  if (body.website) throw new HttpError(400, "So‘rov rad etildi.", "SPAM");
  await enforceRateLimit(`comment:user:${user.id}`, 5, 600);
  await enforceRateLimit(`comment:ip:${clientIp(req)}`, 20, 3600);
  assertNotSpam(`${body.proposal}\n${body.explanation}\n${body.example ?? ""}`);

  const discussion = await getOrCreateDiscussion(body.kind, body.term);
  const hash = contentHash(body.proposal, body.explanation);
  try {
    const c = await prisma.comment.create({
      data: {
        discussionId: discussion.id,
        userId: user.id,
        proposal: body.proposal,
        explanation: body.explanation,
        example: body.example || null,
        sourceUrl: body.sourceUrl || null,
        contentHash: hash,
      },
    });
    return json({ id: c.id, discussionId: discussion.id }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "Siz bu izohni allaqachon qoldirgansiz.", "DUPLICATE");
    throw e;
  }
});
