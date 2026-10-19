"use client";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, Notice, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

interface Entry {
  id: string;
  type: string;
  summary: string;
  meta: Record<string, unknown>;
  inputText: string | null;
  outputText: string | null;
  createdAt: string;
}
const TYPE: Record<string, string> = { convert: "Konvertatsiya", spellcheck: "Imlo tekshiruvi", file: "Fayl vazifasi", saved: "Saqlangan natija" };
const MODE: Record<string, string> = { off: "o‘chirilgan", meta: "faqat metama’lumot (matnlarsiz)", full: "matnlar bilan" };

export function HistoryView() {
  const toast = useToast();
  const [data, setData] = useState<{ mode: string; items: Entry[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => api<{ mode: string; items: Entry[] }>("/api/history").then(setData).catch((e) => toast.error(e.message)), [toast]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!data) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <Notice kind={data.mode === "off" ? "warn" : "info"} title={`Tarix rejimi: ${MODE[data.mode]}`}>
        Tarix faqat roziligingiz bilan yuritiladi. Rejimni{" "}
        <Link href="/profil" className="font-semibold underline">
          profil sozlamalarida
        </Link>{" "}
        o‘zgartiring.
      </Notice>
      {data.items.length > 0 && (
        <button
          type="button"
          className="btn btn-danger self-start"
          onClick={async () => {
            if (!confirm("Butun ish tarixi o‘chirilsinmi? Bu amalni ortga qaytarib bo‘lmaydi.")) return;
            await api("/api/history", { method: "DELETE" });
            toast.success("Tarix tozalandi.");
            load();
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Butun tarixni o‘chirish
        </button>
      )}
      {data.items.length === 0 ? (
        <EmptyState title="Tarix bo‘sh" />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.items.map((e) => (
            <li key={e.id} className="glass p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="chip mr-2 text-ink-soft">{TYPE[e.type] ?? e.type}</span>
                  <span className="font-semibold">{e.summary}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-muted">{new Date(e.createdAt).toLocaleString("uz-UZ")}</span>
                  {(e.inputText || e.outputText) && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                      Matn
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label="Yozuvni o‘chirish"
                    onClick={async () => {
                      await api(`/api/history/${e.id}`, { method: "DELETE" }).catch((err) => toast.error(err.message));
                      load();
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              {open === e.id && (
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <textarea readOnly className="field min-h-32" value={e.inputText ?? ""} aria-label="Kiritilgan matn" />
                  <textarea readOnly className="field min-h-32" value={e.outputText ?? ""} aria-label="Natija" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
