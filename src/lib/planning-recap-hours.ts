import { format } from "date-fns";
import { PlanningStatus } from "@/generated/prisma/enums";
import {
  alternanceTimingFromUser,
  getEffectivePlanningConfigForUserTeam,
  planningConfigFromUserOrTeam,
} from "@/lib/planning-alternance";
import {
  DEFAULT_TEMPLATE_CYCLE_WEEKS,
  getTemplateDayOffsetForCycle,
  normalizeTemplateCycleWeeks,
} from "@/lib/planning-template";
import { prisma } from "@/lib/prisma";
import { SHIFT_TYPE_RECAP_SELECT, shiftCountsInHoursRecap } from "@/lib/shift-type-recap";
import { getShiftDurationHours } from "@/lib/shift-hours";
import { startOfIsoWeekMondayUtc } from "@/lib/planning-week";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Semaines ISO (lundi) qui intersectent [rangeStart, rangeEnd] (midi UTC). */
function collectWeekStartsInRange(rangeStart: Date, rangeEnd: Date): Date[] {
  const seen = new Set<number>();
  const result: Date[] = [];
  const start = new Date(
    Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate(), 12, 0, 0),
  );
  const end = new Date(
    Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), rangeEnd.getUTCDate(), 12, 0, 0),
  );
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const d = new Date(t);
    const ws = startOfIsoWeekMondayUtc(d);
    if (!seen.has(ws.getTime())) {
      seen.add(ws.getTime());
      result.push(ws);
    }
  }
  return result;
}

/**
 * Somme des heures « réelles » pour un agent dans une équipe sur une plage :
 * - semaine validée : affectation saisie si présente, sinon poste issu de la trame (comme le planning équipe après validation) ;
 * - semaine non validée : uniquement les affectations déjà en base (pas de trame).
 */
export async function sumEffectiveWorkedHoursForTeamUserRange(options: {
  teamId: string;
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<number> {
  const { teamId, userId, rangeStart, rangeEnd } = options;

  const membership = await prisma.userTeam.findUnique({
    where: { userId_teamId: { userId, teamId } },
    include: { user: true },
  });
  if (!membership) return 0;

  const u = membership.user;
  const cfg = planningConfigFromUserOrTeam(u, membership);
  const timing = alternanceTimingFromUser(u);

  const weekStarts = collectWeekStartsInRange(rangeStart, rangeEnd);

  const templateNumbers = Array.from(
    new Set(
      [cfg.planningTemplateNumber, cfg.planningTemplateNumberA, cfg.planningTemplateNumberB].filter(
        (n): n is number => typeof n === "number",
      ),
    ),
  );

  const [assignments, planningWeeks, shifts, templates] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        userId,
        date: { gte: rangeStart, lte: rangeEnd },
        planningWeek: { teamId },
      },
      include: { shiftType: { select: SHIFT_TYPE_RECAP_SELECT } },
    }),
    prisma.planningWeek.findMany({
      where: { teamId, weekStart: { in: weekStarts } },
    }),
    prisma.shiftType.findMany({ where: { teamId }, select: SHIFT_TYPE_RECAP_SELECT }),
    templateNumbers.length
      ? prisma.planningTemplate.findMany({
          where: { teamId, number: { in: templateNumbers } },
          include: { entries: { where: { shiftTypeId: { not: null } } } },
        })
      : Promise.resolve([]),
  ]);

  const validatedWeekStarts = new Set(
    planningWeeks.filter((w) => w.status === PlanningStatus.VALIDATED).map((w) => w.weekStart.getTime()),
  );

  const cellMap: Record<string, (typeof assignments)[number]> = {};
  for (const a of assignments) {
    if (!a.userId) continue;
    cellMap[`${a.userId}|${format(a.date, "yyyy-MM-dd")}`] = a;
  }

  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const templateShiftByNumberAndOffset: Record<string, string> = {};
  const cycleWeeksByTemplateNumber = new Map<number, number>();
  const cycleStartDateByTemplateNumber = new Map<number, Date | null>();
  for (const template of templates) {
    cycleWeeksByTemplateNumber.set(template.number, normalizeTemplateCycleWeeks(template.cycleWeeks));
    cycleStartDateByTemplateNumber.set(template.number, template.cycleStartDate);
    for (const entry of template.entries) {
      if (!entry.shiftTypeId) continue;
      templateShiftByNumberAndOffset[`${template.number}|${entry.dayOffset}`] = entry.shiftTypeId;
    }
  }

  let sum = 0;
  const start = new Date(
    Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate(), 12, 0, 0),
  );
  const end = new Date(
    Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), rangeEnd.getUTCDate(), 12, 0, 0),
  );

  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const cursor = new Date(t);
    const dk = format(cursor, "yyyy-MM-dd");
    const ws = startOfIsoWeekMondayUtc(cursor);
    const dayValidated = validatedWeekStarts.has(ws.getTime());
    const cell = cellMap[`${userId}|${dk}`];

    const effectiveConfig = getEffectivePlanningConfigForUserTeam(timing, cfg, cursor);
    const effectiveTemplateNumber = effectiveConfig.templateNumber;
    const cycleW = effectiveTemplateNumber
      ? (cycleWeeksByTemplateNumber.get(effectiveTemplateNumber) ?? DEFAULT_TEMPLATE_CYCLE_WEEKS)
      : 6;
    const cycleStart =
      effectiveTemplateNumber != null ? (cycleStartDateByTemplateNumber.get(effectiveTemplateNumber) ?? null) : null;
    const dayOffset = getTemplateDayOffsetForCycle(cursor, cycleW, cycleStart);
    const templateShiftId = effectiveTemplateNumber
      ? templateShiftByNumberAndOffset[`${effectiveTemplateNumber}|${dayOffset}`]
      : undefined;
    const templateShift = templateShiftId ? shiftById.get(templateShiftId) : undefined;

    const effectiveShift = dayValidated ? (cell?.shiftType ?? templateShift) : cell?.shiftType;

    if (effectiveShift && shiftCountsInHoursRecap(effectiveShift)) {
      sum += getShiftDurationHours(effectiveShift.startsAt, effectiveShift.endsAt);
    }
  }

  return sum;
}
