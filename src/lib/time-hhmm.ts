/** Minutes depuis minuit (00:00–24:00 exclus pour fin). Accepte HH:mm ou HH:mm:ss ou H:mm */
export function hhmmToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Fin du créneau sur le lendemain calendaire (garde / nuit qui déborde sur minuit) */
export function shiftEndsNextCalendarDay(startsAt: string, endsAt: string): boolean {
  const s = hhmmToMinutes(startsAt);
  const e = hhmmToMinutes(endsAt);
  if (s === null || e === null) return false;
  return e <= s;
}

/** HH:mm normalisé pour les APIs (tronque les secondes si présentes) */
export function normalizeHHMM(value: string): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
