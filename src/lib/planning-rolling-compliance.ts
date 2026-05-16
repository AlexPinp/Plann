import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { SHIFT_TYPE_RECAP_SELECT, shiftCountsInHoursRecap } from "@/lib/shift-type-recap";
import { getShiftDurationHours } from "@/lib/shift-hours";

const ROLLING_DAYS = 7;
const WEEKLY_HOURS_LIMIT = 48;

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function utcNoon(y: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(y, monthIndex, day, 12, 0, 0, 0));
}

function dateKeyUtc(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export type RollingHoursViolation = {
  userId: string;
  lastName: string;
  firstName: string;
  maxHours: number;
  /** Début de la fenêtre de 7 jours (UTC) où le maximum est atteint, yyyy-MM-dd */
  worstWindowStart: string;
};

/**
 * Détecte les agents dont le cumul d'heures travaillées dépasse `WEEKLY_HOURS_LIMIT`
 * sur au moins une fenêtre glissante de 7 jours civils consécutifs dans la plage chargée.
 *
 * Les affectations de toutes les équipes sont prises en compte pour chaque agent.
 */
export async function findRolling7DayHoursViolations(options: {
  teamMemberUserIds: string[];
  /** Premier jour du mois affiché (inclus), UTC minuit OK */
  monthRangeStart: Date;
  /** Dernier jour du mois affiché (inclus) */
  monthRangeEnd: Date;
}): Promise<RollingHoursViolation[]> {
  const { teamMemberUserIds, monthRangeStart, monthRangeEnd } = options;
  if (teamMemberUserIds.length === 0) return [];

  const ext = new Date(monthRangeStart);
  ext.setUTCDate(ext.getUTCDate() - (ROLLING_DAYS - 1));

  const assignments = await prisma.assignment.findMany({
    where: {
      userId: { in: teamMemberUserIds },
      date: { gte: ext, lte: monthRangeEnd },
    },
    include: {
      shiftType: { select: SHIFT_TYPE_RECAP_SELECT },
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const hoursByUserAndDay = new Map<string, Map<string, number>>();
  for (const a of assignments) {
    if (!a.userId || !a.user) continue;
    if (!shiftCountsInHoursRecap(a.shiftType)) continue;
    const h = getShiftDurationHours(a.shiftType.startsAt, a.shiftType.endsAt);
    if (h <= 0) continue;
    const dk = dateKeyUtc(a.date);
    if (!hoursByUserAndDay.has(a.userId)) hoursByUserAndDay.set(a.userId, new Map());
    const m = hoursByUserAndDay.get(a.userId)!;
    m.set(dk, (m.get(dk) ?? 0) + h);
  }

  const windowStartDays: Date[] = [];
  const endAnchor = utcNoon(
    monthRangeEnd.getUTCFullYear(),
    monthRangeEnd.getUTCMonth(),
    monthRangeEnd.getUTCDate(),
  );
  let w = utcNoon(ext.getUTCFullYear(), ext.getUTCMonth(), ext.getUTCDate());
  while (w.getTime() <= endAnchor.getTime()) {
    windowStartDays.push(w);
    w = addUtcDays(w, 1);
  }

  const violations: RollingHoursViolation[] = [];

  for (const userId of teamMemberUserIds) {
    const dayMap = hoursByUserAndDay.get(userId);
    const refUser = assignments.find((x) => x.userId === userId)?.user;
    if (!dayMap || dayMap.size === 0 || !refUser) continue;

    let maxSum = 0;
    let worstStart: string | null = null;

    for (const ws of windowStartDays) {
      let sum = 0;
      for (let i = 0; i < ROLLING_DAYS; i++) {
        const key = dateKeyUtc(addUtcDays(ws, i));
        sum += dayMap.get(key) ?? 0;
      }
      if (sum > maxSum) {
        maxSum = sum;
        worstStart = dateKeyUtc(ws);
      }
    }

    if (maxSum > WEEKLY_HOURS_LIMIT + 1e-6) {
      violations.push({
        userId,
        lastName: refUser.lastName,
        firstName: refUser.firstName,
        maxHours: Math.round(maxSum * 10) / 10,
        worstWindowStart: worstStart ?? dateKeyUtc(windowStartDays[0]!),
      });
    }
  }

  violations.sort((a, b) => {
    const n = b.maxHours - a.maxHours;
    if (n !== 0) return n;
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr", {
      sensitivity: "base",
    });
  });

  return violations;
}
