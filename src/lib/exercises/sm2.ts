/**
 * Takrorlashni rejalashtirish (SM-2 algoritmiga asoslangan).
 * Baho: 0 — bilmadim, 3 — qiynalib esladim, 4 — bildim, 5 — oson.
 */
export interface ReviewInput {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export type Grade = 0 | 3 | 4 | 5;

export function schedule(s: ReviewInput, grade: Grade, now = new Date()): ReviewInput & { dueAt: Date } {
  let { ease, intervalDays, repetitions, lapses } = s;
  if (grade < 3) {
    repetitions = 0;
    lapses += 1;
    intervalDays = 0;
    // Bilinmagan karta 10 daqiqadan keyin qayta ko‘rsatiladi
    return { ease: Math.max(1.3, ease - 0.2), intervalDays, repetitions, lapses, dueAt: new Date(now.getTime() + 10 * 60_000) };
  }
  repetitions += 1;
  intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(intervalDays * ease);
  ease = Math.max(1.3, ease + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  return { ease, intervalDays, repetitions, lapses, dueAt: new Date(now.getTime() + intervalDays * 86_400_000) };
}
