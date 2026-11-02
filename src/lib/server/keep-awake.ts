/**
 * Render bepul rejasi 15 daqiqa tashqi so‘rov bo‘lmasa servisni uxlatadi. Servis o‘z tashqi
 * manziliga (RENDER_EXTERNAL_URL) har 10 daqiqada so‘rov yuborib, uyg‘oq turadi.
 * O‘chirish: KEEP_AWAKE=0. Boshqa platformalarda (RENDER_EXTERNAL_URL yo‘q) hech narsa qilmaydi.
 */
const EVERY_MS = Number(process.env.KEEP_AWAKE_EVERY_MS ?? 10 * 60_000);

let started = false;

export function startKeepAwake() {
  const base = process.env.KEEP_AWAKE_URL || process.env.RENDER_EXTERNAL_URL;
  if (started || !base || process.env.KEEP_AWAKE === "0") return;
  started = true;
  const url = `${base.replace(/\/$/, "")}/api/status`;
  const ping = async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "user-agent": "ozbegim-keep-awake" } });
      if (!res.ok) console.error(`[keep-awake] ${res.status}`);
    } catch (e) {
      console.error("[keep-awake] so‘rov bajarilmadi:", e instanceof Error ? e.message : "noma’lum");
    }
  };
  setInterval(ping, EVERY_MS).unref();
  console.log(`[keep-awake] har ${Math.round(EVERY_MS / 60_000)} daqiqada: ${url}`);
}
