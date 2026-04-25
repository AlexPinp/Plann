import Link from "next/link";
import { Fragment } from "react";
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
import { getTeamBySlug } from "@/lib/team";
import { workspacePath } from "@/lib/routes";
import { PlanningStatus } from "@/generated/prisma/enums";
import { getSessionPrismaUser } from "@/lib/current-user";
import { canEditPlanningAndStaff } from "@/lib/user-roles";
import {
  canViewPlanningComment,
  planningCommentStatusLabel,
  planningCommentTypeBadge,
  planningCommentTypeLabel,
  planningCommentVisibilityLabel,
  type PlanningCommentStatus,
  type PlanningCommentType,
  type PlanningCommentVisibility,
} from "@/lib/planning-comments";

const DOW_SHORT = ["D", "L", "M", "M", "J", "V", "S"];
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

function navMonth(y: number, m: number, delta: number) {
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function getYearOptions(centerYear: number): number[] {
  return Array.from({ length: 13 }, (_, i) => centerYear - 6 + i);
}

type Props = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPlanningPage({ params, searchParams }: Props) {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const sp = await searchParams;
  const { y, m } = parseMonth(sp);
  const currentUser = await getSessionPrismaUser();
  const isStaff = canEditPlanningAndStaff(currentUser?.role);

  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rangeStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999));

  const days = Array.from({ length: lastDay }, (_, i) => {
    const dayNum = i + 1;
    const dt = new Date(Date.UTC(y, m - 1, dayNum, 12, 0, 0));
    const key = `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const dow = DOW_SHORT[dt.getUTCDay()];
    const isWeekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
    return { key, dayNum, dow, isWeekend };
  });

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

  const members = await prisma.userTeam.findMany({
    where: { teamId: team.id, user: { active: true } },
    include: { user: true },
    orderBy: [{ planningGroupLabel: "asc" }, { displayOrder: "asc" }, { user: { lastName: "asc" } }],
  });

  const memberUserIds = members.map((m) => m.userId);

  const [assignments, shifts, planningWeeks, comments] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
        userId: { not: null },
        planningWeek: { teamId: team.id },
      },
      include: { shiftType: true },
    }),
    prisma.shiftType.findMany({ orderBy: { code: "asc" } }),
    prisma.planningWeek.findMany({
      where: { teamId: team.id, weekStart: { in: weekStartsInMonth } },
    }),
    prisma.planningComment.findMany({
      where: {
        userId: { in: memberUserIds },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const validatedWeekStarts = new Set(
    planningWeeks
      .filter((w) => w.status === PlanningStatus.VALIDATED)
      .map((w) => w.weekStart.getTime()),
  );

  const allValidated = weekStartsInMonth.length > 0 && weekStartsInMonth.every(
    (ws) => validatedWeekStarts.has(ws.getTime()),
  );

  const latestValidation = planningWeeks
    .filter((w) => w.status === PlanningStatus.VALIDATED && w.validatedAt)
    .sort((a, b) => (b.validatedAt?.getTime() ?? 0) - (a.validatedAt?.getTime() ?? 0))[0];

  const isDayValidated = (dayNum: number): boolean => {
    const ws = startOfIsoWeekMondayUtc(new Date(Date.UTC(y, m - 1, dayNum, 12, 0, 0)));
    return validatedWeekStarts.has(ws.getTime());
  };

  const usedTemplateNumbers = Array.from(
    new Set(
      members.flatMap((m) => {
        const cfg = planningConfigFromUserOrTeam(m.user, m);
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

  const cellMap: Record<string, typeof assignments[number]> = {};
  for (const a of assignments) {
    if (!a.userId) continue;
    const dk = format(a.date, "yyyy-MM-dd");
    cellMap[`${a.userId}|${dk}`] = a;
  }
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const commentsByKey = new Map<string, typeof comments>();
  for (const comment of comments) {
    const key = `${comment.userId}|${format(comment.date, "yyyy-MM-dd")}`;
    const list = commentsByKey.get(key) ?? [];
    list.push(comment);
    commentsByKey.set(key, list);
  }
  const templateShiftByNumberAndOffset: Record<string, string> = {};
  const cycleWeeksByTemplateNumber = new Map<number, number>();
  for (const template of templates) {
    cycleWeeksByTemplateNumber.set(template.number, normalizeTemplateCycleWeeks(template.cycleWeeks));
    for (const entry of template.entries) {
      if (!entry.shiftTypeId) continue;
      templateShiftByNumberAndOffset[`${template.number}|${entry.dayOffset}`] = entry.shiftTypeId;
    }
  }

  const anchorMonth = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  const groupsMap = new Map<string, { label: string; color: string; users: (typeof members)[number]["user"][] }>();
  for (const m of members) {
    const u = m.user;
    const cfg = planningConfigFromUserOrTeam(u, m);
    const effectiveConfig = getEffectivePlanningConfigForUserTeam(alternanceTimingFromUser(u), cfg, anchorMonth);
    const label = effectiveConfig.groupLabel ?? "Sans groupe";
    const color = effectiveConfig.groupColor ?? "#f4f4f5";
    if (!groupsMap.has(label)) groupsMap.set(label, { label, color, users: [] });
    groupsMap.get(label)!.users.push(u);
  }
  const groups = Array.from(groupsMap.values());

  const monthLabel = format(new Date(Date.UTC(y, m - 1, 1)), "MMMM yyyy", { locale: fr });
  const prev = navMonth(y, m, -1);
  const next = navMonth(y, m, 1);
  const yearOptions = getYearOptions(new Date().getUTCFullYear());
  const equipePath = workspacePath(team.slug, "planning-equipe");

  return (
    <main className="mx-auto w-full max-w-[98vw] flex-1 p-3 sm:p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Planning equipe</h1>
          {allValidated ? (
            <p className="flex items-center gap-1.5 text-sm text-green-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
              Validé le{" "}
              {latestValidation?.validatedAt
                ? format(latestValidation.validatedAt, "dd/MM/yyyy 'à' HH:mm", { locale: fr })
                : "—"}{" "}
              par <strong className="ml-0.5">{latestValidation?.validatedByName ?? "—"}</strong>
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-amber-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              Prévisionnel &mdash; planning basé sur les trames, en attente de validation
            </p>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Link
            href={`${equipePath}?year=${prev.y}&month=${prev.m}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            &larr;
          </Link>
          <span className="min-w-[140px] text-center text-sm font-semibold capitalize text-zinc-800">
            {monthLabel}
          </span>
          <Link
            href={`${equipePath}?year=${next.y}&month=${next.m}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            &rarr;
          </Link>
          <form action={equipePath} method="get" className="ml-1 flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
            <select
              name="month"
              defaultValue={String(m)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 sm:w-auto"
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
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 sm:w-auto"
            >
              {yearOptions.map((yy) => (
                <option key={yy} value={yy}>
                  {yy}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto"
            >
              Aller
            </button>
          </form>
        </div>
      </div>

      <div className="max-h-[85vh] overflow-auto rounded-lg border border-zinc-300 bg-white shadow-sm">
        <table className="min-w-max border-collapse text-[11px]">
          <thead>
            <tr className="bg-zinc-100">
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-40 min-w-[140px] border border-zinc-300 bg-zinc-100 px-2 py-1 text-left font-semibold text-zinc-800"
              >
                Agent
              </th>
              {days.map((d) => (
                <th
                  key={`dow-${d.key}`}
                  className={[
                    "sticky top-0 z-30 min-w-[34px] border border-zinc-300 px-0.5 py-1 text-center font-semibold",
                    d.isWeekend ? "bg-zinc-200 text-zinc-500" : "bg-zinc-100 text-zinc-700",
                  ].join(" ")}
                >
                  {d.dow}
                </th>
              ))}
            </tr>
            <tr className="bg-zinc-50">
              {days.map((d) => (
                <th
                  key={`num-${d.key}`}
                  className={[
                    "sticky top-[28px] z-30 border border-zinc-300 px-0.5 py-1 text-center font-medium",
                    d.isWeekend ? "bg-zinc-200 text-zinc-500" : "bg-zinc-50 text-zinc-800",
                  ].join(" ")}
                >
                  {d.dayNum}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={`group-${group.label}`}>
                <tr key={`g-${group.label}`} className="bg-zinc-200">
                  <td
                    colSpan={days.length + 1}
                    className="sticky left-0 z-20 border border-zinc-300 px-2 py-1 font-semibold text-zinc-800"
                    style={{ backgroundColor: group.color }}
                  >
                    {group.label}
                  </td>
                </tr>
                {group.users.map((u) => {
                  const membership = members.find((mem) => mem.userId === u.id) ?? null;
                  const cfgU = planningConfigFromUserOrTeam(u, membership);
                  const timingU = alternanceTimingFromUser(u);
                  return (
                  <tr key={u.id} className="hover:bg-zinc-50/80">
                    <td
                      className="sticky left-0 z-20 whitespace-nowrap border border-zinc-200 px-2 py-0.5 font-medium text-zinc-900"
                      style={{ backgroundColor: group.color }}
                    >
                      {u.lastName.toUpperCase()} {u.firstName}
                    </td>
                    {days.map((d) => {
                      const dayValidated = isDayValidated(d.dayNum);
                      const cell = cellMap[`${u.id}|${d.key}`];
                      const currentDate = new Date(Date.UTC(y, m - 1, d.dayNum, 12, 0, 0));
                      const effectiveTemplateNumber = getEffectivePlanningConfigForUserTeam(
                        timingU,
                        cfgU,
                        currentDate,
                      ).templateNumber;
                      const cycleW = effectiveTemplateNumber
                        ? cycleWeeksByTemplateNumber.get(effectiveTemplateNumber) ?? DEFAULT_TEMPLATE_CYCLE_WEEKS
                        : 6;
                      const dayOffset = getTemplateDayOffsetForCycle(currentDate, cycleW);
                      const templateShiftId = effectiveTemplateNumber
                        ? templateShiftByNumberAndOffset[`${effectiveTemplateNumber}|${dayOffset}`]
                        : undefined;
                      const templateShift = templateShiftId ? shiftById.get(templateShiftId) : undefined;

                      let effectiveShift: typeof templateShift;
                      if (isStaff || dayValidated) {
                        effectiveShift = cell?.shiftType ?? templateShift;
                      } else {
                        effectiveShift = templateShift;
                      }
                      const visibleComments = (commentsByKey.get(`${u.id}|${d.key}`) ?? []).filter((comment) =>
                        canViewPlanningComment(comment.visibility as PlanningCommentVisibility, {
                          isStaff,
                          viewerUserId: currentUser?.id ?? null,
                          commentUserId: comment.userId,
                        }),
                      );
                      const firstCommentType = visibleComments[0]?.type as PlanningCommentType | undefined;
                      const commentsTitle = visibleComments
                        .map((comment) =>
                          `${planningCommentTypeLabel(comment.type as PlanningCommentType)} - ${planningCommentStatusLabel(comment.status as PlanningCommentStatus)} - ${planningCommentVisibilityLabel(comment.visibility as PlanningCommentVisibility)}: ${comment.text}`,
                        )
                        .join("\n");

                      return (
                        <td
                          key={`${u.id}-${d.key}`}
                          className={[
                            "border border-zinc-200 px-0.5 py-0.5 text-center font-bold text-zinc-900",
                            d.isWeekend && !effectiveShift ? "bg-zinc-100" : "",
                            !dayValidated && !isStaff ? "opacity-70" : "",
                          ].join(" ")}
                          style={effectiveShift ? { backgroundColor: effectiveShift.color } : undefined}
                          title={
                            [
                              effectiveShift ? `${effectiveShift.label} (${effectiveShift.startsAt}–${effectiveShift.endsAt})` : "",
                              commentsTitle,
                            ]
                              .filter(Boolean)
                              .join("\n")
                          }
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{effectiveShift ? effectiveShift.code : ""}</span>
                            {visibleComments.length > 0 ? (
                              <span className="inline-flex items-center rounded border border-sky-300 bg-sky-100 px-1 text-[9px] font-semibold text-sky-700">
                                {firstCommentType ? planningCommentTypeBadge(firstCommentType) : "CM"}
                                {visibleComments.length > 1 ? `+${visibleComments.length - 1}` : ""}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
