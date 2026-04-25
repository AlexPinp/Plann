/**
 * Durée en heures entre deux horaires "HH:mm" (même jour ou passage minuit).
 */
export function getShiftDurationHours(startsAt: string, endsAt: string): number {
  const [startH, startM] = startsAt.split(":").map((v) => Number(v));
  const [endH, endM] = endsAt.split(":").map((v) => Number(v));
  if ([startH, startM, endH, endM].some((v) => Number.isNaN(v))) return 0;
  const start = startH * 60 + startM;
  let end = endH * 60 + endM;
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

/**
 * Même logique que {@link getShiftDurationHours}, arrondie pour affichage / tri stable.
 */
export function getShiftDurationHoursRounded(
  startsAt: string,
  endsAt: string,
  decimalPlaces = 2,
): number {
  const hours = getShiftDurationHours(startsAt, endsAt);
  const factor = 10 ** decimalPlaces;
  return Math.round(hours * factor) / factor;
}
