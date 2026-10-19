import { FORMAT_TABLE, type SupportLevel } from "@/lib/files/format-table";

const LEVEL: Record<SupportLevel, { text: string; cls: string; mark: string }> = {
  works: { text: "Ishlaydi", cls: "bg-accent-soft text-accent", mark: "✓" },
  limited: { text: "Cheklangan", cls: "bg-warn-soft text-warn", mark: "!" },
  not_connected: { text: "Xizmat ulanmagan", cls: "bg-info-soft text-info", mark: "○" },
  unsupported: { text: "Qo‘llanmaydi", cls: "bg-danger-soft text-danger", mark: "×" },
};

export function FormatTable({ ocrConnected }: { ocrConnected: boolean }) {
  const rows = FORMAT_TABLE.map((r) =>
    ocrConnected && r.level === "not_connected" && r.format === "JPG / PNG" ? { ...r, level: "limited" as const, note: "OCR (Tesseract) orqali; natijani tekshiring." } : r,
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[0.95rem]">
        <caption className="sr-only">Formatlar bo‘yicha qo‘llab-quvvatlash darajasi</caption>
        <thead className="text-sm text-ink-muted">
          <tr>
            <th className="py-2 pr-3">Format</th>
            <th className="pr-3">Holat</th>
            <th>Izoh</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const l = LEVEL[r.level];
            return (
              <tr key={r.format} className="border-t border-line align-top">
                <td className="py-2 pr-3 font-semibold">{r.format}</td>
                <td className="py-2 pr-3">
                  <span className={`chip whitespace-nowrap ${l.cls}`}>
                    <span aria-hidden>{l.mark}</span> {l.text}
                  </span>
                </td>
                <td className="py-2 text-ink-soft">{r.note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
