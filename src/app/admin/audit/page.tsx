import { Notice, Panel } from "@/components/ui/primitives";
import { prisma } from "@/lib/server/db";
import { getCurrentUser, isAdmin } from "@/lib/server/session";

export default async function Page() {
  if (!isAdmin(await getCurrentUser())) return <Notice kind="danger">Audit jurnali faqat administratorlar uchun.</Notice>;
  const items = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { name: true } } } });
  return (
    <Panel>
      <h3 className="text-lg font-bold">Audit jurnali (oxirgi 200 ta)</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[0.95rem]">
          <thead className="text-sm text-ink-muted">
            <tr>
              <th className="py-1">Vaqt</th>
              <th>Kim</th>
              <th>Amal</th>
              <th>Obyekt</th>
              <th>Tafsilot</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-line align-top">
                <td className="py-1.5 whitespace-nowrap">{a.createdAt.toLocaleString("uz-UZ")}</td>
                <td>{a.actor?.name ?? "tizim"}</td>
                <td className="font-mono text-sm">{a.action}</td>
                <td className="text-sm">
                  {a.entityType} {a.entityId?.slice(0, 10)}
                </td>
                <td className="max-w-xs break-all font-mono text-xs">{JSON.stringify(a.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
