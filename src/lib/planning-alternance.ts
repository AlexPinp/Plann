import type { User, UserTeam } from "@/generated/prisma/client";

/** Paramètres d'alternance A/B, globaux à la personne (portés par User). */
export type AlternanceTiming = {
  isAlternant: boolean;
  alternanceCycleWeeks: number;
  alternanceAnchorDate: Date | null;
  alternancePhase: number;
};

/** Configuration de planning d'un agent DANS une équipe.
 *  Portée par `UserTeam` depuis la phase 1 ; pendant la transition, ces mêmes
 *  champs existent aussi sur `User` pour l'équipe historique (IDE jour). */
export type PlanningConfig = {
  planningTemplateNumber: number | null;
  planningGroupLabel: string | null;
  planningGroupColor: string | null;
  planningTemplateNumberA: number | null;
  planningTemplateNumberB: number | null;
  planningGroupLabelA: string | null;
  planningGroupLabelB: string | null;
};

/** Rétrocompatibilité : objet « tout-en-un » tel qu'il existait côté User
 *  avant l'introduction des équipes. */
export type AlternanceLikeUser = AlternanceTiming & PlanningConfig;

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

/** État alternant (A ou B) pour une date donnée, pour un utilisateur donné.
 *  Ne dépend QUE des champs d'alternance globaux. */
export function getAlternanceStateForDate(timing: AlternanceTiming, date: Date): "A" | "B" {
  if (!timing.isAlternant) return "A";
  const cycleWeeks = Number.isInteger(timing.alternanceCycleWeeks) && timing.alternanceCycleWeeks > 0
    ? timing.alternanceCycleWeeks
    : 6;
  const phase = normalizeModulo(timing.alternancePhase, 2);
  const anchor = startOfIsoWeekMondayUtc(timing.alternanceAnchorDate ?? DEFAULT_ALTERNANCE_ANCHOR);
  const weekStart = startOfIsoWeekMondayUtc(date);
  const deltaWeeks = Math.floor((weekStart.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const cycleBlock = Math.floor(deltaWeeks / cycleWeeks);
  const isB = normalizeModulo(cycleBlock + phase, 2) === 1;
  return isB ? "B" : "A";
}

/** Configuration effective (trame/bloc/couleur) pour une date, en combinant le
 *  timing d'alternance et la config planning d'une équipe spécifique. */
export function getEffectivePlanningConfigForUserTeam(
  timing: AlternanceTiming,
  config: PlanningConfig,
  date: Date,
) {
  const state = getAlternanceStateForDate(timing, date);
  if (!timing.isAlternant) {
    return {
      alternanceState: "A" as const,
      templateNumber: config.planningTemplateNumber,
      groupLabel: config.planningGroupLabel,
      groupColor: config.planningGroupColor,
    };
  }
  const isB = state === "B";
  return {
    alternanceState: state,
    templateNumber: isB
      ? (config.planningTemplateNumberB ?? config.planningTemplateNumber)
      : (config.planningTemplateNumberA ?? config.planningTemplateNumber),
    groupLabel: isB
      ? (config.planningGroupLabelB ?? config.planningGroupLabel)
      : (config.planningGroupLabelA ?? config.planningGroupLabel),
    groupColor: config.planningGroupColor,
  };
}

/** Rétrocompatibilité : version acceptant un `User` legacy (timing + config sur le même objet).
 *  Équivalent à `getEffectivePlanningConfigForUserTeam(user, user, date)`. */
export function getEffectivePlanningConfigForDate(user: AlternanceLikeUser, date: Date) {
  return getEffectivePlanningConfigForUserTeam(user, user, date);
}

/** Champs d'alternance lus depuis un enregistrement `User`. */
export function alternanceTimingFromUser(user: {
  isAlternant: boolean;
  alternanceCycleWeeks: number;
  alternanceAnchorDate: Date | null;
  alternancePhase: number;
}): AlternanceTiming {
  return {
    isAlternant: user.isAlternant,
    alternanceCycleWeeks: user.alternanceCycleWeeks,
    alternanceAnchorDate: user.alternanceAnchorDate,
    alternancePhase: user.alternancePhase,
  };
}

type UserPlanningFields = Pick<
  User,
  | "planningTemplateNumber"
  | "planningGroupLabel"
  | "planningGroupColor"
  | "planningTemplateNumberA"
  | "planningTemplateNumberB"
  | "planningGroupLabelA"
  | "planningGroupLabelB"
>;

type UserTeamPlanningFields = Pick<
  UserTeam,
  | "planningTemplateNumber"
  | "planningGroupLabel"
  | "planningGroupColor"
  | "planningTemplateNumberA"
  | "planningTemplateNumberB"
  | "planningGroupLabelA"
  | "planningGroupLabelB"
>;

/** Config planning pour une équipe : priorité au pivot `UserTeam`, sinon champs `User` (migration). */
export function planningConfigFromUserOrTeam(user: UserPlanningFields, ut: UserTeamPlanningFields | null): PlanningConfig {
  if (ut) {
    return {
      planningTemplateNumber: ut.planningTemplateNumber,
      planningGroupLabel: ut.planningGroupLabel,
      planningGroupColor: ut.planningGroupColor,
      planningTemplateNumberA: ut.planningTemplateNumberA,
      planningTemplateNumberB: ut.planningTemplateNumberB,
      planningGroupLabelA: ut.planningGroupLabelA,
      planningGroupLabelB: ut.planningGroupLabelB,
    };
  }
  return {
    planningTemplateNumber: user.planningTemplateNumber,
    planningGroupLabel: user.planningGroupLabel,
    planningGroupColor: user.planningGroupColor,
    planningTemplateNumberA: user.planningTemplateNumberA,
    planningTemplateNumberB: user.planningTemplateNumberB,
    planningGroupLabelA: user.planningGroupLabelA,
    planningGroupLabelB: user.planningGroupLabelB,
  };
}
