/** Segments de temps de travail : changements au 1er du mois, mois pleins uniquement (UTC). */

export type WorkRateSegmentRow = {
  monthStartsOn: Date;
  workPercentage: number;
};

/** Premier jour du mois civil UTC (midi pour éviter les dérives locales). */
export function utcMonthStart(year: number, month1To12: number): Date {
  return new Date(Date.UTC(year, month1To12 - 1, 1, 12, 0, 0, 0));
}

function segmentStartUtcTs(seg: WorkRateSegmentRow): number {
  const d = seg.monthStartsOn;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0);
}

/** Pour un mois donné : dernier segment dont monthStartsOn ≤ premier jour du mois ; sinon fallback. */
export function workPercentageForCalendarMonth(
  segmentsSortedAsc: readonly WorkRateSegmentRow[],
  fallbackPercentage: number,
  year: number,
  month1To12: number,
): number {
  const targetTs = utcMonthStart(year, month1To12).getTime();
  let chosen = fallbackPercentage;
  for (const s of segmentsSortedAsc) {
    if (segmentStartUtcTs(s) <= targetTs) chosen = s.workPercentage;
  }
  return chosen;
}

export function weekdayCountInUtcMonth(year: number, monthIndex0: number): number {
  const lastDay = new Date(Date.UTC(year, monthIndex0 + 1, 0, 12, 0, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(Date.UTC(year, monthIndex0, d, 12, 0, 0)).getUTCDay();
    if (dow >= 1 && dow <= 5) n++;
  }
  return n;
}

/** Les 12 pourcentages (janvier → décembre) pour une année civile. */
export function monthlyRatesForYear(
  segmentsSortedAsc: readonly WorkRateSegmentRow[],
  fallbackPercentage: number,
  year: number,
): number[] {
  const out: number[] = [];
  for (let m = 1; m <= 12; m++) {
    out.push(workPercentageForCalendarMonth(segmentsSortedAsc, fallbackPercentage, year, m));
  }
  return out;
}

/** Moyenne arithmétique des 12 mois (pour quotas / repos annuels proratisés par mois). */
export function averageAnnualWorkRatePercent(monthlyRates: readonly number[]): number {
  if (monthlyRates.length === 0) return 100;
  return monthlyRates.reduce((a, b) => a + b, 0) / monthlyRates.length;
}
