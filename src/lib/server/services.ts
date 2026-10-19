import { ocrStatus } from "@/lib/files/ocr";

/** Tashqi xizmatlar holati — interfeysda ochiq ko‘rsatiladi. */
export function servicesStatus() {
  const ocr = ocrStatus();
  return {
    ocr,
    ai: process.env.ANTHROPIC_API_KEY
      ? { connected: true, provider: "Anthropic Claude API", model: process.env.AI_MODEL || "claude-opus-5-5", message: "AI tavsiyalari ulangan." }
      : { connected: false, provider: null, model: null, message: "AI xizmati ulanmagan (ANTHROPIC_API_KEY sozlanmagan)." },
    transcription: { connected: false, message: "Transkripsiya xizmati ulanmagan." },
    storage: { driver: process.env.STORAGE_DRIVER === "s3" ? "s3" : "local" },
    fileProcessing: process.env.FILE_PROCESSING === "inline" ? "inline" : "worker",
    retentionHours: Number(process.env.FILE_RETENTION_HOURS ?? 24),
    maxFileMb: Number(process.env.FILE_MAX_MB ?? 20),
  };
}
