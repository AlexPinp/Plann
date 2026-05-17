import { addMonths, startOfDay } from "date-fns";

export type TrainingExpiryUrgency = "none" | "warning" | "critical";

/** Alerte orange si échéance dans moins de 6 mois, rouge si moins de 3 mois. */
export function getTrainingExpiryUrgency(
  lastCompletedAt: Date | null | undefined,
  recurrenceMonths: number | null | undefined,
  today: Date = new Date(),
): TrainingExpiryUrgency {
  if (!lastCompletedAt || !recurrenceMonths || recurrenceMonths <= 0) return "none";

  const ref = startOfDay(today);
  const expiry = addMonths(startOfDay(lastCompletedAt), recurrenceMonths);
  const warningLimit = addMonths(ref, 6);
  const criticalLimit = addMonths(ref, 3);

  if (expiry < ref) return "critical";
  if (expiry <= criticalLimit) return "critical";
  if (expiry <= warningLimit) return "warning";
  return "none";
}

export function urgencyCellClass(urgency: TrainingExpiryUrgency): string {
  switch (urgency) {
    case "critical":
      return "bg-rose-100";
    case "warning":
      return "bg-orange-100";
    default:
      return "bg-white";
  }
}
