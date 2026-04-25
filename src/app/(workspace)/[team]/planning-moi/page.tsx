import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSessionPrismaUser } from "@/lib/current-user";
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

function addMonths(y: number, m: number, delta: number) {
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

export default async function MyPlanningPage({ params, searchParams }: Props) {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const me = await getSessionPrismaUser();

  if (!me) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6 md:p-10">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Profil agent introuvable pour cette session. Reconnectez-vous ou contactez votre cadre.
        </p>
      </main>
    );
  }

  const sp = await searchParams;
  const { y, m } = parseMonth(sp);

  const myTeamRow = await prisma.userTeam.findUnique({
    where: { userId_teamId: { userId: me.id, teamId: team.id } },
  });

  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

  const rangeStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999));

  const isStaff = canEditPlanningAndStaff(me.role);

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

  const cfg = planningConfigFromUserOrTeam(me, myTeamRow);
  const myTemplateNumbers = Array.from(
    new Set(
      [cfg.planningTemplateNumber, cfg.planningTemplateNumberA, cfg.planningTemplateNumberB].filter(
        (n): n is number => typeof n === "number",
      ),
    ),
  );

  const timing = alternanceTimingFromUser(me);

  const [assignments, shifts, myTemplates, planningWeeks, comments] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        userId: me.id,
        date: { gte: rangeStart, lte: rangeEnd },
        planningWeek: { teamId: team.id },
      },
      include: { shiftType: true },
      orderBy: { date: "asc" },
    }),
    prisma.shiftType.findMany({ orderBy: { code: "asc" } }),
    myTemplateNumbers.length
      ? prisma.planningTemplate.findMany({
          where: { teamId: team.id, number: { in: myTemplateNumbers } },
          include: { entries: { where: { shiftTypeId: { not: null } } } },
        })
      : Promise.resolve([]),
    prisma.planningWeek.findMany({
      where: { teamId: team.id, weekStart: { in: weekStartsInMonth } },
    }),
    prisma.planningComment.findMany({
      where: {
        userId: me.id,
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

  const byDate = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const key = format(a.date, "yyyy-MM-dd");
    const list = byDate.get(key) ?? [];
    list.push(a);
    byDate.set(key, list);
  }
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const commentsByDate = new Map<string, typeof comments>();
  for (const comment of comments) {
    const key = format(comment.date, "yyyy-MM-dd");
    const list = commentsByDate.get(key) ?? [];
    list.push(comment);
    commentsByDate.set(key, list);
  }
  const templateShiftByNumberAndOffset = new Map<string, string>();
  const cycleWeeksByTemplateNumber = new Map<number, number>();
  for (const template of myTemplates) {
    cycleWeeksByTemplateNumber.set(template.number, normalizeTemplateCycleWeeks(template.cycleWeeks));
    for (const entry of template.entries) {
      if (entry.shiftTypeId) templateShiftByNumberAndOffset.set(`${template.number}|${entry.dayOffset}`, entry.shiftTypeId);
    }
  }
  const monthLabel = format(new Date(Date.UTC(y, m - 1, 1)), "MMMM yyyy", { locale: fr });
  const prev = addMonths(y, m, -1);
  const next = addMonths(y, m, 1);
  const yearOptions = getYearOptions(new Date().getUTCFullYear());
  const moiPath = workspacePath(team.slug, "planning-moi");

  const today = new Date();
  const todayKey =
    today.getUTCFullYear() === y && today.getUTCMonth() + 1 === m
      ? `${y}-${String(m).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`
      : null;

  const blanks = firstDow === 0 ? 6 : firstDow - 1;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Mon planning</h1>
          <p className="text-sm text-zinc-600">
            {me.lastName.toUpperCase()} {me.firstName} &mdash;{" "}
            <span className="capitalize">{monthLabel}</span>
          </p>
          {allValidated ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-green-700">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
              Validé le{" "}
              {latestValidation?.validatedAt
                ? format(latestValidation.validatedAt, "dd/MM/yyyy 'à' HH:mm", { locale: fr })
                : "—"}{" "}
              par <strong className="ml-0.5">{latestValidation?.validatedByName ?? "—"}</strong>
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              Prévisionnel — basé sur votre trame, en attente de validation
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`${moiPath}?year=${prev.y}&month=${prev.m}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            &larr;
          </Link>
          <span className="min-w-[130px] text-center text-sm font-semibold capitalize text-zinc-800">
            {monthLabel}
          </span>
          <Link
            href={`${moiPath}?year=${next.y}&month=${next.m}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            &rarr;
          </Link>
          <form action={moiPath} method="get" className="ml-1 flex flex-wrap items-center gap-1.5">
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
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Aller
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <div key={i} className="px-1 py-2 text-center text-xs font-semibold text-zinc-500">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: blanks }).map((_, i) => (
            <div key={`blank-${i}`} className="border-b border-r border-zinc-100 bg-zinc-50/50 p-1" style={{ minHeight: 72 }} />
          ))}

          {Array.from({ length: lastDay }, (_, i) => {
            const dayNum = i + 1;
            const dt = new Date(Date.UTC(y, m - 1, dayNum));
            const key = `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const dow = dt.getUTCDay();
            const isWeekend = dow === 0 || dow === 6;
            const isToday = key === todayKey;
            const dayValidated = isDayValidated(dayNum);
            const dayAssignments = byDate.get(key) ?? [];
            const date = new Date(Date.UTC(y, m - 1, dayNum, 12, 0, 0));
            const effectiveTemplateNumber = getEffectivePlanningConfigForUserTeam(
              timing,
              cfg,
              date,
            ).templateNumber;
            const cycleW = effectiveTemplateNumber
              ? cycleWeeksByTemplateNumber.get(effectiveTemplateNumber) ?? DEFAULT_TEMPLATE_CYCLE_WEEKS
              : 6;
            const offset = getTemplateDayOffsetForCycle(date, cycleW);
            const templateShiftId = effectiveTemplateNumber
              ? templateShiftByNumberAndOffset.get(`${effectiveTemplateNumber}|${offset}`)
              : undefined;
            const templateShift = templateShiftId ? shiftById.get(templateShiftId) : undefined;

            let displayAssignments: { id: string; shiftType: NonNullable<typeof templateShift> }[];
            if (isStaff || dayValidated) {
              displayAssignments =
                dayAssignments.length > 0
                  ? dayAssignments
                  : templateShift
                    ? [{ id: `tpl-${key}`, shiftType: templateShift }]
                    : [];
            } else {
              displayAssignments = templateShift
                ? [{ id: `tpl-${key}`, shiftType: templateShift }]
                : [];
            }
            const visibleComments = (commentsByDate.get(key) ?? []).filter((comment) =>
              canViewPlanningComment(comment.visibility as PlanningCommentVisibility, {
                isStaff,
                viewerUserId: me.id,
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
              <div
                key={key}
                className={[
                  "border-b border-r border-zinc-100 p-1",
                  isWeekend ? "bg-zinc-50/80" : "bg-white",
                  isToday ? "ring-2 ring-inset ring-blue-400" : "",
                  !dayValidated && !isStaff ? "opacity-70" : "",
                ].join(" ")}
                style={{ minHeight: 72 }}
              >
                <div className={[
                  "mb-0.5 text-right text-[11px] font-medium",
                  isToday ? "text-blue-600" : "text-zinc-400",
                ].join(" ")}>
                  {dayNum}
                </div>
                <div className="flex flex-col gap-0.5">
                  {displayAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="rounded px-1 py-0.5 text-center text-[10px] font-bold leading-tight text-zinc-900"
                      style={{ backgroundColor: a.shiftType.color }}
                      title={[
                        `${a.shiftType.label} (${a.shiftType.startsAt}–${a.shiftType.endsAt})`,
                        commentsTitle,
                      ]
                        .filter(Boolean)
                        .join("\n")}
                    >
                      {a.shiftType.code}
                    </div>
                  ))}
                  {visibleComments.length > 0 ? (
                    <div
                      className="inline-flex w-fit items-center rounded border border-sky-300 bg-sky-100 px-1 text-[10px] font-semibold text-sky-700"
                      title={commentsTitle}
                    >
                      {firstCommentType ? planningCommentTypeBadge(firstCommentType) : "CM"}
                      {visibleComments.length > 1 ? `+${visibleComments.length - 1}` : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
