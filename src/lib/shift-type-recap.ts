/** Champs shift type utiles pour le cumul d'heures (récap planning, Droits). */
export const SHIFT_TYPE_RECAP_SELECT = {
  id: true,
  code: true,
  startsAt: true,
  endsAt: true,
  countsInHoursRecap: true,
} as const;

export function shiftCountsInHoursRecap(shift: { countsInHoursRecap: boolean }): boolean {
  return shift.countsInHoursRecap;
}

export function parseCountsInHoursRecapFromForm(formData: FormData): boolean {
  const raw = formData.get("countsInHoursRecap");
  return raw === "on" || raw === "1" || raw === "true";
}
