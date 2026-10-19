"use client";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

const OPTIONS = [
  { value: "off", title: "O‘chirilgan", text: "Hech qanday ish tarixi saqlanmaydi." },
  { value: "meta", title: "Faqat metama’lumot", text: "Faqat sana, amal turi va hajm saqlanadi; matnlar saqlanmaydi." },
  { value: "full", title: "Matnlar bilan", text: "Siz “Tarixga saqlash” bosgan matnlar ham saqlanadi. Ularni istalgan vaqtda o‘chirishingiz mumkin." },
];

export function ProfileSettings() {
  const toast = useToast();
  const [profile, setProfile] = useState<{ name: string; email: string; historyMode: string; role: string } | null>(null);
  useEffect(() => {
    api<typeof profile>("/api/profile").then(setProfile).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!profile) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <section className="glass p-5">
        <h3 className="text-lg font-bold">{profile.name}</h3>
        <p className="text-ink-muted">{profile.email}</p>
        <p className="mt-1 text-sm text-ink-muted">Rol: {profile.role === "admin" ? "administrator" : profile.role === "moderator" ? "moderator" : "foydalanuvchi"}</p>
      </section>
      <fieldset className="glass flex flex-col gap-2 p-5">
        <legend className="text-lg font-bold">Ish tarixi va rozilik</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className="flex cursor-pointer gap-3 rounded-xl p-2 hover:bg-accent-soft">
            <input
              type="radio"
              name="history"
              className="mt-1 h-5 w-5 accent-[var(--accent)]"
              checked={profile.historyMode === o.value}
              onChange={async () => {
                try {
                  await api("/api/profile", { method: "PATCH", json: { historyMode: o.value } });
                  setProfile({ ...profile, historyMode: o.value });
                  toast.success("Sozlama saqlandi.");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
            <span>
              <span className="block font-semibold">{o.title}</span>
              <span className="text-sm text-ink-soft">{o.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
