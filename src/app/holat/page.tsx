import { FormatTable } from "@/components/converter/FormatTable";
import { PageIntro, Panel } from "@/components/ui/primitives";
import { FEATURES, type FeatureLevel } from "@/lib/features";
import { servicesStatus } from "@/lib/server/services";

export const metadata = { title: "Imkoniyatlar holati" };
export const dynamic = "force-dynamic";

const LEVEL: Record<FeatureLevel, { text: string; cls: string; mark: string }> = {
  works: { text: "Ishlaydi", cls: "bg-accent-soft text-accent", mark: "✓" },
  limited: { text: "Cheklangan", cls: "bg-warn-soft text-warn", mark: "!" },
  not_connected: { text: "Xizmat ulanmagan", cls: "bg-info-soft text-info", mark: "○" },
};

export default function Page() {
  const s = servicesStatus();
  const services: Array<{ name: string; level: FeatureLevel; note: string }> = [
    { name: "AI tavsiyalari (imlo, gap tahlili)", level: s.ai.connected ? "works" : "not_connected", note: s.ai.message },
    { name: "So‘z tahlilchisi (AI)", level: s.ai.connected ? "works" : "not_connected", note: s.ai.connected ? "Natijalar 30 kun keshlanadi; AI taxmini sifatida belgilanadi." : s.ai.message },
    { name: "Turistlar uchun tarjimon (AI)", level: s.ai.connected ? "works" : "not_connected", note: s.ai.connected ? "Matn saqlanmaydi." : s.ai.message },
    { name: "OCR — rasmdan matn ajratish", level: s.ocr.connected ? "limited" : "not_connected", note: s.ocr.message },
    { name: "Audio/video transkripsiyasi", level: "not_connected", note: s.transcription.message },
    { name: "Rasmdagi yozuvni almashtirish", level: "not_connected", note: "Amalga oshirilmagan." },
    { name: "Fayl saqlash", level: "works", note: s.storage.driver === "s3" ? "S3 bilan mos yopiq saqlash." : "Server diskidagi yopiq papka." },
  ];
  const row = (f: { name: string; level: FeatureLevel; note: string }) => (
    <tr key={f.name} className="border-t border-line align-top">
      <td className="py-2 pr-3 font-semibold">{f.name}</td>
      <td className="py-2 pr-3">
        <span className={`chip whitespace-nowrap ${LEVEL[f.level].cls}`}>
          <span aria-hidden>{LEVEL[f.level].mark}</span> {LEVEL[f.level].text}
        </span>
      </td>
      <td className="py-2 text-ink-soft">{f.note}</td>
    </tr>
  );
  return (
    <>
      <PageIntro title="Imkoniyatlar holati">Qaysi vositalar to‘liq ishlayotgani, qaysilari cheklangan va qaysi tashqi xizmatlar ulanmagani.</PageIntro>
      <div className="flex flex-col gap-4">
        {[
          ["Vositalar", FEATURES],
          ["Tashqi xizmatlar", services],
        ].map(([title, list]) => (
          <Panel key={title as string}>
            <h3 className="mb-2 text-lg font-bold">{title as string}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[0.95rem]">
                <tbody>{(list as typeof FEATURES).map(row)}</tbody>
              </table>
            </div>
          </Panel>
        ))}
        <Panel>
          <h3 className="mb-2 text-lg font-bold">Fayl formatlari</h3>
          <FormatTable ocrConnected={s.ocr.connected} ocrPdf={s.ocr.pdf} />
          <p className="mt-2 text-sm text-ink-muted">Fayllar {s.retentionHours} soat saqlanadi, bitta fayl hajmi {s.maxFileMb} MB gacha.</p>
        </Panel>
      </div>
    </>
  );
}
