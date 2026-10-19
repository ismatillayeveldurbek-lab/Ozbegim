import { Panel } from "@/components/ui/primitives";
import { prisma } from "@/lib/server/db";

export default async function AdminHome() {
  const [notFound, popular, idioms, loanwords, comments, openReports, users] = await Promise.all([
    prisma.searchStat.findMany({ where: { misses: { gt: 0 } }, orderBy: { misses: "desc" }, take: 20 }),
    prisma.searchStat.findMany({ where: { hits: { gt: 0 } }, orderBy: { hits: "desc" }, take: 20 }),
    prisma.idiom.groupBy({ by: ["origin", "status"], _count: true }),
    prisma.loanword.groupBy({ by: ["origin", "status"], _count: true }),
    prisma.comment.groupBy({ by: ["status"], _count: true }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.user.count(),
  ]);
  const sum = (rows: Array<{ _count: number }>) => rows.reduce((a, r) => a + r._count, 0);
  const verified = (rows: Array<{ _count: number; status: string; origin: string }>) =>
    rows.filter((r) => r.status === "VERIFIED" && r.origin !== "DEMO").reduce((a, r) => a + r._count, 0);
  const demo = (rows: Array<{ _count: number; origin: string }>) => rows.filter((r) => r.origin === "DEMO").reduce((a, r) => a + r._count, 0);
  const tiles = [
    { label: "Iboralar", value: sum(idioms), sub: `${verified(idioms)} tasdiqlangan · ${demo(idioms)} namuna` },
    { label: "O‘zlashma so‘zlar", value: sum(loanwords), sub: `${verified(loanwords)} tasdiqlangan · ${demo(loanwords)} namuna` },
    { label: "Izohlar", value: sum(comments), sub: comments.map((c) => `${c.status}: ${c._count}`).join(" · ") || "—" },
    { label: "Ochiq shikoyatlar", value: openReports, sub: "Ko‘rib chiqilishi kerak" },
    { label: "Foydalanuvchilar", value: users, sub: "Ro‘yxatdan o‘tganlar" },
  ];
  const kindLabel: Record<string, string> = { idiom: "ibora", loanword: "o‘zlashma", word: "so‘z" };
  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((t) => (
          <li key={t.label} className="glass p-4">
            <p className="text-sm font-semibold text-ink-muted">{t.label}</p>
            <p className="text-3xl font-extrabold">{t.value}</p>
            <p className="text-sm text-ink-muted">{t.sub}</p>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="text-lg font-bold">Topilmagan so‘rovlar</h3>
          <p className="text-sm text-ink-muted">Bazaga qo‘shish uchun nomzodlar (normallashtirilgan kalit bo‘yicha).</p>
          <table className="mt-3 w-full text-left text-[0.95rem]">
            <thead className="text-sm text-ink-muted">
              <tr>
                <th className="py-1">So‘rov</th>
                <th>Turi</th>
                <th className="text-right">Topilmadi</th>
              </tr>
            </thead>
            <tbody>
              {notFound.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-1.5">{s.display}</td>
                  <td>{kindLabel[s.kind] ?? s.kind}</td>
                  <td className="text-right">{s.misses}</td>
                </tr>
              ))}
              {!notFound.length && (
                <tr>
                  <td colSpan={3} className="py-2 text-ink-muted">
                    Hozircha ma’lumot yo‘q.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
        <Panel>
          <h3 className="text-lg font-bold">Ko‘p qidirilganlar</h3>
          <table className="mt-3 w-full text-left text-[0.95rem]">
            <thead className="text-sm text-ink-muted">
              <tr>
                <th className="py-1">So‘rov</th>
                <th>Turi</th>
                <th className="text-right">Topildi</th>
              </tr>
            </thead>
            <tbody>
              {popular.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-1.5">{s.display}</td>
                  <td>{kindLabel[s.kind] ?? s.kind}</td>
                  <td className="text-right">{s.hits}</td>
                </tr>
              ))}
              {!popular.length && (
                <tr>
                  <td colSpan={3} className="py-2 text-ink-muted">
                    Hozircha ma’lumot yo‘q.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
