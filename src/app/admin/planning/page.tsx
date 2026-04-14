import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTemplateDayOffsetFromDate } from "@/lib/planning-template";
import { startOfIsoWeekMondayUtc } from "@/lib/planning-week";
import { getEffectivePlanningConfigForDate } from "@/lib/planning-alternance";
import { prisma } from "@/lib/prisma";
import { PlanningStatus } from "@/generated/prisma/enums";
import { requirePlanningAndStaffAccess } from "@/lib/user-roles";
import { PlanningMonthGrid } from "@/app/(workspace)/planning/admin/PlanningMonthGrid";
import { validatePlanningMonth, unvalidatePlanningMonth } from "@/app/(workspace)/planning/admin/actions";

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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanningAdminPage({ searchParams }: SearchProps) {
  await requirePlanningAndStaffAccess();
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

  const [users, assignments, shifts, comments] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.assignment.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
        userId: { not: null },
      },
      include: { shiftType: true },
    }),
    prisma.shiftType.findMany({ orderBy: { code: "asc" } }),
    prisma.planningComment.findMany({
      where: {
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

  const usedTemplateNumbers = Array.from(new Set(
    users.flatMap((u) => [
      u.planningTemplateNumber,
      u.planningTemplateNumberA,
      u.planningTemplateNumberB,
    ]).filter((n): n is number => n !== null),
  ));
  const templates = usedTemplateNumbers.length
    ? await prisma.planningTemplate.findMany({
        where: { number: { in: usedTemplateNumbers } },
        include: { entries: { where: { shiftTypeId: { not: null } } } },
      })
    : [];

  const byDisplayName = (a: (typeof users)[number], b: (typeof users)[number]) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr", {
      sensitivity: "base",
    });

  const sortedUsers = [...users].sort((a, b) => {
    if (rowOrder === "template") {
      const aTemplate = getEffectivePlanningConfigForDate(a, new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))).templateNumber ?? Number.POSITIVE_INFINITY;
      const bTemplate = getEffectivePlanningConfigForDate(b, new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))).templateNumber ?? Number.POSITIVE_INFINITY;
      if (aTemplate !== bTemplate) return aTemplate - bTemplate;
      return byDisplayName(a, b);
    }
    if (rowOrder === "alpha") {
      return byDisplayName(a, b);
    }
    const effectiveGroupA = getEffectivePlanningConfigForDate(a, new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))).groupLabel ?? "Sans groupe";
    const effectiveGroupB = getEffectivePlanningConfigForDate(b, new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))).groupLabel ?? "Sans groupe";
    const groupA = effectiveGroupA.localeCompare(effectiveGroupB, "fr", {
      sensitivity: "base",
    });
    if (groupA !== 0) return groupA;
    const displayA = a.displayOrder ?? Number.POSITIVE_INFINITY;
    const displayB = b.displayOrder ?? Number.POSITIVE_INFINITY;
    if (displayA !== displayB) return displayA - displayB;
    return byDisplayName(a, b);
  });

  const groupsMap = new Map<string, { label: string; color: string; users: { id: string; displayName: string }[] }>();
  for (const u of sortedUsers) {
    const effectiveConfig = getEffectivePlanningConfigForDate(u, new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)));
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
  for (const template of templates) {
    for (const entry of template.entries) {
      if (!entry.shiftTypeId) continue;
      templateShiftByNumberAndOffset[`${template.number}|${entry.dayOffset}`] = entry.shiftTypeId;
    }
  }

  const templateShiftByUserAndDate: Record<string, string> = {};
  for (const u of users) {
    for (const day of days) {
      const date = new Date(Date.UTC(y, m - 1, day.dayNum, 12, 0, 0));
      const effectiveTemplateNumber = getEffectivePlanningConfigForDate(u, date).templateNumber;
      if (!effectiveTemplateNumber) continue;
      const offset = getTemplateDayOffsetFromDate(new Date(Date.UTC(y, m - 1, day.dayNum, 12, 0, 0)));
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
    where: { weekStart: { in: weekStartsInMonth } },
  });

  const allValidated = weekStartsInMonth.length > 0 && weekStartsInMonth.every((ws) => {
    const pw = planningWeeks.find((w) => w.weekStart.getTime() === ws.getTime());
    return pw?.status === PlanningStatus.VALIDATED;
  });

  const latestValidation = planningWeeks
    .filter((w) => w.status === PlanningStatus.VALIDATED && w.validatedAt)
    .sort((a, b) => (b.validatedAt?.getTime() ?? 0) - (a.validatedAt?.getTime() ?? 0))[0];

  return (
    <main className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 flex-1 px-4 py-4 md:px-6 md:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 md:text-2xl">Planning mensuel — vue administrateur</h1>
          <p className="text-sm text-zinc-600">
            Version de travail — non visible pour les agents tant que non validé.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/planning?year=${prev.y}&month=${prev.m}&rowOrder=${rowOrder}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Mois précédent
          </Link>
          <Link
            href={`/admin/planning?year=${next.y}&month=${next.m}&rowOrder=${rowOrder}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Mois suivant
          </Link>
          <Link href="/" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
            Planning équipe
          </Link>
          <form action="/admin/planning" method="get" className="ml-1 flex items-center gap-1.5">
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
            <select
              name="rowOrder"
              defaultValue={rowOrder}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700"
            >
              <option value="team">Equipe</option>
              <option value="template">N° trame</option>
              <option value="alpha">Ordre alphabetique</option>
            </select>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Aller
            </button>
          </form>
        </div>
      </div>
      <p className="mb-3 text-xs font-medium text-zinc-600">Tri des lignes: {rowOrderLabelByMode[rowOrder]}</p>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border p-3"
        style={{
          borderColor: allValidated ? "#86efac" : "#fde68a",
          backgroundColor: allValidated ? "#f0fdf4" : "#fffbeb",
        }}
      >
        {allValidated ? (
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
              Validé
            </span>
            <span className="text-sm text-green-700">
              le {latestValidation?.validatedAt
                ? format(latestValidation.validatedAt, "dd/MM/yyyy 'à' HH:mm", { locale: fr })
                : "—"}{" "}
              par <strong>{latestValidation?.validatedByName ?? "—"}</strong>
            </span>
            <form action={unvalidatePlanningMonth} className="ml-auto">
              <input type="hidden" name="year" value={y} />
              <input type="hidden" name="month" value={m} />
              <button
                type="submit"
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                Repasser en brouillon
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              Brouillon
            </span>
            <span className="text-sm text-amber-700">
              Ce planning n&apos;est pas encore visible par les agents. Ils voient uniquement leur trame (prévisionnel).
            </span>
            <form action={validatePlanningMonth} className="ml-auto">
              <input type="hidden" name="year" value={y} />
              <input type="hidden" name="month" value={m} />
              <button
                type="submit"
                className="rounded-lg border border-green-300 bg-green-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
              >
                Valider et publier aux agents
              </button>
            </form>
          </div>
        )}
      </div>

      <PlanningMonthGrid
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
