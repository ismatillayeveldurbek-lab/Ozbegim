import { afterAll, describe, expect, it } from "vitest";
import { Client, prisma } from "./helpers";

afterAll(() => prisma.$disconnect());

describe("Murojaatlar", () => {
  it("foydalanuvchi yuboradi, moderator javob beradi, faqat muallif va xodim ko‘radi", async () => {
    const user = new Client();
    await user.signUp("Murojaatchi");
    const other = new Client();
    await other.signUp("Begona");
    const mod = new Client();
    const m = await mod.signUp("Moderator");
    await prisma.user.update({ where: { id: m.id }, data: { role: "moderator" } });

    // Kirmagan foydalanuvchi yubora olmaydi
    expect((await new Client().json("/api/feedback", { method: "POST", json: { kind: "BUG", subject: "Test", body: "Xato bor" } })).status).toBe(401);
    // Noto‘g‘ri ma’lumot
    expect((await user.json("/api/feedback", { method: "POST", json: { kind: "BUG", subject: "a", body: "b" } })).status).toBe(400);

    const created = await user.json("/api/feedback", { method: "POST", json: { kind: "SUGGESTION", subject: "Yangi bo‘lim", body: "Maqollar bo‘limi qo‘shilsin.", pageUrl: "/iboralar" } });
    expect(created.status).toBe(201);
    const id = created.body.item.id;
    expect(created.body.item.status).toBe("OPEN");

    // Begona foydalanuvchi ko‘ra olmaydi va javob yoza olmaydi
    expect((await other.json(`/api/feedback/${id}`)).status).toBe(404);
    expect((await other.json(`/api/feedback/${id}/messages`, { method: "POST", json: { body: "salom" } })).status).toBe(404);
    expect((await other.json("/api/admin/feedback")).status).toBe(403);

    // Moderator ro‘yxatda ko‘radi va javob beradi
    const list = await mod.json("/api/admin/feedback?status=OPEN");
    expect(list.status).toBe(200);
    expect(list.body.items.some((x: { id: string; staffUnread: boolean }) => x.id === id && x.staffUnread)).toBe(true);
    const reply = await mod.json(`/api/feedback/${id}/messages`, { method: "POST", json: { body: "Rahmat, rejaga qo‘shdik." } });
    expect(reply.status).toBe(200);
    expect(reply.body.item.status).toBe("ANSWERED");
    expect(reply.body.item.messages.at(-1)).toMatchObject({ fromStaff: true, body: "Rahmat, rejaga qo‘shdik." });

    // Foydalanuvchida "yangi javob" belgisi; ochganda o‘qilgan bo‘ladi
    expect((await user.json("/api/feedback/unread")).body.mine).toBe(1);
    expect((await user.json(`/api/feedback/${id}`)).body.item.userUnread).toBe(false);
    expect((await user.json("/api/feedback/unread")).body.mine).toBe(0);

    // Foydalanuvchi qo‘shimcha yozadi — yana OPEN; yopadi; qayta ochish PATCH bilan mumkin emas
    expect((await user.json(`/api/feedback/${id}/messages`, { method: "POST", json: { body: "Qachon bo‘ladi?" } })).body.item.status).toBe("OPEN");
    expect((await user.json(`/api/feedback/${id}`, { method: "PATCH", json: { status: "CLOSED" } })).body.item.status).toBe("CLOSED");
    expect((await user.json(`/api/feedback/${id}`, { method: "PATCH", json: { status: "OPEN" } })).status).toBe(403);
    // Xodim qayta ochadi
    expect((await mod.json(`/api/feedback/${id}`, { method: "PATCH", json: { status: "OPEN" } })).body.item.status).toBe("OPEN");

    const mine = await user.json("/api/feedback");
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].messages).toHaveLength(3);
    expect(await prisma.auditLog.count({ where: { entityType: "Feedback", entityId: id } })).toBe(2);
  });
});
