"use client";
import { Ban, Download, FileUp, Image as ImageIcon, RotateCcw, ScanText, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Notice, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/fetcher";
import { APOSTROPHE_STYLES, type ApostropheStyle } from "@/lib/uz/alphabet";
import { FormatTable } from "./FormatTable";

interface Job {
  id: string;
  originalName: string;
  format: string;
  sizeBytes: number;
  direction: string;
  status: "QUEUED" | "PROCESSING" | "NEEDS_REVIEW" | "DONE" | "FAILED" | "CANCELLED";
  errorMessage: string | null;
  warnings: string[];
  outputName: string | null;
  hasOutput: boolean;
  hasText: boolean;
  expiresAt: string;
}
interface Upload {
  key: string;
  name: string;
  progress: number;
  error?: string;
  xhr?: XMLHttpRequest;
}
interface Status {
  ocr: { connected: boolean; message: string };
  transcription: { connected: boolean; message: string };
  retentionHours: number;
  maxFileMb: number;
  fileProcessing: string;
}

const ACCEPT = ".txt,.csv,.docx,.xlsx,.pptx,.pdf,.srt,.vtt,.png,.jpg,.jpeg";
const STATUS: Record<Job["status"], { text: string; cls: string; mark: string }> = {
  QUEUED: { text: "Navbatda", cls: "bg-info-soft text-info", mark: "…" },
  PROCESSING: { text: "Ishlanmoqda", cls: "bg-info-soft text-info", mark: "⟳" },
  NEEDS_REVIEW: { text: "Tekshirishingiz kerak", cls: "bg-warn-soft text-warn", mark: "!" },
  DONE: { text: "Tayyor", cls: "bg-accent-soft text-accent", mark: "✓" },
  FAILED: { text: "Xato", cls: "bg-danger-soft text-danger", mark: "×" },
  CANCELLED: { text: "Bekor qilingan", cls: "text-ink-muted", mark: "–" },
};

function fmtSize(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function expiresIn(iso: string) {
  const h = (new Date(iso).getTime() - Date.now()) / 3600_000;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} daqiqadan keyin o‘chiriladi` : `${Math.round(h)} soatdan keyin o‘chiriladi`;
}

async function downloadPost(url: string, body: unknown, fallbackName: string) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Yuklab olib bo‘lmadi.");
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = m ? decodeURIComponent(m[1]) : fallbackName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ReviewPanel({ job, onClose }: { job: Job; onClose: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<{ originalText: string; text: string; note: string } | null>(null);
  const [text, setText] = useState("");
  const [showOrig, setShowOrig] = useState(false);
  useEffect(() => {
    api<{ review: { originalText: string; text: string; note: string } }>(`/api/files/${job.id}`)
      .then((d) => {
        setData(d.review);
        setText(d.review.text);
      })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);
  if (!data) return <Spinner />;
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-line p-3">
      <Notice kind="info">{data.note}</Notice>
      <label htmlFor={`rv-${job.id}`} className="font-semibold">
        O‘girilgan matn (tahrirlash mumkin)
      </label>
      <textarea id={`rv-${job.id}`} className="field min-h-64" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setShowOrig((v) => !v)} aria-expanded={showOrig}>
        {showOrig ? "Asl matnni yashirish" : "Ajratilgan asl matnni ko‘rish"}
      </button>
      {showOrig && <textarea className="field min-h-40" readOnly value={data.originalText} aria-label="Ajratilgan asl matn" />}
      <div className="flex flex-wrap gap-2">
        {(["docx", "txt"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`btn ${f === "docx" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => downloadPost(`/api/files/${job.id}/export`, { text, format: f }, `natija.${f}`).catch((e) => toast.error(e.message))}
          >
            <Download className="h-4 w-4" aria-hidden /> {f.toUpperCase()} yuklab olish
          </button>
        ))}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Yopish
        </button>
      </div>
    </div>
  );
}

export function FileConverter() {
  const { data: session, isPending } = authClient.useSession();
  const toast = useToast();
  const [direction, setDirection] = useState("auto");
  const [apostrophe, setApostrophe] = useState<ApostropheStyle>("typographic");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setJobs((await api<{ items: Job[] }>("/api/files")).items);
    } catch {
      /* kirmagan foydalanuvchi */
    }
  }, []);

  useEffect(() => {
    api<Status>("/api/status").then(setStatus).catch(() => {});
  }, []);
  useEffect(() => {
    if (session) load();
  }, [session, load]);
  // Ishlanayotgan vazifalar bo‘lsa, holatni yangilab turamiz.
  useEffect(() => {
    if (!jobs.some((j) => j.status === "QUEUED" || j.status === "PROCESSING")) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [jobs, load]);

  function upload(file: File) {
    const key = `${file.name}-${Date.now()}-${Math.random()}`;
    const max = (status?.maxFileMb ?? 20) * 1024 * 1024;
    if (file.size > max) {
      setUploads((u) => [...u, { key, name: file.name, progress: 0, error: `Fayl juda katta. Chegara — ${status?.maxFileMb ?? 20} MB.` }]);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("options", JSON.stringify({ direction, apostrophe }));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (e) => e.lengthComputable && setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: Math.round((e.loaded / e.total) * 100) } : x)));
    xhr.onload = () => {
      if (xhr.status === 201) {
        setUploads((u) => u.filter((x) => x.key !== key));
        load();
      } else {
        let msg = "Yuklab bo‘lmadi.";
        try {
          msg = JSON.parse(xhr.responseText).error ?? msg;
        } catch {}
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: msg, xhr: undefined } : x)));
      }
    };
    xhr.onerror = () => setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: "Tarmoq xatosi.", xhr: undefined } : x)));
    setUploads((u) => [...u, { key, name: file.name, progress: 0, xhr }]);
    xhr.send(form);
  }

  async function act(job: Job, action: "cancel" | "retry" | "delete") {
    try {
      if (action === "delete") {
        if (!confirm(`“${job.originalName}” va uning natijasi o‘chirilsinmi?`)) return;
        await api(`/api/files/${job.id}`, { method: "DELETE" });
        toast.success("Fayl o‘chirildi.");
      } else await api(`/api/files/${job.id}/${action}`, { method: "POST" });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isPending) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">
      {!session ? (
        <Notice kind="info" title="Fayllar bilan ishlash uchun tizimga kiring">
          Fayllaringiz faqat sizga ko‘rinishi uchun hisob kerak.{" "}
          <Link href="/kirish?next=/konvertor/fayl" className="font-semibold underline">
            Kirish
          </Link>{" "}
          yoki{" "}
          <Link href="/royxat?next=/konvertor/fayl" className="font-semibold underline">
            ro‘yxatdan o‘tish
          </Link>
          .
        </Notice>
      ) : (
        <section className="glass flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fdir" className="text-sm font-semibold">
                Yo‘nalish
              </label>
              <select id="fdir" className="field !w-auto" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="auto">Avtomatik aniqlash</option>
                <option value="lat2cyr">Lotin → Kirill</option>
                <option value="cyr2lat">Kirill → Lotin</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fapos" className="text-sm font-semibold">
                Lotin yozuvida o‘ va tutuq
              </label>
              <select id="fapos" className="field !w-auto" value={apostrophe} onChange={(e) => setApostrophe(e.target.value as ApostropheStyle)}>
                {Object.entries(APOSTROPHE_STYLES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${dragOver ? "border-accent bg-accent-soft" : "border-line"}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              [...e.dataTransfer.files].forEach(upload);
            }}
          >
            <FileUp className="h-10 w-10 text-accent" aria-hidden />
            <p className="text-lg font-semibold">Fayllarni shu yerga tashlang</p>
            <p className="text-sm text-ink-muted">
              TXT, CSV, DOCX, XLSX, PPTX, PDF, SRT, VTT · har biri {status?.maxFileMb ?? 20} MB gacha · asl fayl o‘zgarmaydi
            </p>
            <input ref={inputRef} id="file-input" type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => (e.target.files && [...e.target.files].forEach(upload), (e.target.value = ""))} />
            <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden /> Fayl tanlash
            </button>
          </div>
          <p className="text-sm text-ink-muted">
            Fayllar yopiq saqlanadi va {status?.retentionHours ?? 24} soatdan keyin avtomatik o‘chiriladi. Ularni istalgan vaqtda o‘zingiz o‘chirishingiz mumkin.
          </p>
        </section>
      )}

      {(uploads.length > 0 || jobs.length > 0) && (
        <section aria-labelledby="jobs-title" className="flex flex-col gap-3">
          <h3 id="jobs-title" className="text-lg font-bold">
            Fayllaringiz
          </h3>
          <ul className="flex flex-col gap-3" aria-live="polite">
            {uploads.map((u) => (
              <li key={u.key} className="glass p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold break-all">{u.name}</span>
                  {u.error ? (
                    <span className="chip bg-danger-soft text-danger">× Rad etildi</span>
                  ) : (
                    <span className="chip bg-info-soft text-info">Yuklanmoqda {u.progress}%</span>
                  )}
                </div>
                {u.error ? (
                  <p className="mt-2 text-danger" role="alert">
                    {u.error}
                  </p>
                ) : (
                  <progress className="mt-2 w-full" value={u.progress} max={100} aria-label={`${u.name} yuklanmoqda`} />
                )}
                <div className="mt-2 flex gap-2">
                  {u.xhr ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => (u.xhr?.abort(), setUploads((x) => x.filter((y) => y.key !== u.key)))}>
                      <Ban className="h-4 w-4" aria-hidden /> Bekor qilish
                    </button>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>
                      Ro‘yxatdan olib tashlash
                    </button>
                  )}
                </div>
              </li>
            ))}
            {jobs.map((j) => {
              const s = STATUS[j.status];
              return (
                <li key={j.id} className="glass p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 font-semibold break-all">{j.originalName}</span>
                    <span className={`chip ${s.cls}`}>
                      <span aria-hidden>{s.mark}</span> {s.text}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {j.format.toUpperCase()} · {fmtSize(j.sizeBytes)} · {j.direction === "lat2cyr" ? "Lotin → Kirill" : j.direction === "cyr2lat" ? "Kirill → Lotin" : "Avtomatik"} ·{" "}
                    {expiresIn(j.expiresAt)}
                  </p>
                  {j.errorMessage && (
                    <p className="mt-2 text-danger" role="alert">
                      Sabab: {j.errorMessage}
                    </p>
                  )}
                  {j.warnings.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-sm text-ink-soft">
                      {j.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {j.hasOutput && (
                      <a className="btn btn-primary btn-sm" href={`/api/files/${j.id}/download`} download>
                        <Download className="h-4 w-4" aria-hidden /> Yuklab olish
                      </a>
                    )}
                    {j.status === "NEEDS_REVIEW" && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setReviewing(reviewing === j.id ? null : j.id)}>
                        <ScanText className="h-4 w-4" aria-hidden /> Matnni tekshirish
                      </button>
                    )}
                    {(j.status === "QUEUED" || j.status === "PROCESSING") && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(j, "cancel")}>
                        <Ban className="h-4 w-4" aria-hidden /> Bekor qilish
                      </button>
                    )}
                    {(j.status === "FAILED" || j.status === "CANCELLED") && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(j, "retry")}>
                        <RotateCcw className="h-4 w-4" aria-hidden /> Qayta urinish
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(j, "delete")}>
                      <Trash2 className="h-4 w-4" aria-hidden /> O‘chirish
                    </button>
                  </div>
                  {reviewing === j.id && <ReviewPanel job={j} onClose={() => setReviewing(null)} />}
                </li>
              );
            })}
          </ul>
          {status?.fileProcessing === "worker" && jobs.some((j) => j.status === "QUEUED") && (
            <p className="text-sm text-ink-muted">Vazifalar fon ishchisi tomonidan bajariladi. Agar uzoq vaqt “Navbatda” tursa, server administratori ishchini ishga tushirganini tekshirsin.</p>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="glass p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <ScanText className="h-5 w-5 text-accent" aria-hidden /> Rasmdan matn ajratish
          </h3>
          <p className="mt-1 text-ink-soft">
            {status?.ocr.connected ? "JPG yoki PNG yuklang — matn OCR orqali ajratiladi va tekshirish uchun ko‘rsatiladi." : "Xizmat ulanmagan. "}
            {!status?.ocr.connected && status?.ocr.message}
          </p>
        </div>
        <div className="glass p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <ImageIcon className="h-5 w-5 text-ink-muted" aria-hidden /> Rasmdagi yozuvni almashtirish
          </h3>
          <p className="mt-1 text-ink-soft">Amalga oshirilmagan. Rasm ichidagi yozuvni boshqa yozuvga almashtirib, rasmni qayta chizish imkoniyati hozircha yo‘q.</p>
        </div>
      </section>

      <Notice kind="info" title="Audio va video">
        Audio yoki video fayldagi nutqni o‘girish uchun avval transkripsiya (nutqni matnga aylantirish) kerak. {status?.transcription.message ?? ""} Agar
        sizda transkript yoki subtitr (SRT/VTT) bo‘lsa, uni yuqorida o‘giring.
      </Notice>

      <section className="glass p-5" aria-labelledby="formats-title">
        <h3 id="formats-title" className="mb-2 text-lg font-bold">
          Qo‘llab-quvvatlanadigan formatlar
        </h3>
        <FormatTable ocrConnected={!!status?.ocr.connected} />
      </section>
    </div>
  );
}
