"use client";
import { CircleCheck, CircleX, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  text: string;
}

const Ctx = createContext<(kind: Kind, text: string) => void>(() => {});

export function useToast() {
  const push = useContext(Ctx);
  return {
    success: (t: string) => push("success", t),
    error: (t: string) => push("error", t),
    info: (t: string) => push("info", t),
  };
}

const ICON = { success: CircleCheck, error: CircleX, info: Info };
const STYLE = {
  success: "border-accent/40",
  error: "border-danger/40",
  info: "border-info/40",
};
const LABEL = { success: "Bajarildi", error: "Xato", info: "Ma’lumot" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-24 z-[60] flex flex-col items-center gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end" aria-live="polite" role="status">
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div key={t.id} className={`glass glass-strong pointer-events-auto flex w-full max-w-md items-start gap-3 border-2 px-4 py-3 animate-rise ${STYLE[t.kind]}`}>
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.kind === "error" ? "text-danger" : t.kind === "success" ? "text-accent" : "text-info"}`} aria-hidden />
              <p className="flex-1 text-[0.95rem]">
                <span className="sr-only">{LABEL[t.kind]}: </span>
                {t.text}
              </p>
              <button type="button" className="text-ink-muted" aria-label="Bildirishnomani yopish" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
