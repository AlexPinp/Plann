/** Ancre legacy : cycle fixe de 33 semaines (offset date uniquement pour compat). */
export const TEMPLATE_CYCLE_WEEKS = 33;
export const TEMPLATE_CYCLE_DAYS = TEMPLATE_CYCLE_WEEKS * 7;

/** Durée par défaut des trames (nouvelles / valeur manquante / repli calcul). */
export const DEFAULT_TEMPLATE_CYCLE_WEEKS = 52;

// Reference Monday for cycle day 0 (02/03/2026).
const TEMPLATE_CYCLE_ANCHOR_UTC_MS = Date.UTC(2026, 2, 2, 12, 0, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

/** Nombre de jours écoulés depuis l'ancre (peut être négatif avant). */
function deltaDaysFromAnchor(date: Date): number {
  const utcNoonMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0);
  return Math.floor((utcNoonMs - TEMPLATE_CYCLE_ANCHOR_UTC_MS) / DAY_MS);
}

/** Durée de cycle en semaines (>= 1), avec repli si valeur absente ou invalide. */
export function normalizeTemplateCycleWeeks(cycleWeeks: number | null | undefined): number {
  const n = Math.floor(Number(cycleWeeks));
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_TEMPLATE_CYCLE_WEEKS;
}

/** Offset dans le cycle pour une trame de `cycleWeeks` semaines. */
export function getTemplateDayOffsetForCycle(date: Date, cycleWeeks: number): number {
  const w = normalizeTemplateCycleWeeks(cycleWeeks);
  const cycleDays = w * 7;
  return normalizeModulo(deltaDaysFromAnchor(date), cycleDays);
}

/** Rétrocompat : offset dans le cycle legacy de 33 semaines. */
export function getTemplateDayOffsetFromDate(date: Date): number {
  return normalizeModulo(deltaDaysFromAnchor(date), TEMPLATE_CYCLE_DAYS);
}

export function getTemplateDayOffsetFromIsoDate(isoDate: string): number | null {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return getTemplateDayOffsetFromDate(dt);
}

/** Version paramétrée par équipe/trame (utilise la durée de cycle propre à la trame). */
export function getTemplateDayOffsetFromIsoDateForCycle(isoDate: string, cycleWeeks: number): number | null {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return getTemplateDayOffsetForCycle(dt, cycleWeeks);
}
