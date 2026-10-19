"use client";
import { Download, Upload } from "lucide-react";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

type Target = "idiom" | "loanword" | "lexeme" | "spelling";
const TARGET_LABEL: Record<Target, string> = { idiom: "Iboralar", loanword: "O‘zlashma so‘zlar", lexeme: "So‘z tahlili lug‘ati", spelling: "Imlo juftliklari" };
interface Field {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
}
interface Sheet {
  name: string;
  headers: string[];
  rowCount: number;
  sample: string[][];
}
interface Preview {
  total: number;
  valid: number;
  errors: Array<{ row: number; message: string }>;
  errorCount: number;
  duplicatesInFile: Array<{ display: string; rows: number[] }>;
  existing: Array<{ display: string }>;
  existingCount: number;
  sample: Array<{ display: string; rows: number[] }>;
}
interface Report {
  created: number;
  updated: number;
  skipped: number;
  invalidSkipped: number;
  duplicatesInFile: number;
}

const STEPS = ["Fayl", "Varaq va ustunlar", "Oldindan ko‘rish", "Tasdiqlash", "Hisobot"];

function guess(fields: Field[], headers: string[]) {
  const m: Record<string, number> = {};
  for (const f of fields) {
    const i = headers.findIndex((h) => h.trim().toLowerCase() === f.key || h.trim().toLowerCase() === f.label.toLowerCase());
    if (i >= 0) m[f.key] = i;
  }
  return m;
}

export function ImportWizard() {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<Target>("loanword");
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<{ id: string; fields: Field[]; sheets: Sheet[] } | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [defaultStatus, setDefaultStatus] = useState<"VERIFIED" | "PENDING">("VERIFIED");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rule, setRule] = useState<"skip" | "update">("skip");
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sheet = job?.sheets.find((s) => s.name === sheetName);

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="glass flex flex-wrap gap-1 p-1.5" aria-label="Import bosqichlari">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={`rounded-xl px-3 py-2 text-sm font-semibold ${i === step ? "bg-accent text-accent-ink" : i < step ? "text-accent" : "text-ink-muted"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {error && <Notice kind="danger">{error}</Notice>}

      {step === 0 && (
        <section className="glass flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="it" className="font-semibold">
              Nimani import qilasiz?
            </label>
            <select id="it" className="field !w-auto" value={target} onChange={(e) => setTarget(e.target.value as Target)}>
              {Object.entries(TARGET_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-ink-soft">
            Namuna shablon:{" "}
            <a className="font-semibold text-accent underline" href={`/api/admin/import/template?target=${target}&format=xlsx`}>
              XLSX
            </a>{" "}
            ·{" "}
            <a className="font-semibold text-accent underline" href={`/api/admin/import/template?target=${target}&format=csv`}>
              CSV
            </a>
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="if" className="font-semibold">
              CSV yoki XLSX fayl (15 MB gacha, 20 000 qatorgacha)
            </label>
            <input id="if" type="file" accept=".csv,.xlsx" className="field" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <button
            type="button"
            className="btn btn-primary self-start"
            disabled={!file || busy}
            onClick={() =>
              run(async () => {
                const form = new FormData();
                form.append("file", file!);
                form.append("target", target);
                const r = await api<{ id: string; fields: Field[]; sheets: Sheet[] }>("/api/admin/import", { method: "POST", body: form });
                setJob(r);
                setSheetName(r.sheets[0].name);
                setMapping(guess(r.fields, r.sheets[0].headers));
                setStep(1);
              })
            }
          >
            <Upload className="h-4 w-4" aria-hidden /> {busy ? "O‘qilmoqda…" : "Faylni yuklash"}
          </button>
        </section>
      )}

      {step === 1 && job && sheet && (
        <section className="glass flex flex-col gap-4 p-5">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="is" className="font-semibold">
                Varaq
              </label>
              <select
                id="is"
                className="field !w-auto"
                value={sheetName}
                onChange={(e) => {
                  setSheetName(e.target.value);
                  setMapping(guess(job.fields, job.sheets.find((s) => s.name === e.target.value)!.headers));
                }}
              >
                {job.sheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.rowCount} qator)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="ids" className="font-semibold">
                “Holat” ustuni bo‘sh bo‘lsa
              </label>
              <select id="ids" className="field !w-auto" value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value as "VERIFIED" | "PENDING")}>
                <option value="VERIFIED">Tasdiqlangan</option>
                <option value="PENDING">Tekshirilmoqda</option>
              </select>
            </div>
          </div>
          <h3 className="font-bold">Ustunlarni maydonlarga moslashtirish</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {job.fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <label htmlFor={`map-${f.key}`} className="text-sm font-semibold">
                  {f.label} {f.required && <span className="text-danger">(majburiy)</span>}
                </label>
                <select
                  id={`map-${f.key}`}
                  className="field"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => {
                    const m = { ...mapping };
                    if (e.target.value === "") delete m[f.key];
                    else m[f.key] = Number(e.target.value);
                    setMapping(m);
                  }}
                >
                  <option value="">— tanlanmagan —</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {String.fromCharCode(65 + (i % 26))}: {h || "(sarlavhasiz)"}
                    </option>
                  ))}
                </select>
                {f.hint && <span className="text-xs text-ink-muted">{f.hint}</span>}
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <caption className="mb-1 text-left text-ink-muted">Faylning birinchi qatorlari</caption>
              <thead>
                <tr>
                  {sheet.headers.map((h, i) => (
                    <th key={i} className="border-b border-line px-2 py-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.sample.map((r, ri) => (
                  <tr key={ri}>
                    {sheet.headers.map((_, ci) => (
                      <td key={ci} className="border-b border-line px-2 py-1">
                        {r[ci]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
              Orqaga
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setPreview(await api<Preview>(`/api/admin/import/${job.id}/preview`, { method: "POST", json: { sheetName, mapping, defaultStatus } }));
                  setStep(2);
                })
              }
            >
              Oldindan ko‘rish
            </button>
          </div>
        </section>
      )}

      {step === 2 && preview && (
        <section className="glass flex flex-col gap-4 p-5">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Jami qator", preview.total],
              ["Yaroqli yozuv", preview.valid],
              ["Xatoli qator", preview.errorCount],
              ["Bazada bor", preview.existingCount],
            ].map(([l, v]) => (
              <li key={l} className="rounded-xl border border-line p-3">
                <p className="text-sm text-ink-muted">{l}</p>
                <p className="text-2xl font-bold">{v}</p>
              </li>
            ))}
          </ul>
          {preview.errors.length > 0 && (
            <div>
              <h3 className="font-bold text-danger">Xatolar (satr raqami bilan)</h3>
              <ul className="mt-1 max-h-60 overflow-y-auto text-sm">
                {preview.errors.map((e, i) => (
                  <li key={i} className="border-b border-line py-1">
                    <strong>{e.row}-qator:</strong> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.duplicatesInFile.length > 0 && (
            <div>
              <h3 className="font-bold text-warn">Fayl ichidagi takrorlar (birinchi qator olinadi)</h3>
              <ul className="mt-1 max-h-40 overflow-y-auto text-sm">
                {preview.duplicatesInFile.map((d, i) => (
                  <li key={i}>
                    {d.display} — qatorlar: {d.rows.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.existing.length > 0 && (
            <div>
              <h3 className="font-bold">Bazada allaqachon bor</h3>
              <p className="text-sm text-ink-soft">{preview.existing.slice(0, 30).map((e) => e.display).join(", ")}{preview.existingCount > 30 ? " …" : ""}</p>
            </div>
          )}
          <div>
            <h3 className="font-bold">Namuna</h3>
            <ul className="text-sm text-ink-soft">
              {preview.sample.map((s, i) => (
                <li key={i}>
                  {s.display} (qator {s.rows.join(", ")})
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              Moslashtirishga qaytish
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(3)} disabled={!preview.valid}>
              Davom etish
            </button>
          </div>
        </section>
      )}

      {step === 3 && preview && job && (
        <section className="glass flex flex-col gap-4 p-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="font-bold">Bazada bor yozuvlar ({preview.existingCount}) bilan nima qilinsin?</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="rule" className="h-5 w-5 accent-[var(--accent)]" checked={rule === "skip"} onChange={() => setRule("skip")} /> O‘tkazib yuborish (mavjud yozuv o‘zgarmaydi)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="rule" className="h-5 w-5 accent-[var(--accent)]" checked={rule === "update"} onChange={() => setRule("update")} /> Yangilash (fayldagi ma’lumot bilan almashtiriladi)
            </label>
          </fieldset>
          {preview.errorCount > 0 && (
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} />
              {preview.errorCount} ta xatoli qatorni o‘tkazib yuborish
            </label>
          )}
          <Notice kind="info">Import bitta tranzaksiyada bajariladi: biror yozuvda xato chiqsa, bazaga hech narsa yozilmaydi.</Notice>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
              Orqaga
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || (preview.errorCount > 0 && !skipInvalid)}
              onClick={() =>
                run(async () => {
                  setReport(await api<Report>(`/api/admin/import/${job.id}/commit`, { method: "POST", json: { duplicateRule: rule, skipInvalid } }));
                  setStep(4);
                  toast.success("Import yakunlandi.");
                })
              }
            >
              {busy ? "Import qilinmoqda…" : "Importni tasdiqlash"}
            </button>
          </div>
        </section>
      )}

      {step === 4 && report && (
        <section className="glass flex flex-col gap-3 p-5">
          <h3 className="text-lg font-bold">Natija hisoboti</h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Yangi qo‘shildi", report.created],
              ["Yangilandi", report.updated],
              ["O‘tkazib yuborildi", report.skipped],
              ["Xatoli qatorlar", report.invalidSkipped],
              ["Fayl ichidagi takror", report.duplicatesInFile],
            ].map(([l, v]) => (
              <li key={l} className="rounded-xl border border-line p-3">
                <p className="text-sm text-ink-muted">{l}</p>
                <p className="text-2xl font-bold">{v}</p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-ghost self-start"
            onClick={() => {
              setStep(0);
              setJob(null);
              setPreview(null);
              setReport(null);
              setFile(null);
            }}
          >
            Yangi import
          </button>
        </section>
      )}
    </div>
  );
}

export function ExportPanel() {
  const [includeDemo, setIncludeDemo] = useState(false);
  return (
    <section className="glass flex flex-col gap-4 p-5">
      <h3 className="text-lg font-bold">Eksport</h3>
      <p className="text-sm text-ink-soft">Eksport fayli import shabloni bilan bir xil ustunlarga ega. Matnlar formula sifatida bajarilmasligi uchun himoyalangan.</p>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} /> Namuna (DEMO) yozuvlarni ham qo‘shish
      </label>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(TARGET_LABEL) as Target[]).map((t) => (
          <li key={t} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
            <span className="flex-1 font-semibold">{TARGET_LABEL[t]}</span>
            {(["xlsx", "csv"] as const).map((f) => (
              <a key={f} className="btn btn-ghost btn-sm" href={`/api/admin/export?target=${t}&format=${f}&includeDemo=${includeDemo ? 1 : 0}`}>
                <Download className="h-4 w-4" aria-hidden /> {f.toUpperCase()}
              </a>
            ))}
          </li>
        ))}
      </ul>
      <h3 className="text-lg font-bold">Zaxira</h3>
      <p className="text-sm text-ink-soft">
        Lug‘at ma’lumotlari va muhokamalarning JSON zaxirasi. Butun bazaning (foydalanuvchilar bilan) zaxirasi server tomonida <code>pg_dump</code> bilan olinadi — README’ga
        qarang.
      </p>
      <a className="btn btn-primary self-start" href="/api/admin/backup">
        <Download className="h-4 w-4" aria-hidden /> JSON zaxirani yuklab olish
      </a>
    </section>
  );
}
