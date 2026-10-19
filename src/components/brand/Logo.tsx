/**
 * Vaqtinchalik matnli belgi. Haqiqiy logotip tayyor bo‘lganda faqat shu komponentni
 * almashtiring (masalan, public/brand/logo.svg faylini <img> orqali ko‘rsating).
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="O‘zbegim — O‘zbek tili yordamchisi">
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white shadow-md"
        style={{ background: "linear-gradient(135deg, #0e3a6b 0%, #0b7a5a 100%)" }}
      >
        Oʻ
      </span>
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-[1.15rem] font-extrabold tracking-wide text-ink">O‘ZBEGIM</span>
          <span className="text-[0.75rem] font-medium text-ink-muted">O‘zbek tili yordamchisi</span>
        </span>
      )}
    </span>
  );
}
