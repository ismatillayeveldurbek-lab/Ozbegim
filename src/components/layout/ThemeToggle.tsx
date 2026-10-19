"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const ORDER: Theme[] = ["light", "dark", "system"];
const LABEL: Record<Theme, string> = { light: "Yorug‘ mavzu", dark: "Qorong‘i mavzu", system: "Tizim mavzusi" };

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    let saved: Theme = "system";
    try {
      saved = (localStorage.getItem("ozbegim-theme") as Theme) || "system";
    } catch {}
    setTheme(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let t: Theme = "system";
      try {
        t = (localStorage.getItem("ozbegim-theme") as Theme) || "system";
      } catch {}
      if (t === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      className="btn btn-ghost h-11 w-11 !p-0"
      onClick={() => {
        setTheme(next);
        try {
          localStorage.setItem("ozbegim-theme", next);
        } catch {}
        apply(next);
      }}
      aria-label={`${LABEL[theme]}. Almashtirish: ${LABEL[next]}`}
      title={LABEL[theme]}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** Sahifa chizilishidan oldin mavzuni qo‘llaydigan skript (miltillashning oldini oladi). */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('ozbegim-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
