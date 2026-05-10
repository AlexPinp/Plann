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

function utcCalendarNoonMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0);
}

/** Écart en jours entre deux dates (calendrier UTC, midi). */
function deltaCalendarDays(date: Date, anchorDate: Date): number {
  return Math.floor((utcCalendarNoonMs(date) - utcCalendarNoonMs(anchorDate)) / DAY_MS);
}

/** Nombre de jours écoulés depuis l'ancre legacy (peut être négatif avant). */
function deltaDaysFromAnchor(date: Date): number {
  return Math.floor((utcCalendarNoonMs(date) - TEMPLATE_CYCLE_ANCHOR_UTC_MS) / DAY_MS);
}

/** Valeur pour `<input type="date">` (jour calendaire UTC). */
export function cycleStartDateToInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Durée de cycle en semaines (>= 1), avec repli si valeur absente ou invalide. */
export function normalizeTemplateCycleWeeks(cycleWeeks: number | null | undefined): number {
  const n = Math.floor(Number(cycleWeeks));
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_TEMPLATE_CYCLE_WEEKS;
}

/** Offset dans le cycle pour une trame de `cycleWeeks` semaines.
 * @param cycleStartDate Si défini, le jour 0 du cycle correspond à cette date (UTC). Sinon ancrage legacy (2026-03-02). */
export function getTemplateDayOffsetForCycle(
  date: Date,
  cycleWeeks: number,
  cycleStartDate?: Date | null,
): number {
  const w = normalizeTemplateCycleWeeks(cycleWeeks);
  const cycleDays = w * 7;
  const anchor =
    cycleStartDate != null ? cycleStartDate : new Date(TEMPLATE_CYCLE_ANCHOR_UTC_MS);
  return normalizeModulo(deltaCalendarDays(date, anchor), cycleDays);
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
export function getTemplateDayOffsetFromIsoDateForCycle(
  isoDate: string,
  cycleWeeks: number,
  cycleStartDate?: Date | null,
): number | null {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return getTemplateDayOffsetForCycle(dt, cycleWeeks, cycleStartDate);
}
