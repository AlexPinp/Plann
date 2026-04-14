import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSessionPrismaUser } from "@/lib/current-user";
import {
  DEFAULT_PLANNING_RH_PROFILE,
  isLeapYear,
  planningRhProfileLabelsFr,
  planningRhRulesByProfile,
} from "@/lib/planning-rh";
import { prisma } from "@/lib/prisma";
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

function getShiftDurationHours(startsAt: string, endsAt: string): number {
  const [startH, startM] = startsAt.split(":").map((v) => Number(v));
  const [endH, endM] = endsAt.split(":").map((v) => Number(v));
  if ([startH, startM, endH, endM].some((v) => Number.isNaN(v))) return 0;
  let start = startH * 60 + startM;
  let end = endH * 60 + endM;
  if (end <= start) end += 24 * 60; // nuit qui passe minuit
  return (end - start) / 60;
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

export default async function DroitsPage({ searchParams }: SearchProps) {
  const me = await getSessionPrismaUser();
  if (!me) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 p-6 md:p-10">
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
    where: { active: true },
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
      <main className="mx-auto w-full max-w-4xl flex-1 p-6 md:p-10">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Aucun agent actif trouve.
        </p>
      </main>
    );
  }

  const assignmentsForMonth = await prisma.assignment.findMany({
    where: {
      userId: selectedUser.id,
      date: { gte: monthStart, lte: monthEnd },
    },
    include: { shiftType: true },
  });

  const assignmentsForYearLeaves = await prisma.assignment.findMany({
    where: {
      userId: selectedUser.id,
      date: { gte: yearStart, lte: yearEnd },
    },
    include: { shiftType: true },
  });

  const weekdayCountInMonth = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((dayNum) =>
    isWeekday(new Date(Date.UTC(referenceYear, referenceMonth, dayNum, 12, 0, 0))),
  ).length;
  const workRate = selectedUser.workPercentage / 100;
  const weeklyHours = FULL_TIME_WEEKLY_HOURS * workRate;
  const profile = selectedUser.planningRhProfile ?? DEFAULT_PLANNING_RH_PROFILE;
  const profileRules = planningRhRulesByProfile[profile];
  const annualReferenceHoursRaw = isLeapYear(referenceYear)
    ? profileRules.annualHoursLeapYear
    : profileRules.annualHoursCommonYear;

  const monthlyTheoreticalHours =
    profileRules.dailyHours === null ? null : roundToTenth(profileRules.dailyHours * weekdayCountInMonth * workRate);
  const annualTheoreticalHours =
    annualReferenceHoursRaw === null ? null : roundToTenth(annualReferenceHoursRaw * workRate);
  const annualRestDays = roundToHalfDay(profileRules.annualRestDays * workRate);
  const annualPublicHolidays = roundToHalfDay(profileRules.annualPublicHolidays * workRate);

  const monthlyRealHours = roundToTenth(
    assignmentsForMonth.reduce((sum, a) => {
      if ((LEAVE_CODES as readonly string[]).includes(a.shiftType.code)) return sum;
      return sum + getShiftDurationHours(a.shiftType.startsAt, a.shiftType.endsAt);
    }, 0),
  );
  const annualRealHours = roundToTenth(
    assignmentsForYearLeaves.reduce((sum, a) => {
      if ((LEAVE_CODES as readonly string[]).includes(a.shiftType.code)) return sum;
      return sum + getShiftDurationHours(a.shiftType.startsAt, a.shiftType.endsAt);
    }, 0),
  );

  // workRate already computed above
  const hoursRatio =
    monthlyTheoreticalHours && monthlyTheoreticalHours > 0 ? clamp(monthlyRealHours / monthlyTheoreticalHours, 0, 1.4) : 0;
  const hoursPercent = Math.round(clamp(hoursRatio, 0, 1) * 100);
  const annualHoursRatio =
    annualTheoreticalHours && annualTheoreticalHours > 0 ? clamp(annualRealHours / annualTheoreticalHours, 0, 1.4) : 0;
  const annualHoursPercent = Math.round(clamp(annualHoursRatio, 0, 1) * 100);

  const leaveStats = LEAVE_CODES.map((code) => {
    const yearlyQuota = roundToHalfDay((profileRules.annualLeaveQuota[code] ?? 0) * workRate);
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
    <main className="mx-auto w-full max-w-6xl flex-1 p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Droits et récapitulatif</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Récapitulatif individuel
        </p>
      </div>

      <form method="get" className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {canSelectAgent ? (
            <div>
              <label htmlFor="agentId" className="mb-1 block text-sm font-medium text-zinc-700">
                Agent
              </label>
              <select
                id="agentId"
                name="agentId"
                defaultValue={selectedUser.id}
                className="min-w-[280px] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.lastName.toUpperCase()} {u.firstName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="month" className="mb-1 block text-sm font-medium text-zinc-700">
              Mois
            </label>
            <input
              id="month"
              name="month"
              type="month"
              defaultValue={selectedMonthInputValue}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            />
          </div>

          {!canSelectAgent ? <input type="hidden" name="agentId" value={selectedUser.id} /> : null}

          <button
            type="submit"
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
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
          <p className="text-sm text-zinc-700">Temps de travail : {selectedUser.workPercentage} %</p>
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
            Réel (planning saisi): <span className="font-semibold text-zinc-900">{monthlyRealHours} h</span>
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
              : `Repère annuel (proratisé): ${annualTheoreticalHours} h pour ${weeklyHours} h/semaine.`}
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
              Réel (planning saisi): <span className="font-semibold text-zinc-900">{annualRealHours} h</span>
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
          <h2 className="text-sm font-semibold text-zinc-900">Congés )</h2>
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
          <p className="mt-2 text-xs text-zinc-500">
            Quotas de base 100% : CA {profileRules.annualLeaveQuota.CA}j, CF{" "}
            {profileRules.annualLeaveQuota.CF}j, CH {profileRules.annualLeaveQuota.CH}j, RTT{" "}
            {profileRules.annualLeaveQuota.RTT}j.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Autres repères annuels proratisés: RH {annualRestDays} j, fériés {annualPublicHolidays} j.
          </p>
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
