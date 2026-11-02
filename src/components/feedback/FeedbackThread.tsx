"use client";
import { Send } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

export interface FeedbackDTO {
  id: string;
  kind: "BUG" | "COMPLAINT" | "SUGGESTION" | "QUESTION";
  subject: string;
  pageUrl: string | null;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  userUnread: boolean;
  staffUnread: boolean;
  createdAt: string;
  lastMessageAt: string;
  user: { id: string; name: string; email: string };
  messages: Array<{ id: string; body: string; fromStaff: boolean; createdAt: string; author: { name: string; role: string } | null }>;
}

export const KIND_LABEL: Record<FeedbackDTO["kind"], string> = { BUG: "Kamchilik", COMPLAINT: "Shikoyat", SUGGESTION: "Taklif", QUESTION: "Savol" };
export const STATUS_LABEL: Record<FeedbackDTO["status"], { text: string; cls: string }> = {
  OPEN: { text: "Javob kutilmoqda", cls: "bg-warn-soft text-warn" },
  ANSWERED: { text: "Javob berildi", cls: "bg-accent-soft text-accent" },
  CLOSED: { text: "Yopilgan", cls: "text-ink-soft" },
};
const ROLE: Record<string, string> = { admin: "Administrator", moderator: "Moderator" };

const pad = (n: number) => String(n).padStart(2, "0");
/** 02.11.2026 13:43 — brauzer tilidan qat’i nazar bir xil ko‘rinish */
export function fmtDate(d: string, withTime = true) {
  const x = new Date(d);
  const date = `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}`;
  return withTime ? `${date} ${pad(x.getHours())}:${pad(x.getMinutes())}` : date;
}
const fmt = (d: string) => fmtDate(d);

/** Murojaat yozishmasi: xabarlar, javob yozish va yopish/qayta ochish. */
export function FeedbackThread({ item, staff, onChange }: { item: FeedbackDTO; staff: boolean; onChange: (next: FeedbackDTO) => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ item: FeedbackDTO }>(`/api/feedback/${item.id}/messages`, { method: "POST", json: { body: text } });
      setText("");
      onChange(r.item);
      toast.success(staff ? "Javob yuborildi." : "Xabar yuborildi.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "OPEN" | "CLOSED") {
    try {
      const r = await api<{ item: FeedbackDTO }>(`/api/feedback/${item.id}`, { method: "PATCH", json: { status } });
      onChange(r.item);
      toast.success(status === "CLOSED" ? "Murojaat yopildi." : "Murojaat qayta ochildi.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {item.pageUrl && (
        <p className="text-sm text-ink-muted">
          Sahifa: <span className="font-mono">{item.pageUrl}</span>
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {item.messages.map((m) => (
          <li key={m.id} className={`rounded-xl border p-3 ${m.fromStaff ? "border-accent/40 bg-accent-soft" : "border-line"}`}>
            <p className="text-sm text-ink-muted">
              <strong className="text-ink">{m.fromStaff ? `${m.author?.name ?? "Xodim"} · ${ROLE[m.author?.role ?? ""] ?? "Xodim"}` : (m.author?.name ?? "Foydalanuvchi")}</strong> · {fmt(m.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
          </li>
        ))}
      </ol>
      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor={`reply-${item.id}`} className="text-sm font-semibold">
          {staff ? "Javob yozish" : item.status === "CLOSED" ? "Yangi xabar (murojaat qayta ochiladi)" : "Qo‘shimcha xabar"}
        </label>
        <textarea id={`reply-${item.id}`} className="field min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
            <Send className="h-4 w-4" aria-hidden /> {staff ? "Javob yuborish" : "Yuborish"}
          </button>
          {item.status !== "CLOSED" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus("CLOSED")}>
              Murojaatni yopish
            </button>
          ) : (
            staff && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus("OPEN")}>
                Qayta ochish
              </button>
            )
          )}
        </div>
      </form>
    </div>
  );
}
