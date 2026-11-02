/**
 * Murojaatlar: foydalanuvchi kamchilik, shikoyat, taklif yoki savol yuboradi; admin va moderatorlar javob beradi.
 * Har bir murojaat — yozishma (thread). Faqat muallif va xodimlar ko‘ra oladi.
 */
import { z } from "zod";
import { audit } from "./audit";
import { prisma } from "./db";
import { HttpError } from "./http";
import { type CurrentUser, isStaff } from "./session";

export const FEEDBACK_KINDS = ["BUG", "COMPLAINT", "SUGGESTION", "QUESTION"] as const;

export const createInput = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  subject: z.string().trim().min(3, "Mavzu kamida 3 belgi bo‘lsin.").max(150, "Mavzu 150 belgidan oshmasin."),
  body: z.string().trim().min(5, "Xabar kamida 5 belgi bo‘lsin.").max(5000, "Xabar 5000 belgidan oshmasin."),
  pageUrl: z.string().trim().max(500).optional(),
});
export const messageInput = z.object({ body: z.string().trim().min(1, "Xabar bo‘sh.").max(5000, "Xabar 5000 belgidan oshmasin.") });

const threadInclude = {
  user: { select: { id: true, name: true, email: true } },
  messages: { orderBy: { createdAt: "asc" as const }, include: { author: { select: { name: true, role: true } } } },
};

/** Murojaatni muallif yoki xodim ko‘ra oladi; boshqalar uchun "topilmadi" (mavjudligi oshkor qilinmaydi). */
async function loadFor(id: string, user: CurrentUser) {
  const fb = await prisma.feedback.findUnique({ where: { id }, include: threadInclude });
  if (!fb || (fb.userId !== user.id && !isStaff(user))) throw new HttpError(404, "Murojaat topilmadi.", "NOT_FOUND");
  return fb;
}

export async function createFeedback(user: CurrentUser, input: z.infer<typeof createInput>) {
  return prisma.feedback.create({
    data: {
      userId: user.id,
      kind: input.kind,
      subject: input.subject,
      pageUrl: input.pageUrl || null,
      messages: { create: { authorId: user.id, fromStaff: false, body: input.body } },
    },
    include: threadInclude,
  });
}

export async function listOwn(user: CurrentUser) {
  return prisma.feedback.findMany({ where: { userId: user.id }, orderBy: { lastMessageAt: "desc" }, take: 100, include: threadInclude });
}

export async function listForStaff(status: "OPEN" | "ANSWERED" | "CLOSED") {
  return prisma.feedback.findMany({ where: { status }, orderBy: { lastMessageAt: status === "OPEN" ? "asc" : "desc" }, take: 200, include: threadInclude });
}

/** Ochilganda o‘qilgan deb belgilanadi (muallif — xodim javobini, xodim — foydalanuvchi xabarini). */
export async function openThread(id: string, user: CurrentUser) {
  const fb = await loadFor(id, user);
  const own = fb.userId === user.id;
  if (own && fb.userUnread) await prisma.feedback.update({ where: { id }, data: { userUnread: false } });
  else if (!own && fb.staffUnread) await prisma.feedback.update({ where: { id }, data: { staffUnread: false } });
  return { ...fb, userUnread: own ? false : fb.userUnread, staffUnread: own ? fb.staffUnread : false };
}

export async function addMessage(id: string, user: CurrentUser, body: string) {
  const fb = await loadFor(id, user);
  // Xodim o‘z murojaatiga yozsa — foydalanuvchi sifatida (o‘ziga javob bermaydi)
  const fromStaff = fb.userId !== user.id;
  await prisma.$transaction([
    prisma.feedbackMessage.create({ data: { feedbackId: id, authorId: user.id, fromStaff, body } }),
    prisma.feedback.update({
      where: { id },
      data: fromStaff
        ? { status: "ANSWERED", userUnread: true, staffUnread: false, lastMessageAt: new Date() }
        : { status: "OPEN", staffUnread: true, lastMessageAt: new Date() },
    }),
  ]);
  if (fromStaff) await audit(user.id, "feedback.reply", "Feedback", id);
  return loadFor(id, user);
}

export async function setStatus(id: string, user: CurrentUser, status: "OPEN" | "CLOSED") {
  const fb = await loadFor(id, user);
  const staff = fb.userId !== user.id;
  // Muallif faqat yopa oladi; qayta ochish — yangi xabar yozish orqali yoki xodim tomonidan
  if (!staff && status !== "CLOSED") throw new HttpError(403, "Murojaatni qayta ochish uchun yangi xabar yozing.", "FORBIDDEN");
  await prisma.feedback.update({ where: { id }, data: { status, ...(status === "OPEN" && staff ? { staffUnread: true } : {}) } });
  if (staff) await audit(user.id, status === "CLOSED" ? "feedback.close" : "feedback.reopen", "Feedback", id);
  return loadFor(id, user);
}

export async function unreadCounts(user: CurrentUser) {
  const [mine, staff] = await Promise.all([
    prisma.feedback.count({ where: { userId: user.id, userUnread: true } }),
    isStaff(user) ? prisma.feedback.count({ where: { staffUnread: true, status: { not: "CLOSED" } } }) : Promise.resolve(0),
  ]);
  return { mine, staff };
}
