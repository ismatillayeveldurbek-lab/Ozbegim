import type { SourceInfo } from "./types";

export function SourceLine({ source, origin }: { source: SourceInfo | null; origin: string }) {
  if (origin === "DEMO")
    return <p className="text-sm text-ink-muted">Manba: namuna yozuv — interfeysni sinash uchun qo‘shilgan, tasdiqlangan lug‘at ma’lumoti emas.</p>;
  if (!source) return <p className="text-sm text-ink-muted">Manba: ko‘rsatilmagan.</p>;
  const text = [source.author, source.title, source.year].filter(Boolean).join(", ");
  return (
    <p className="text-sm text-ink-muted">
      Manba:{" "}
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
          {text}
        </a>
      ) : (
        text
      )}
    </p>
  );
}
