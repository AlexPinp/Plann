import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { notFound } from "next/navigation";
import { DroitsRecapView } from "./DroitsRecapView";
import { getSessionPrismaUser } from "@/lib/current-user";
import { DEFAULT_PLANNING_RH_PROFILE, planningRhProfileLabelsFr, planningRhRulesByProfile } from "@/lib/planning-rh";
import { sumEffectiveWorkedHoursForTeamUserRange } from "@/lib/planning-recap-hours";
import {
  averageAnnualWorkRatePercent,
  monthlyRatesForYear,
  weekdayCountInUtcMonth,
} from "@/lib/work-rate-segments";
import { prisma } from "@/lib/prisma";
import { getTeamBySlug } from "@/lib/team";
import { canEditPlanningAndStaff } from "@/lib/user-roles";

const FULL_TIME_WEEKLY_HOURS = 35;
const LEAVE_CODES = ["CA", "CF", "CH", "RTT"] as const;

type SearchProps = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseSelectedAgentId(sp: Record<string, string | string[] | undefined>) {
  return typeof sp.agentId === "string" ? sp.agentId : undefined;
}

function parseSelectedMonth(sp: Record<string, string | string[] | undefined>): Date | null {
  const raw = typeof sp.month === "string" ? sp.month.trim() : "";
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0));
}

function isWeekday(date: Date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToHalfDay(value: number) {
  return Math.round(value * 2) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default async function DroitsPage({ params, searchParams }: SearchProps) {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const me = await getSessionPrismaUser();
  if (!me) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6 md:p-10">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Profil agent introuvable pour cette session. Reconnectez-vous ou contactez votre cadre.
        </p>
      </main>
    );
  }

  const canSelectAgent = canEditPlanningAndStaff(me.role);
  const sp = await searchParams;
  const selectedFromQuery = parseSelectedAgentId(sp);
  const selectedMonth = parseSelectedMonth(sp);
  const now = new Date();
  const referenceDate = selectedMonth ?? now;
  const referenceYear = referenceDate.getUTCFullYear();
  const referenceMonth = referenceDate.getUTCMonth();
  const selectedMonthInputValue = `${referenceYear}-${String(referenceMonth + 1).padStart(2, "0")}`;

  const yearStart = new Date(Date.UTC(referenceYear, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(referenceYear, 11, 31, 23, 59, 59, 999));
  const monthStart = new Date(Date.UTC(referenceYear, referenceMonth, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(referenceYear, referenceMonth + 1, 0, 23, 59, 59, 999));
  const daysInMonth = monthEnd.getUTCDate();

  const users = await prisma.user.findMany({
    where: {
      active: true,
      teams: { some: { teamId: team.id } },
    },
    include: {
      skills: { include: { skill: true } },
      availabilities: {
        where: { endsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const meFromList = users.find((u) => u.id === me.id);
  const selectedUser =
    (canSelectAgent && selectedFromQuery ? users.find((u) => u.id === selectedFromQuery) : null) ??
    meFromList ??
    users[0];

  if (!selectedUser) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6 md:p-10">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Aucun agent actif trouve.
        </p>
      </main>
    );
  }

  const [assignmentsForYearLeaves, workRateSegments] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        userId: selectedUser.id,
        date: { gte: yearStart, lte: yearEnd },
        planningWeek: { teamId: team.id },
      },
      include: { shiftType: true },
    }),
    prisma.userWorkRateSegment.findMany({
      where: { userId: selectedUser.id },
      orderBy: { monthStartsOn: "asc" },
    }),
  ]);

  const weekdayCountInMonth = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((dayNum) =>
    isWeekday(new Date(Date.UTC(referenceYear, referenceMonth, dayNum, 12, 0, 0))),
  ).length;

  const monthlyRatesForYearArr = monthlyRatesForYear(
    workRateSegments,
    selectedUser.workPercentage,
    referenceYear,
  );
  const selectedMonthWorkPct = monthlyRatesForYearArr[referenceMonth] ?? selectedUser.workPercentage;
  const workRate = selectedMonthWorkPct / 100;
  const annualAvgRateDecimal = averageAnnualWorkRatePercent(monthlyRatesForYearArr) / 100;

  const weeklyHours = FULL_TIME_WEEKLY_HOURS * workRate;
  const profile = selectedUser.planningRhProfile ?? DEFAULT_PLANNING_RH_PROFILE;
  const profileRules = planningRhRulesByProfile[profile];
  const monthlyTheoreticalHours =
    profileRules.dailyHours === null ? null : roundToTenth(profileRules.dailyHours * weekdayCountInMonth * workRate);

  let annualTheoreticalSum = 0;
  if (profileRules.dailyHours !== null) {
    for (let mi = 0; mi < 12; mi++) {
      const wd = weekdayCountInUtcMonth(referenceYear, mi);
      const rm = monthlyRatesForYearArr[mi] ?? selectedUser.workPercentage;
      annualTheoreticalSum += profileRules.dailyHours * wd * (rm / 100);
    }
  }
  const annualTheoreticalHours =
    profileRules.dailyHours === null ? null : roundToTenth(annualTheoreticalSum);

  const annualRestDays = roundToHalfDay(profileRules.annualRestDays * annualAvgRateDecimal);
  const annualPublicHolidays = roundToHalfDay(profileRules.annualPublicHolidays * annualAvgRateDecimal);

  const [monthlyRawHours, annualRawHours] = await Promise.all([
    sumEffectiveWorkedHoursForTeamUserRange({
      teamId: team.id,
      userId: selectedUser.id,
      rangeStart: monthStart,
      rangeEnd: monthEnd,
    }),
    sumEffectiveWorkedHoursForTeamUserRange({
      teamId: team.id,
      userId: selectedUser.id,
      rangeStart: yearStart,
      rangeEnd: yearEnd,
    }),
  ]);
  const monthlyRealHours = roundToTenth(monthlyRawHours);
  const annualRealHours = roundToTenth(annualRawHours);

  // workRate already computed above
  const hoursRatio =
    monthlyTheoreticalHours && monthlyTheoreticalHours > 0 ? clamp(monthlyRealHours / monthlyTheoreticalHours, 0, 1.4) : 0;
  const hoursPercent = Math.round(clamp(hoursRatio, 0, 1) * 100);
  const annualHoursRatio =
    annualTheoreticalHours && annualTheoreticalHours > 0 ? clamp(annualRealHours / annualTheoreticalHours, 0, 1.4) : 0;
  const annualHoursPercent = Math.round(clamp(annualHoursRatio, 0, 1) * 100);

  const leaveStats = LEAVE_CODES.map((code) => {
    const yearlyQuota = roundToHalfDay((profileRules.annualLeaveQuota[code] ?? 0) * annualAvgRateDecimal);
    const taken = assignmentsForYearLeaves.reduce(
      (count, a) => (a.shiftType.code === code ? count + 1 : count),
      0,
    );
    const toTake = Math.max(0, roundToHalfDay(yearlyQuota - taken));
    const usedRatio = yearlyQuota > 0 ? clamp(taken / yearlyQuota, 0, 1.4) : 0;
    const usedPercent = Math.round(clamp(usedRatio, 0, 1) * 100);
    return { code, yearlyQuota, toTake, taken, usedRatio, usedPercent };
  });


  const monthLabel = format(referenceDate, "MMMM yyyy", { locale: fr });
  const profileLabel = planningRhProfileLabelsFr[profile];
  const profileShort = profileLabel.includes(" - ") ? profileLabel.split(" - ")[0]! : profileLabel;

  return (
    <DroitsRecapView
      canSelectAgent={canSelectAgent}
      users={users.map((u) => ({ id: u.id, lastName: u.lastName, firstName: u.firstName }))}
      selectedUser={selectedUser}
      selectedMonthInputValue={selectedMonthInputValue}
      monthLabel={monthLabel}
      referenceYear={referenceYear}
      profileShort={profileShort}
      selectedMonthWorkPct={selectedMonthWorkPct}
      annualAvgWorkPct={Math.round(annualAvgRateDecimal * 100)}
      hasWorkRateSegments={workRateSegments.length > 0}
      weeklyHours={weeklyHours}
      annualRestDays={annualRestDays}
      annualPublicHolidays={annualPublicHolidays}
      monthlyTheoreticalHours={monthlyTheoreticalHours}
      monthlyRealHours={monthlyRealHours}
      hoursPercent={hoursPercent}
      hoursRatio={hoursRatio}
      annualTheoreticalHours={annualTheoreticalHours}
      annualRealHours={annualRealHours}
      annualHoursPercent={annualHoursPercent}
      annualHoursRatio={annualHoursRatio}
      leaveStats={leaveStats}
      availabilities={selectedUser.availabilities}
    />
  );
}
