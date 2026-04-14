import Link from "next/link";
import { Fragment } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTemplateDayOffsetFromDate } from "@/lib/planning-template";
import { startOfIsoWeekMondayUtc } from "@/lib/planning-week";
import { getEffectivePlanningConfigForDate } from "@/lib/planning-alternance";
import { prisma } from "@/lib/prisma";
import { PlanningStatus } from "@/generated/prisma/enums";
import { getSessionPrismaUser } from "@/lib/current-user";
import { canEditPlanningAndStaff } from "@/lib/user-roles";
import {
  PLANNING_COMMENT_TYPES,
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

function parseCommentTypeFilter(
  sp: Record<string, string | string[] | undefined>,
): PlanningCommentType | "ALL" {
  const raw = typeof sp.commentType === "string" ? sp.commentType.trim() : "";
  if (!raw) return "ALL";
  return PLANNING_COMMENT_TYPES.includes(raw as PlanningCommentType)
    ? (raw as PlanningCommentType)
    : "ALL";
}

function navMonth(y: number, m: number, delta: number) {
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function getYearOptions(centerYear: number): number[] {
  return Array.from({ length: 13 }, (_, i) => centerYear - 6 + i);
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPlanningPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { y, m } = parseMonth(sp);
  const commentTypeFilter = parseCommentTypeFilter(sp);
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

  const [users, assignments, shifts, planningWeeks, comments] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      orderBy: [{ planningGroupLabel: "asc" }, { displayOrder: "asc" }, { lastName: "asc" }],
    }),
    prisma.assignment.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd }, userId: { not: null } },
      include: { shiftType: true },
    }),
    prisma.shiftType.findMany({ orderBy: { code: "asc" } }),
    prisma.planningWeek.findMany({
      where: { weekStart: { in: weekStartsInMonth } },
    }),
    prisma.planningComment.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
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
      users
        .flatMap((u) => [u.planningTemplateNumber, u.planningTemplateNumberA, u.planningTemplateNumberB])
        .filter((n): n is number => n !== null),
    ),
  );
  const templates = usedTemplateNumbers.length
    ? await prisma.planningTemplate.findMany({
        where: { number: { in: usedTemplateNumbers } },
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
  for (const template of templates) {
    for (const entry of template.entries) {
      if (!entry.shiftTypeId) continue;
      templateShiftByNumberAndOffset[`${template.number}|${entry.dayOffset}`] = entry.shiftTypeId;
    }
  }

  const groupsMap = new Map<string, { label: string; color: string; users: typeof users }>();
  for (const u of users) {
    const effectiveConfig = getEffectivePlanningConfigForDate(u, new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)));
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

  return (
    <main className="mx-auto w-full max-w-[98vw] flex-1 p-4 md:p-6">
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
        <div className="flex items-center gap-2">
          <Link
            href={`/planning-equipe?year=${prev.y}&month=${prev.m}${commentTypeFilter !== "ALL" ? `&commentType=${commentTypeFilter}` : ""}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            &larr;
          </Link>
          <span className="min-w-[140px] text-center text-sm font-semibold capitalize text-zinc-800">
            {monthLabel}
          </span>
          <Link
            href={`/planning-equipe?year=${next.y}&month=${next.m}${commentTypeFilter !== "ALL" ? `&commentType=${commentTypeFilter}` : ""}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            &rarr;
          </Link>
          <form action="/planning-equipe" method="get" className="ml-1 flex items-center gap-1.5">
            <select
              name="month"
              defaultValue={String(m)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700"
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
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700"
            >
              {yearOptions.map((yy) => (
                <option key={yy} value={yy}>
                  {yy}
                </option>
              ))}
            </select>
            {commentTypeFilter !== "ALL" ? (
              <input type="hidden" name="commentType" value={commentTypeFilter} />
            ) : null}
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Aller
            </button>
          </form>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-500">Filtre commentaires :</span>
        <Link
          href={`/planning-equipe?year=${y}&month=${m}`}
          className={[
            "rounded border px-2 py-1 text-xs font-medium",
            commentTypeFilter === "ALL"
              ? "border-sky-300 bg-sky-100 text-sky-700"
              : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50",
          ].join(" ")}
        >
          Tous
        </Link>
        {PLANNING_COMMENT_TYPES.map((type) => (
          <Link
            key={type}
            href={`/planning-equipe?year=${y}&month=${m}&commentType=${type}`}
            className={[
              "rounded border px-2 py-1 text-xs font-medium",
              commentTypeFilter === type
                ? "border-sky-300 bg-sky-100 text-sky-700"
                : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50",
            ].join(" ")}
          >
            {planningCommentTypeLabel(type)}
          </Link>
        ))}
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
                {group.users.map((u) => (
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
                      const effectiveTemplateNumber = getEffectivePlanningConfigForDate(u, currentDate).templateNumber;
                      const templateShiftId = effectiveTemplateNumber
                        ? templateShiftByNumberAndOffset[
                            `${effectiveTemplateNumber}|${getTemplateDayOffsetFromDate(currentDate)}`
                          ]
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
                      ).filter((comment) =>
                        commentTypeFilter === "ALL" ? true : comment.type === commentTypeFilter,
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
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {shifts.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded border border-zinc-300 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-900 shadow-sm"
            style={{ backgroundColor: s.color }}
            title={s.label}
          >
            {s.code}
          </span>
        ))}
      </div>
    </main>
  );
}
