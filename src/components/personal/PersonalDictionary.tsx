"use client";
import { Download, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, Field, Notice, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

interface Item {
  id: string;
  kind: "WORD" | "IDIOM" | "LOANWORD";
  term: string;
  meaning: string | null;
  note: string | null;
  ignoreInSpellcheck: boolean;
  folder: { id: string; name: string } | null;
  tags: string[];
}
interface Data {
  items: Item[];
  folders: Array<{ id: string; name: string; count: number }>;
  tags: string[];
}
const KIND = { WORD: "So‘z", IDIOM: "Ibora", LOANWORD: "O‘zlashma" };

function ItemEditor({ item, folders, onDone }: { item: Partial<Item> | null; folders: Data["folders"]; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const [kind, setKind] = useState(item?.kind ?? "WORD");
  const [term, setTerm] = useState(item?.term ?? "");
  const [meaning, setMeaning] = useState(item?.meaning ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [folderId, setFolderId] = useState(item?.folder?.id ?? "");
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));
  const [ignore, setIgnore] = useState(item?.ignoreInSpellcheck ?? false);
  const [error, setError] = useState<string | null>(null);
  const editing = !!item?.id;
  return (
    <form
      className="glass glass-strong flex flex-col gap-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
        try {
          if (editing) await api(`/api/personal/items/${item!.id}`, { method: "PATCH", json: { meaning, note, folderId: folderId || null, tags: tagList, ignoreInSpellcheck: ignore } });
          else {
            if (!term.trim()) return setError("So‘z yoki iborani yozing.");
            await api("/api/personal/items", { method: "POST", json: { kind, term, meaning: meaning || undefined, note: note || undefined, folderId: folderId || null, tags: tagList, ignoreInSpellcheck: ignore } });
          }
          toast.success("Saqlandi.");
          onDone(true);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <h3 className="text-lg font-bold">{editing ? `“${item!.term}” ni tahrirlash` : "Yangi yozuv"}</h3>
      {!editing && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
          <Field label="Turi" htmlFor="pk">
            <select id="pk" className="field" value={kind} onChange={(e) => setKind(e.target.value as Item["kind"])}>
              {Object.entries(KIND).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="So‘z yoki ibora" htmlFor="pt">
            <input id="pt" className="field" value={term} onChange={(e) => setTerm(e.target.value)} maxLength={200} />
          </Field>
        </div>
      )}
      <Field label="Ma’nosi" htmlFor="pm">
        <input id="pm" className="field" value={meaning} onChange={(e) => setMeaning(e.target.value)} maxLength={2000} />
      </Field>
      <Field label="Shaxsiy qayd" htmlFor="pn">
        <textarea id="pn" className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Papka" htmlFor="pf">
          <select id="pf" className="field" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Papkasiz</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Teglar (vergul bilan)" htmlFor="ptg">
          <input id="ptg" className="field" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} />
        Imlo tekshiruvida xato deb hisoblanmasin
      </label>
      {error && <Notice kind="danger">{error}</Notice>}
      <div className="flex gap-2">
        <button className="btn btn-primary">Saqlash</button>
        <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

export function PersonalDictionary() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [folderId, setFolderId] = useState("");
  const [tag, setTag] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Partial<Item> | null | undefined>(undefined);
  const [newFolder, setNewFolder] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/personal/items?${new URLSearchParams({ q, folderId, tag })}`));
    } catch (e) {
      toast.error((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, folderId, tag]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function exportSel(format: "csv" | "json") {
    const res = await fetch("/api/personal/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], format }) });
    if (!res.ok) return toast.error("Eksport qilib bo‘lmadi.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob());
    a.download = `shaxsiy-lugat.${format}`;
    a.click();
  }

  if (!data) return <Spinner />;
  const allSelected = data.items.length > 0 && data.items.every((i) => selected.has(i.id));
  return (
    <div className="flex flex-col gap-4">
      <Notice kind="info">Shaxsiy lug‘atingiz faqat sizga ko‘rinadi va hech qachon ommaga chiqarilmaydi.</Notice>
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor="pq" className="text-sm font-semibold">
            Qidirish
          </label>
          <input id="pq" type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pfo" className="text-sm font-semibold">
            Papka
          </label>
          <select id="pfo" className="field" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Barchasi</option>
            {data.folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.count})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ptag" className="text-sm font-semibold">
            Teg
          </label>
          <select id="ptag" className="field" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Barchasi</option>
            {data.tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
          <Plus className="h-4 w-4" aria-hidden /> Qo‘shish
        </button>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/api/personal/folders", { method: "POST", json: { name: newFolder } });
            setNewFolder("");
            load();
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="nf" className="text-sm font-semibold">
            Yangi papka
          </label>
          <input id="nf" className="field !w-56" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} maxLength={60} />
        </div>
        <button className="btn btn-ghost" disabled={!newFolder.trim()}>
          <FolderPlus className="h-4 w-4" aria-hidden /> Papka yaratish
        </button>
        {folderId && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (!confirm("Papka o‘chirilsinmi? Ichidagi yozuvlar saqlanib qoladi.")) return;
              await api(`/api/personal/folders/${folderId}`, { method: "DELETE" }).catch((e) => toast.error(e.message));
              setFolderId("");
            }}
          >
            Tanlangan papkani o‘chirish
          </button>
        )}
      </form>

      {editing !== undefined && (
        <ItemEditor
          item={editing}
          folders={data.folders}
          onDone={(saved) => {
            setEditing(undefined);
            if (saved) load();
          }}
        />
      )}

      {data.items.length === 0 ? (
        <EmptyState title="Hozircha yozuv yo‘q">Iboralar va o‘zlashma so‘zlar sahifasidagi “Saqlash” tugmasi yoki yuqoridagi “Qo‘shish” orqali yozuv qo‘shing.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-11 items-center gap-2">
              <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(data.items.map((i) => i.id)))} />
              Barchasini tanlash
            </label>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!selected.size} onClick={() => exportSel("csv")}>
              <Download className="h-4 w-4" aria-hidden /> CSV ({selected.size})
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!selected.size} onClick={() => exportSel("json")}>
              <Download className="h-4 w-4" aria-hidden /> JSON
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {data.items.map((i) => (
              <li key={i.id} className="glass flex gap-3 p-4">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
                  aria-label={`${i.term} ni tanlash`}
                  checked={selected.has(i.id)}
                  onChange={() => {
                    const s = new Set(selected);
                    if (s.has(i.id)) s.delete(i.id);
                    else s.add(i.id);
                    setSelected(s);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold">{i.term}</span>
                    <span className="chip text-ink-soft">{KIND[i.kind]}</span>
                    {i.folder && <span className="chip text-ink-soft">Papka: {i.folder.name}</span>}
                    {i.ignoreInSpellcheck && <span className="chip bg-info-soft text-info">Imloda e’tiborsiz</span>}
                  </p>
                  {i.meaning && <p className="text-ink-soft">{i.meaning}</p>}
                  {i.note && <p className="text-sm italic text-ink-muted">Qayd: {i.note}</p>}
                  {i.tags.length > 0 && <p className="mt-1 text-sm text-ink-muted">{i.tags.map((t) => `#${t}`).join(" ")}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(i)} aria-label={`${i.term} ni tahrirlash`}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    aria-label={`${i.term} ni o‘chirish`}
                    onClick={async () => {
                      if (!confirm(`“${i.term}” o‘chirilsinmi?`)) return;
                      await api(`/api/personal/items/${i.id}`, { method: "DELETE" }).catch((e) => toast.error(e.message));
                      load();
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
