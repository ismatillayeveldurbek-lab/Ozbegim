import Link from "next/link";
import { ProviderCheck } from "@/components/admin/ProviderCheck";
import { Notice, Panel } from "@/components/ui/primitives";
import { prisma } from "@/lib/server/db";
import { getCurrentUser, isAdmin } from "@/lib/server/session";

const PERIODS = [
  { key: "bugun", label: "Bugun", days: 1 },
  { key: "7", label: "7 kun", days: 7 },
  { key: "30", label: "30 kun", days: 30 },
  { key: "hammasi", label: "Hammasi", days: 0 },
] as const;

const FEATURE: Record<string, string> = { spelling: "Imlo tavsiyalari", analyze: "Gap tahlili", word: "So‘z tahlilchisi", translate: "Tarjimon", check: "Xizmat tekshiruvi" };
const PROVIDER: Record<string, string> = { gemini: "Gemini", openai: "Groq (bepul)", anthropic: "Claude" };

const num = (n: number) => n.toLocaleString("ru-RU");
/** Kichik summalar ham ko‘rinsin: $0.0012 */
const usd = (n: number) => `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`;
/** USD_UZS berilsa — so‘mda ham ko‘rsatiladi */
const RATE = Number(process.env.USD_UZS ?? 0);
const money = (n: number) => (RATE > 0 ? `${usd(n)} · ${num(Math.round(n * RATE))} so‘m` : usd(n));

type Sum = { _count: number; _sum: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null } };
const t = (s: Sum) => ({ n: s._count, inp: s._sum.inputTokens ?? 0, out: s._sum.outputTokens ?? 0, cost: s._sum.costUsd ?? 0 });

export default async function Page({ searchParams }: { searchParams: Promise<{ davr?: string }> }) {
  if (!isAdmin(await getCurrentUser())) return <Notice kind="danger">Xarajatlar faqat administratorlar uchun.</Notice>;
  const { davr } = await searchParams;
  const period = PERIODS.find((p) => p.key === davr) ?? PERIODS[1];
  const since = period.days === 1 ? new Date(new Date().setHours(0, 0, 0, 0)) : period.days ? new Date(Date.now() - period.days * 86_400_000) : undefined;
  const where = since ? { createdAt: { gte: since } } : {};
  const agg = { _count: true, _sum: { inputTokens: true, outputTokens: true, costUsd: true } } as const;

  const [total, byUser, byFeature, byModel] = await Promise.all([
    prisma.aiUsage.aggregate({ where, ...agg }),
    prisma.aiUsage.groupBy({ by: ["userId"], where, ...agg, orderBy: { _sum: { costUsd: "desc" } }, take: 100 }),
    prisma.aiUsage.groupBy({ by: ["feature"], where, ...agg }),
    prisma.aiUsage.groupBy({ by: ["provider", "model"], where, ...agg }),
  ]);
  const ids = byUser.map((u) => u.userId).filter((x): x is string => !!x);
  const users = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
  const all = t(total as unknown as Sum);

  const tiles = [
    { label: "So‘rovlar", value: num(all.n) },
    { label: "Kiruvchi tokenlar", value: num(all.inp) },
    { label: "Chiquvchi tokenlar", value: num(all.out) },
    { label: "Taxminiy xarajat", value: money(all.cost) },
  ];

  const Table = ({ head, rows }: { head: string; rows: Array<{ key: string; name: React.ReactNode; s: ReturnType<typeof t> }> }) => (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[0.95rem]">
        <thead className="text-sm text-ink-muted">
          <tr>
            <th className="py-1">{head}</th>
            <th className="text-right">So‘rov</th>
            <th className="text-right">Kirish token</th>
            <th className="text-right">Chiqish token</th>
            <th className="text-right">Xarajat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="py-1.5">{r.name}</td>
              <td className="text-right">{num(r.s.n)}</td>
              <td className="text-right">{num(r.s.inp)}</td>
              <td className="text-right">{num(r.s.out)}</td>
              <td className="text-right whitespace-nowrap">{money(r.s.cost)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={5} className="py-2 text-ink-muted">
                Bu davrda so‘rov bo‘lmagan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <nav aria-label="Davr" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/admin/xarajat?davr=${p.key}`}
            aria-current={p.key === period.key ? "page" : undefined}
            className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold ${p.key === period.key ? "bg-accent text-accent-ink" : "glass text-ink-soft hover:bg-accent-soft"}`}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <Panel>
        <h3 className="text-lg font-bold">Xizmatlar holati</h3>
        <p className="mb-2 text-sm text-ink-muted">Har bir ulangan xizmatga bitta kichik so‘rov yuboriladi (narxi deyarli nol).</p>
        <ProviderCheck />
      </Panel>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((x) => (
          <li key={x.label} className="glass p-4">
            <p className="text-sm font-semibold text-ink-muted">{x.label}</p>
            <p className="text-2xl font-extrabold">{x.value}</p>
          </li>
        ))}
      </ul>
      <Panel>
        <h3 className="text-lg font-bold">Foydalanuvchilar bo‘yicha</h3>
        <Table
          head="Foydalanuvchi"
          rows={byUser.map((u) => {
            const info = u.userId ? users.get(u.userId) : null;
            return {
              key: u.userId ?? "mehmon",
              name: info ? (
                <>
                  {info.name} <span className="text-sm text-ink-muted">{info.email}</span>
                </>
              ) : u.userId ? (
                "O‘chirilgan foydalanuvchi"
              ) : (
                <span className="text-ink-muted">Mehmonlar (tizimga kirmagan)</span>
              ),
              s: t(u as unknown as Sum),
            };
          })}
        />
      </Panel>
      <div className="grid grid-cols-1 gap-4">
        <Panel>
          <h3 className="text-lg font-bold">Bo‘limlar bo‘yicha</h3>
          <Table head="Bo‘lim" rows={byFeature.map((f) => ({ key: f.feature, name: FEATURE[f.feature] ?? f.feature, s: t(f as unknown as Sum) }))} />
        </Panel>
        <Panel>
          <h3 className="text-lg font-bold">Xizmat va model bo‘yicha</h3>
          <Table
            head="Model"
            rows={byModel.map((m) => ({
              key: `${m.provider}|${m.model}`,
              name: (
                <>
                  {PROVIDER[m.provider] ?? m.provider} <span className="font-mono text-xs text-ink-muted">{m.model}</span>
                </>
              ),
              s: t(m as unknown as Sum),
            }))}
          />
        </Panel>
      </div>
      <Notice kind="info">
        Xarajat taxminiy: token soni Claude javobidan olinadi, narx esa tarif bo‘yicha hisoblanadi (Claude Haiku 5.5: $0.10 / $0.50 — 1 mln
        kirish / chiqish tokeni uchun). Aniq hisob — Claude Console → Cost &amp; spend. Tarifni ANTHROPIC_PRICE_IN / ANTHROPIC_PRICE_OUT, so‘m kursini
        USD_UZS o‘zgaruvchisi bilan o‘zgartirish mumkin. Foydalanuvchi matni saqlanmaydi.
      </Notice>
    </>
  );
}
