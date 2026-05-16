import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { notFound } from "next/navigation";
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
import { canEditPlanningAndStaff, roleLabelsFr } from "@/lib/user-roles";
import type { UserRole } from "@/generated/prisma/enums";

const availabilityLabels: Record<string, string> = {
  CONGE: "Congé",
  ARRET: "Arrêt",
  FORMATION: "Formation",
  AUTRE: "Autre",
};

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

function getProgressTone(ratio: number) {
  if (ratio < 0.6) return "bg-emerald-500";
  if (ratio < 0.9) return "bg-amber-500";
  return "bg-rose-500";
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Droits et récapitulatif</h1>
      
      </div>

      <form method="get" className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {canSelectAgent ? (
            <div className="w-full sm:w-auto">
              <label htmlFor="agentId" className="mb-1 block text-sm font-medium text-zinc-700">
                Agent
              </label>
              <select
                id="agentId"
                name="agentId"
                defaultValue={selectedUser.id}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 sm:min-w-[280px]"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.lastName.toUpperCase()} {u.firstName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="w-full sm:w-auto">
            <label htmlFor="month" className="mb-1 block text-sm font-medium text-zinc-700">
              Mois
            </label>
            <input
              id="month"
              name="month"
              type="month"
              defaultValue={selectedMonthInputValue}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            />
          </div>

          {!canSelectAgent ? <input type="hidden" name="agentId" value={selectedUser.id} /> : null}

          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
          >
            Voir le récapitulatif
          </button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Agent</h2>
          <p className="mt-2 text-base font-medium text-zinc-900">
            {selectedUser.lastName.toUpperCase()} {selectedUser.firstName}
          </p>
          <p className="text-xs text-zinc-500">{selectedUser.email}</p>
          <p className="mt-3 text-sm text-zinc-700">
            Rôle: {roleLabelsFr[selectedUser.role as UserRole] ?? selectedUser.role}
          </p>
          <p className="text-sm text-zinc-700">
            Temps de travail (mois affiché) : {selectedMonthWorkPct} %
          </p>
          {workRateSegments.length > 0 ? (
            <p className="mt-1 text-xs text-zinc-500">
              Segments mois pleins actifs : les totaux annuels (objectifs, repos, quotas congés) sont pondérés mois par
              mois sur {referenceYear} (moyenne ~ {Math.round(annualAvgRateDecimal * 100)} %).
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              Défaut agent : {selectedUser.workPercentage} %. Ajoutez des segments sur la fiche agent pour des temps
              partiels par période.
            </p>
          )}
          <p className="text-sm text-zinc-700">
            Compétences: {selectedUser.skills.length ? selectedUser.skills.map((s) => s.skill.name).join(", ") : "—"}
          </p>
          <p className="text-sm text-zinc-700">Profil RH : {planningRhProfileLabelsFr[profile]}</p>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Heures (mois en cours)</h2>
         
          <p className="mt-2 text-sm text-zinc-700">
            Théorique:{" "}
            <span className="font-semibold text-zinc-900">
              {monthlyTheoreticalHours === null ? "N/A (forfait jours)" : `${monthlyTheoreticalHours} h`}
            </span>
          </p>
          <p className="text-sm text-zinc-700">
            Réel : <span className="font-semibold text-zinc-900">{monthlyRealHours} h</span>
          </p>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <span>Avancement heures</span>
              <span className="font-semibold text-zinc-800">{hoursPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className={`h-full transition-all ${getProgressTone(hoursRatio)}`}
                style={{ width: `${hoursPercent}%` }}
              />
            </div>
          </div>
         
          <p className="mt-1 text-xs text-zinc-500">
            {annualTheoreticalHours === null
              ? "Repère annuel: N/A (forfait jours, référence en jours)."
              : `Repère annuel ${referenceYear} (somme des mois au bon %) : ${annualTheoreticalHours} h — équivalent ~ ${weeklyHours} h/semaine sur le mois affiché.`}
          </p>
          <div className="mt-4 border-t border-zinc-200 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Heures (année en cours)</h3>
            <p className="mt-2 text-sm text-zinc-700">
              Théorique:{" "}
              <span className="font-semibold text-zinc-900">
                {annualTheoreticalHours === null ? "N/A (forfait jours)" : `${annualTheoreticalHours} h`}
              </span>
            </p>
            <p className="text-sm text-zinc-700">
              Réel : <span className="font-semibold text-zinc-900">{annualRealHours} h</span>
            </p>
            {annualTheoreticalHours === null ? (
              <p className="mt-2 text-xs text-zinc-500">
                Suivi horaire annuel non applicable en forfait jours (référence exprimée en jours).
              </p>
            ) : (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                  <span>Avancement heures </span>
                  <span className="font-semibold text-zinc-800">{annualHoursPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className={`h-full transition-all ${getProgressTone(annualHoursRatio)}`}
                    style={{ width: `${annualHoursPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Congés</h2>
          <ul className="mt-2 space-y-3 text-sm text-zinc-700">
            {leaveStats.map((s) => (
              <li key={s.code}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-zinc-900">{s.code}</span>
                  <span className="text-xs font-semibold text-zinc-700">{s.usedPercent}% utilisés</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className={`h-full transition-all ${getProgressTone(s.usedRatio)}`}
                    style={{ width: `${s.usedPercent}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-zinc-700">
                  quota {s.yearlyQuota} j / à poser {s.toTake} j / posés {s.taken} j
                </div>
              </li>
            ))}
          </ul>
           </section>
      </div>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Absences à venir</h2>
        <div className="mt-3 text-sm text-zinc-700">
          {selectedUser.availabilities.length === 0 ? (
            <span className="text-zinc-500">Aucune absence à venir.</span>
          ) : (
            <ul className="space-y-1">
              {selectedUser.availabilities.map((a) => (
                <li key={a.id} className="text-xs leading-relaxed">
                  <span className="font-medium text-zinc-800">{availabilityLabels[a.type] ?? a.type}</span>
                  <span className="text-zinc-500">
                    {" "}
                    : {format(a.startsAt, "dd/MM/yyyy", { locale: fr })} → {format(a.endsAt, "dd/MM/yyyy", { locale: fr })}
                  </span>
                  {a.note ? <span className="block text-zinc-500">({a.note})</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
