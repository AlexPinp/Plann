import { prisma } from "@/lib/prisma";

/** Lundi de la semaine ISO (calendrier UTC) à midi UTC pour clé stable */
export function startOfIsoWeekMondayUtc(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const mid = new Date(Date.UTC(y, m, d, 12, 0, 0));
  const dow = mid.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  mid.setUTCDate(mid.getUTCDate() + offset);
  return new Date(Date.UTC(mid.getUTCFullYear(), mid.getUTCMonth(), mid.getUTCDate(), 12, 0, 0));
}

export async function getOrCreatePlanningWeekForDate(date: Date) {
  const weekStart = startOfIsoWeekMondayUtc(date);
  return prisma.planningWeek.upsert({
    where: { weekStart },
    update: {},
    create: { weekStart },
  });
}

/** Intervalle [start, end) du jour calendaire UTC pour la date y-m-d */
export function utcDayRange(y: number, monthIndex0: number, day: number) {
  const start = new Date(Date.UTC(y, monthIndex0, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, monthIndex0, day + 1, 0, 0, 0, 0));
  return { start, end };
}
