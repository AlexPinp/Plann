import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DEFAULT_TEMPLATE_CYCLE_WEEKS,
  getTemplateDayOffsetForCycle,
  normalizeTemplateCycleWeeks,
} from "@/lib/planning-template";
import { startOfIsoWeekMondayUtc } from "@/lib/planning-week";
import {
  alternanceTimingFromUser,
  getEffectivePlanningConfigForUserTeam,
  planningConfigFromUserOrTeam,
} from "@/lib/planning-alternance";
import { prisma } from "@/lib/prisma";
import { PlanningStatus } from "@/generated/prisma/enums";
import { getSessionPrismaUser } from "@/lib/current-user";
import { findRolling7DayHoursViolations } from "@/lib/planning-rolling-compliance";
import { canEditPlanningAndStaff, requirePlanningAndStaffAccess } from "@/lib/user-roles";
import { getTeamBySlug } from "@/lib/team";
import { adminTeamPath, workspacePath } from "@/lib/routes";
import { PlanningMonthGrid } from "@/app/(workspace)/[team]/planning/admin/PlanningMonthGrid";
import { validatePlanningMonth, unvalidatePlanningMonth } from "@/app/(workspace)/[team]/planning/admin/actions";

const DOW_FR = ["D", "L", "M", "M", "J", "V", "S"];
const MONTH_OPTIONS = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Fevrier" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Aout" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Decembre" },
];

type RowOrderMode = "team" | "template" | "alpha";

function parseMonth(sp: Record<string, string | string[] | undefined>): { y: number; m: number } {
  const now = new Date();
  const rawY = typeof sp.year === "string" ? sp.year : undefined;
  const rawM = typeof sp.month === "string" ? sp.month : undefined;
  const y = rawY ? Number(rawY) : now.getUTCFullYear();
  const m = rawM ? Number(rawM) : now.getUTCMonth() + 1;
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
    return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 };
  }
  return { y, m };
}

function parseRowOrder(sp: Record<string, string | string[] | undefined>): RowOrderMode {
  const raw = typeof sp.rowOrder === "string" ? sp.rowOrder : "team";
  if (raw === "template" || raw === "alpha") return raw;
  return "team";
}

function addMonths(y: number, m: number, delta: number) {
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function getYearOptions(centerYear: number): number[] {
  return Array.from({ length: 13 }, (_, i) => centerYear - 6 + i);
}

type SearchProps = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanningAdminPage({ params, searchParams }: SearchProps) {
  await requirePlanningAndStaffAccess();
  const viewer = await getSessionPrismaUser();
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const sp = await searchParams;
  const { y, m } = parseMonth(sp);
  const rowOrder = parseRowOrder(sp);

  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = Array.from({ length: lastDay }, (_, i) => {
    const dayNum = i + 1;
    const dt = new Date(Date.UTC(y, m - 1, dayNum, 12, 0, 0));
    const key = `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const dow = DOW_FR[dt.getUTCDay()];
    return { key, dayNum, dow };
  });

  const rangeStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999));

  const members = await prisma.userTeam.findMany({
    where: { teamId: team.id, user: { active: true } },
    include: { user: true },
  });

  const memberUserIds = members.map((mem) => mem.userId);

  const [assignments, shifts, comments] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
        userId: { not: null },
        planningWeek: { teamId: team.id },
      },
      include: { shiftType: true },
    }),
    prisma.shiftType.findMany({ orderBy: { code: "asc" } }),
    prisma.planningComment.findMany({
      where: {
        userId: { in: memberUserIds },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const usedTemplateNumbers = Array.from(
    new Set(
      members.flatMap((mem) => {
        const cfg = planningConfigFromUserOrTeam(mem.user, mem);
        return [cfg.planningTemplateNumber, cfg.planningTemplateNumberA, cfg.planningTemplateNumberB].filter(
          (n): n is number => typeof n === "number",
        );
      }),
    ),
  );
  const templates = usedTemplateNumbers.length
    ? await prisma.planningTemplate.findMany({
        where: { teamId: team.id, number: { in: usedTemplateNumbers } },
        include: { entries: { where: { shiftTypeId: { not: null } } } },
      })
    : [];

  const anchorMonth = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));

  const byDisplayName = (
    a: (typeof members)[number]["user"],
    b: (typeof members)[number]["user"],
  ) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr", {
      sensitivity: "base",
    });

  const sortedMembers = [...members].sort((ma, mb) => {
    const a = ma.user;
    const b = mb.user;
    if (rowOrder === "template") {
      const aTemplate =
        getEffectivePlanningConfigForUserTeam(
          alternanceTimingFromUser(a),
          planningConfigFromUserOrTeam(a, ma),
          anchorMonth,
        ).templateNumber ?? Number.POSITIVE_INFINITY;
      const bTemplate =
        getEffectivePlanningConfigForUserTeam(
          alternanceTimingFromUser(b),
          planningConfigFromUserOrTeam(b, mb),
          anchorMonth,
        ).templateNumber ?? Number.POSITIVE_INFINITY;
      if (aTemplate !== bTemplate) return aTemplate - bTemplate;
      return byDisplayName(a, b);
    }
    if (rowOrder === "alpha") {
      return byDisplayName(a, b);
    }
    const effectiveGroupA =
      getEffectivePlanningConfigForUserTeam(
        alternanceTimingFromUser(a),
        planningConfigFromUserOrTeam(a, ma),
        anchorMonth,
      ).groupLabel ?? "Sans groupe";
    const effectiveGroupB =
      getEffectivePlanningConfigForUserTeam(
        alternanceTimingFromUser(b),
        planningConfigFromUserOrTeam(b, mb),
        anchorMonth,
      ).groupLabel ?? "Sans groupe";
    const groupA = effectiveGroupA.localeCompare(effectiveGroupB, "fr", {
      sensitivity: "base",
    });
    if (groupA !== 0) return groupA;
    const displayA = ma.displayOrder ?? Number.POSITIVE_INFINITY;
    const displayB = mb.displayOrder ?? Number.POSITIVE_INFINITY;
    if (displayA !== displayB) return displayA - displayB;
    return byDisplayName(a, b);
  });

  const groupsMap = new Map<string, { label: string; color: string; users: { id: string; displayName: string }[] }>();
  for (const mem of sortedMembers) {
    const u = mem.user;
    const effectiveConfig = getEffectivePlanningConfigForUserTeam(
      alternanceTimingFromUser(u),
      planningConfigFromUserOrTeam(u, mem),
      anchorMonth,
    );
    const label =
      rowOrder === "template"
        ? (effectiveConfig.templateNumber !== null ? `Trame ${effectiveConfig.templateNumber}` : "Sans trame")
        : rowOrder === "alpha"
          ? "Ordre alphabetique"
          : (effectiveConfig.groupLabel ?? "Sans groupe");
    const color = rowOrder === "team" ? (effectiveConfig.groupColor ?? "#f4f4f5") : "#f4f4f5";
    if (!groupsMap.has(label)) {
      groupsMap.set(label, { label, color, users: [] });
    }
    groupsMap.get(label)!.users.push({
      id: u.id,
      displayName: `${u.lastName.toUpperCase()} ${u.firstName}`,
    });
  }
  const groups = Array.from(groupsMap.values());

  const cellShiftByKey: Record<string, string> = {};
  for (const a of assignments) {
    if (!a.userId) continue;
    const dk = format(a.date, "yyyy-MM-dd");
    cellShiftByKey[`${a.userId}|${dk}`] = a.shiftTypeId;
  }
  const commentsByKey: Record<
    string,
    {
      id: string;
      type: string;
      status: string;
      visibility: string;
      text: string;
      createdAtIso: string;
      createdByName: string;
    }[]
  > = {};
  for (const comment of comments) {
    const dk = format(comment.date, "yyyy-MM-dd");
    const key = `${comment.userId}|${dk}`;
    if (!commentsByKey[key]) commentsByKey[key] = [];
    commentsByKey[key].push({
      id: comment.id,
      type: comment.type,
      status: comment.status,
      visibility: comment.visibility,
      text: comment.text,
      createdAtIso: comment.createdAt.toISOString(),
      createdByName: comment.createdBy
        ? `${comment.createdBy.firstName} ${comment.createdBy.lastName.toUpperCase()}`
        : "Utilisateur inconnu",
    });
  }

  const monthLabel = format(new Date(Date.UTC(y, m - 1, 1)), "MMMM yyyy", { locale: fr });
  const shiftOptions = shifts.map((s) => ({
    id: s.id,
    code: s.code,
    color: s.color,
    label: s.label,
  }));

  const prev = addMonths(y, m, -1);
  const next = addMonths(y, m, 1);
  const yearOptions = getYearOptions(new Date().getUTCFullYear());
  const rowOrderLabelByMode: Record<RowOrderMode, string> = {
    team: "Equipe",
    template: "N° trame",
    alpha: "Ordre alphabetique",
  };
  const templateShiftByNumberAndOffset: Record<string, string> = {};
  const cycleWeeksByTemplateNumber = new Map<number, number>();
  for (const template of templates) {
    cycleWeeksByTemplateNumber.set(template.number, normalizeTemplateCycleWeeks(template.cycleWeeks));
    for (const entry of template.entries) {
      if (!entry.shiftTypeId) continue;
      templateShiftByNumberAndOffset[`${template.number}|${entry.dayOffset}`] = entry.shiftTypeId;
    }
  }

  const templateShiftByUserAndDate: Record<string, string> = {};
  for (const mem of sortedMembers) {
    const u = mem.user;
    const cfg = planningConfigFromUserOrTeam(u, mem);
    const timing = alternanceTimingFromUser(u);
    for (const day of days) {
      const date = new Date(Date.UTC(y, m - 1, day.dayNum, 12, 0, 0));
      const effectiveTemplateNumber = getEffectivePlanningConfigForUserTeam(timing, cfg, date).templateNumber;
      if (!effectiveTemplateNumber) continue;
      const cycleW = cycleWeeksByTemplateNumber.get(effectiveTemplateNumber) ?? DEFAULT_TEMPLATE_CYCLE_WEEKS;
      const offset = getTemplateDayOffsetForCycle(date, cycleW);
      const shiftTypeId = templateShiftByNumberAndOffset[`${effectiveTemplateNumber}|${offset}`];
      if (shiftTypeId) templateShiftByUserAndDate[`${u.id}|${day.key}`] = shiftTypeId;
    }
  }

  const weekStartsInMonth: Date[] = [];
  {
    const seen = new Set<number>();
    for (let d = 1; d <= lastDay; d++) {
      const ws = startOfIsoWeekMondayUtc(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
      if (!seen.has(ws.getTime())) {
        seen.add(ws.getTime());
        weekStartsInMonth.push(ws);
      }
    }
  }

  const planningWeeks = await prisma.planningWeek.findMany({
    where: { teamId: team.id, weekStart: { in: weekStartsInMonth } },
  });

  const allValidated = weekStartsInMonth.length > 0 && weekStartsInMonth.every((ws) => {
    const pw = planningWeeks.find((w) => w.weekStart.getTime() === ws.getTime());
    return pw?.status === PlanningStatus.VALIDATED;
  });

  const rollingHoursViolations = canEditPlanningAndStaff(viewer?.role)
    ? await findRolling7DayHoursViolations({
        teamMemberUserIds: memberUserIds,
        monthRangeStart: rangeStart,
        monthRangeEnd: rangeEnd,
      })
    : [];

  const adminPlanningPath = adminTeamPath(team.slug, "planning");

  return (
    <main className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 flex-1 px-3 py-4 sm:px-4 md:px-6 md:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl md:text-2xl">Planning mensuel </h1>
          <p className="text-sm text-zinc-600">
            Version de travail
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${adminPlanningPath}?year=${prev.y}&month=${prev.m}&rowOrder=${rowOrder}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Mois précédent
          </Link>
          <Link
            href={`${adminPlanningPath}?year=${next.y}&month=${next.m}&rowOrder=${rowOrder}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Mois suivant
          </Link>
          <Link
            href={workspacePath(team.slug, "planning-equipe")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Planning équipe
          </Link>
          <form action={adminPlanningPath} method="get" className="ml-1 flex flex-wrap items-center gap-1.5">
            <select
              name="month"
              defaultValue={String(m)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700"
            >
              {MONTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              name="year"
              defaultValue={String(y)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700"
            >
              {yearOptions.map((yy) => (
                <option key={yy} value={yy}>
                  {yy}
                </option>
              ))}
            </select>
            <select
              name="rowOrder"
              defaultValue={rowOrder}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700"
            >
              <option value="team">Equipe</option>
              <option value="template">N° trame</option>
              <option value="alpha">Ordre alphabetique</option>
            </select>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Aller
            </button>
          </form>
          {allValidated ? (
            <div className="ml-1 flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2 py-1">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Valide</span>
              <form action={unvalidatePlanningMonth}>
                <input type="hidden" name="teamSlug" value={team.slug} />
                <input type="hidden" name="year" value={y} />
                <input type="hidden" name="month" value={m} />
                <button
                  type="submit"
                  className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  title="Repasser ce mois en brouillon"
                >
                  Brouillon
                </button>
              </form>
            </div>
          ) : (
            <div className="ml-1 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Brouillon</span>
              <form action={validatePlanningMonth}>
                <input type="hidden" name="teamSlug" value={team.slug} />
                <input type="hidden" name="year" value={y} />
                <input type="hidden" name="month" value={m} />
                <button
                  type="submit"
                  className="rounded-md border border-green-300 bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
                  title="Valider et publier le planning de ce mois aux agents"
                >
                  Valider & publier
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      <p className="mb-3 text-xs font-medium text-zinc-600">Tri des lignes: {rowOrderLabelByMode[rowOrder]}</p>

      {rollingHoursViolations.length > 0 ? (
        <div
          className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm"
          role="alert"
        >
          <p className="font-semibold text-rose-900">Dépassement de 48 h sur 7 jours glissants</p>
          <p className="mt-1 text-xs text-rose-800">
            Astreintes comptées sur une fenêtre de 7 jours civils consécutifs ; codes CA, CF, CH et RTT exclus (comme sur
            la page Droits). Toutes les équipes sont prises en compte pour chaque agent.
          </p>
          <ul className="mt-3 space-y-2">
            {rollingHoursViolations.map((v) => (
              <li key={v.userId} className="rounded-md border border-rose-200 bg-white/80 px-3 py-2">
                <span className="font-medium text-rose-950">
                  {v.lastName.toUpperCase()} {v.firstName}
                </span>
                <span className="text-rose-800">
                  {" "}
                  — jusqu&apos;à <strong>{v.maxHours} h</strong> sur une fenêtre commençant le{" "}
                  <strong>
                    {format(new Date(`${v.worstWindowStart}T12:00:00.000Z`), "dd/MM/yyyy", { locale: fr })}
                  </strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <PlanningMonthGrid
        teamSlug={team.slug}
        monthLabel={monthLabel}
        days={days}
        groups={groups}
        shifts={shiftOptions}
        cellShiftByKey={cellShiftByKey}
        templateShiftByUserAndDate={templateShiftByUserAndDate}
        commentsByKey={commentsByKey}
      />
    </main>
  );
}
