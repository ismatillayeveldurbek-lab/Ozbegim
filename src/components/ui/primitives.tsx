import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function Panel({ children, className = "", as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" } & Record<string, unknown>) {
  return (
    <As className={`glass p-4 sm:p-6 ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function PageIntro({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        {children && <div className="mt-1.5 text-ink-soft">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type NoticeKind = "info" | "warn" | "danger" | "success";
const NOTICE: Record<NoticeKind, { cls: string; Icon: typeof Info; label: string }> = {
  info: { cls: "bg-info-soft text-info", Icon: Info, label: "Ma’lumot" },
  warn: { cls: "bg-warn-soft text-warn", Icon: TriangleAlert, label: "Diqqat" },
  danger: { cls: "bg-danger-soft text-danger", Icon: CircleAlert, label: "Xato" },
  success: { cls: "bg-accent-soft text-accent", Icon: CircleCheck, label: "Bajarildi" },
};

export function Notice({ kind = "info", title, children, className = "" }: { kind?: NoticeKind; title?: string; children?: ReactNode; className?: string }) {
  const { cls, Icon, label } = NOTICE[kind];
  return (
    <div className={`flex gap-3 rounded-2xl border border-current/20 px-4 py-3 ${cls} ${className}`} role={kind === "danger" ? "alert" : undefined}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 text-[0.95rem] text-ink">
        <span className="sr-only">{label}: </span>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-soft">{children}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = "Yuklanmoqda…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink-muted" role="status">
      <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
      <span>{label}</span>
    </span>
  );
}

export type StatusValue = "VERIFIED" | "PENDING" | "REJECTED" | "COMMUNITY" | "DEMO";
const STATUS: Record<StatusValue, { text: string; cls: string; mark: string }> = {
  VERIFIED: { text: "Tasdiqlangan", cls: "bg-accent-soft text-accent", mark: "✓" },
  PENDING: { text: "Tekshirilmoqda", cls: "bg-warn-soft text-warn", mark: "…" },
  REJECTED: { text: "Rad etilgan", cls: "bg-danger-soft text-danger", mark: "×" },
  COMMUNITY: { text: "Hamjamiyat taklifi", cls: "bg-info-soft text-info", mark: "◆" },
  DEMO: { text: "Namuna (tasdiqlanmagan)", cls: "bg-warn-soft text-warn", mark: "◇" },
};

export function StatusBadge({ status }: { status: StatusValue }) {
  const s = STATUS[status];
  return (
    <span className={`chip ${s.cls}`}>
      <span aria-hidden>{s.mark}</span>
      {s.text}
    </span>
  );
}

/** Yozuv holati: namuna va hamjamiyat yozuvlari tasdiqlanganidan ustun ko‘rsatiladi. */
export function entryBadgeStatus(status: string, origin: string): StatusValue {
  if (origin === "DEMO") return "DEMO";
  if (origin === "COMMUNITY" && status !== "VERIFIED") return "COMMUNITY";
  return status as StatusValue;
}

export function Field({ label, htmlFor, hint, children, error }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode; error?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[0.95rem] font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-ink-muted">{hint}</p>}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {icon && <div className="text-ink-muted">{icon}</div>}
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="max-w-lg text-ink-soft">{children}</div>}
    </div>
  );
}
