"use client";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function UsersPanel() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const toast = useToast();
  const load = useCallback(() => api<{ items: any[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`).then((d) => setItems(d.items)), [q]);
  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => toast.error(e.message)), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  const update = async (id: string, body: object) => {
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", json: body });
      toast.success("Saqlandi.");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="glass p-4">
        <label htmlFor="uq" className="text-sm font-semibold">
          Ism yoki pochta bo‘yicha qidirish
        </label>
        <input id="uq" className="field mt-1" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((u) => (
          <li key={u.id} className="glass flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{u.name}</p>
              <p className="truncate text-sm text-ink-muted">{u.email}</p>
            </div>
            <label className="sr-only" htmlFor={`r${u.id}`}>
              Rol
            </label>
            <select id={`r${u.id}`} className="field !w-auto" value={u.role} onChange={(e) => update(u.id, { role: e.target.value })}>
              <option value="user">Foydalanuvchi</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Administrator</option>
            </select>
            <button type="button" className={`btn btn-sm ${u.banned ? "btn-ghost" : "btn-danger"}`} onClick={() => update(u.id, { banned: !u.banned })}>
              {u.banned ? "Cheklovni olish" : "Cheklash"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
