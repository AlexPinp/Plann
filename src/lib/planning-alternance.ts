type AlternanceLikeUser = {
  planningTemplateNumber: number | null;
  planningGroupLabel: string | null;
  planningGroupColor: string | null;
  isAlternant: boolean;
  alternanceCycleWeeks: number;
  alternanceAnchorDate: Date | null;
  alternancePhase: number;
  planningTemplateNumberA: number | null;
  planningTemplateNumberB: number | null;
  planningGroupLabelA: string | null;
  planningGroupLabelB: string | null;
};

const DEFAULT_ALTERNANCE_ANCHOR = new Date(Date.UTC(2026, 2, 2, 12, 0, 0, 0));

function startOfIsoWeekMondayUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0));
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

function normalizeModulo(value: number, modulo: number) {
  return ((value % modulo) + modulo) % modulo;
}

export function getAlternanceStateForDate(user: AlternanceLikeUser, date: Date): "A" | "B" {
  if (!user.isAlternant) return "A";
  const cycleWeeks = Number.isInteger(user.alternanceCycleWeeks) && user.alternanceCycleWeeks > 0
    ? user.alternanceCycleWeeks
    : 6;
  const phase = normalizeModulo(user.alternancePhase, 2);
  const anchor = startOfIsoWeekMondayUtc(user.alternanceAnchorDate ?? DEFAULT_ALTERNANCE_ANCHOR);
  const weekStart = startOfIsoWeekMondayUtc(date);
  const deltaWeeks = Math.floor((weekStart.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const cycleBlock = Math.floor(deltaWeeks / cycleWeeks);
  const isB = normalizeModulo(cycleBlock + phase, 2) === 1;
  return isB ? "B" : "A";
}

export function getEffectivePlanningConfigForDate(user: AlternanceLikeUser, date: Date) {
  const state = getAlternanceStateForDate(user, date);
  if (!user.isAlternant) {
    return {
      alternanceState: "A" as const,
      templateNumber: user.planningTemplateNumber,
      groupLabel: user.planningGroupLabel,
      groupColor: user.planningGroupColor,
    };
  }
  const isB = state === "B";
  return {
    alternanceState: state,
    templateNumber: isB
      ? (user.planningTemplateNumberB ?? user.planningTemplateNumber)
      : (user.planningTemplateNumberA ?? user.planningTemplateNumber),
    groupLabel: isB
      ? (user.planningGroupLabelB ?? user.planningGroupLabel)
      : (user.planningGroupLabelA ?? user.planningGroupLabel),
    groupColor: user.planningGroupColor,
  };
}
