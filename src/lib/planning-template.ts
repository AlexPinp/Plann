export const TEMPLATE_CYCLE_WEEKS = 33;
export const TEMPLATE_CYCLE_DAYS = TEMPLATE_CYCLE_WEEKS * 7;

// Reference Monday for cycle day 0 (02/03/2026).
const TEMPLATE_CYCLE_ANCHOR_UTC_MS = Date.UTC(2026, 2, 2, 12, 0, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

export function getTemplateDayOffsetFromDate(date: Date): number {
  const utcNoonMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0);
  const deltaDays = Math.floor((utcNoonMs - TEMPLATE_CYCLE_ANCHOR_UTC_MS) / DAY_MS);
  return normalizeModulo(deltaDays, TEMPLATE_CYCLE_DAYS);
}

export function getTemplateDayOffsetFromIsoDate(isoDate: string): number | null {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return getTemplateDayOffsetFromDate(dt);
}
