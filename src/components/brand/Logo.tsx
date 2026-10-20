import Image from "next/image";

/** Sayt logotipi: emblem (public/brand/emblem.png) va nomi. To‘liq logotip — public/brand/logo.png. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="O‘zbegim — O‘zbek tili yordamchisi">
      <Image src="/brand/emblem.png" alt="" aria-hidden width={44} height={44} priority className="h-11 w-11 shrink-0" />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="font-serif text-[1.2rem] font-bold tracking-wide text-[#0e2f63] dark:text-[#d9b56a]">O‘ZBEGIM</span>
          <span className="text-[0.75rem] font-medium text-ink-muted">O‘zbek tili yordamchisi</span>
        </span>
      )}
    </span>
  );
}
