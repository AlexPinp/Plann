import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { startOfIsoWeekMondayUtc } from "@/lib/planning-week";
import { prisma } from "@/lib/prisma";
import { getAllTeams, getTeamBySlug, requireTeamMembership } from "@/lib/team";
import { workspacePath } from "@/lib/routes";
import { PlanningStatus, TeamJob, TeamRhythm } from "@/generated/prisma/enums";

type Props = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

/** Jour calendaire UTC [00:00, 23:59:59.999] pour le même jour que `d` (quel que soit l’heure de `d`). */
function utcCalendarDayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

function formatUtcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseWeekStart(sp: Record<string, string | string[] | undefined>): Date {
  const raw = typeof sp.week === "string" ? sp.week.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const candidate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return startOfIsoWeekMondayUtc(candidate);
  }
  return startOfIsoWeekMondayUtc(new Date());
}

function shiftWeekUtc(monday: Date, deltaWeeks: number): Date {
  const d = new Date(monday);
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
  return startOfIsoWeekMondayUtc(d);
}

function compareRows(
  a: { rhythm: TeamRhythm; job: TeamJob; shiftCode: string },
  b: { rhythm: TeamRhythm; job: TeamJob; shiftCode: string },
): number {
  const rA = a.rhythm === TeamRhythm.JOUR ? 0 : 1;
  const rB = b.rhythm === TeamRhythm.JOUR ? 0 : 1;
  if (rA !== rB) return rA - rB;
  const jA = a.job === TeamJob.IDE ? 0 : 1;
  const jB = b.job === TeamJob.IDE ? 0 : 1;
  if (jA !== jB) return jA - jB;
  return a.shiftCode.localeCompare(b.shiftCode, "fr", { numeric: true });
}

function jobShort(j: TeamJob): string {
  return j === TeamJob.IDE ? "IDE" : "AS";
}

function postLabel(job: TeamJob, shiftCode: string): string {
  const code = shiftCode.trim() || "—";
  return `${jobShort(job)} ${code}`;
}

export default async function OrganisationWeekPage({ params, searchParams }: Props) {
  const { team: teamSlug } = await params;
  const teamCtx = await getTeamBySlug(teamSlug);
  if (!teamCtx) notFound();
  await requireTeamMembership(teamSlug);

  const sp = await searchParams;
  const weekStart = parseWeekStart(sp);
  const weekParam = formatUtcYmd(weekStart);

  const teams = await getAllTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const monday = weekStart;
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const rangeStart = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0, 0, 0));
  const rangeEnd = new Date(
    Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate(), 23, 59, 59, 999),
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const ymd = formatUtcYmd(d);
    const label = format(d, "EEE d MMM", { locale: fr });
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    return { d, ymd, label, isWeekend };
  });

  const teamIds = teams.map((t) => t.id);
  const { start: mondayDayStart, end: mondayDayEnd } = utcCalendarDayBounds(weekStart);

  /** Une ligne par équipe pour ce lundi (brouillon ou validé) — évite de n’charger qu’un sous-ensemble d’équipes. */
  const planningWeeks = await prisma.planningWeek.findMany({
    where: {
      teamId: { in: teamIds },
      weekStart: { gte: mondayDayStart, lte: mondayDayEnd },
    },
    select: { id: true, teamId: true, status: true },
  });

  const provisionalFromDraft = planningWeeks.some((w) => w.status === PlanningStatus.DRAFT);

  const teamIdByWeekId = new Map(planningWeeks.map((w) => [w.id, w.teamId]));
  const weekIds = planningWeeks.map((w) => w.id);

  const assignments =
    weekIds.length === 0
      ? []
      : await prisma.assignment.findMany({
          where: {
            planningWeekId: { in: weekIds },
            userId: { not: null },
            date: { gte: rangeStart, lte: rangeEnd },
          },
          include: { user: true, shiftType: true },
        });

  type RowKey = string;
  const rowMeta = new Map<
    RowKey,
    {
      rhythm: TeamRhythm;
      job: TeamJob;
      shiftTypeId: string;
      shiftCode: string;
    }
  >();

  const namesByRowDay = new Map<string, string[]>();

  for (const a of assignments) {
    const teamId = teamIdByWeekId.get(a.planningWeekId);
    if (!teamId || !a.user || !a.shiftType || !a.userId) continue;
    const team = teamById.get(teamId);
    if (!team) continue;

    const shiftCode = a.shiftType.code.trim() || a.shiftType.label;
    const rowKey: RowKey = [team.rhythm, team.job, a.shiftType.id].join("\x01");

    if (!rowMeta.has(rowKey)) {
      rowMeta.set(rowKey, {
        rhythm: team.rhythm,
        job: team.job,
        shiftTypeId: a.shiftType.id,
        shiftCode,
      });
    }

    const dk = formatUtcYmd(a.date);
    const cellKey = `${rowKey}|${dk}`;
    const name = `${a.user.lastName.toUpperCase()} ${a.user.firstName}`;
    const list = namesByRowDay.get(cellKey) ?? [];
    if (!list.includes(name)) list.push(name);
    namesByRowDay.set(cellKey, list);
  }

  const rows = Array.from(rowMeta.entries())
    .map(([key, meta]) => ({ key, ...meta }))
    .sort((a, b) => compareRows(a, b));

  const orgPath = workspacePath(teamCtx.slug, "organisation");
  const prevWeek = shiftWeekUtc(weekStart, -1);
  const nextWeek = shiftWeekUtc(weekStart, 1);
  const weekRangeLabel = `${format(monday, "d MMM", { locale: fr })} – ${format(sunday, "d MMM yyyy", { locale: fr })}`;

  return (
    <main className="mx-auto w-full max-w-[98vw] flex-1 p-3 sm:p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Organisation</h1>
          <p className="text-sm text-zinc-600">
            Lignes triées par rythme (jour / nuit) et poste — seul le poste est affiché.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Link
            href={`${orgPath}?week=${formatUtcYmd(prevWeek)}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            &larr; Semaine précédente
          </Link>
          <span className="min-w-[160px] text-center text-sm font-semibold capitalize text-zinc-800">
            {weekRangeLabel}
          </span>
          <Link
            href={`${orgPath}?week=${formatUtcYmd(nextWeek)}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Semaine suivante &rarr;
          </Link>
          <form action={orgPath} method="get" className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
            <label htmlFor="org-week" className="sr-only">
              Semaine (lundi)
            </label>
            <input
              id="org-week"
              type="date"
              name="week"
              defaultValue={weekParam}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 sm:w-auto"
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto"
            >
              Afficher
            </button>
          </form>
        </div>
      </div>

      {provisionalFromDraft ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Au moins une équipe est encore en brouillon pour cette semaine — les noms affichés sont ceux du planning tel
          qu’enregistré. Validez chaque équipe en administration pour une vue officielle.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Aucune affectation sur la semaine pour les équipes concernées. Ouvrez le planning en administration et
          renseignez les cases (agent + code horaire), ou vérifiez la semaine sélectionnée.
        </p>
      ) : (
        <div className="max-h-[85vh] overflow-auto rounded-lg border border-zinc-300 bg-white shadow-sm">
          <table className="min-w-max border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100">
                <th
                  rowSpan={2}
                  className="sticky left-0 top-0 z-40 min-w-[120px] border border-zinc-300 bg-zinc-100 px-1.5 py-2 text-left text-[10px] font-bold uppercase leading-tight text-zinc-800"
                >
                  Poste
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.ymd}
                    className={[
                      "sticky top-0 z-30 min-w-[104px] border border-zinc-300 px-1.5 py-2 text-center font-semibold capitalize",
                      day.isWeekend ? "bg-zinc-200 text-zinc-600" : "bg-zinc-100 text-zinc-800",
                    ].join(" ")}
                  >
                    {day.label}
                  </th>
                ))}
              </tr>
              <tr className="bg-zinc-50">
                {weekDays.map((day) => (
                  <th
                    key={`${day.ymd}-sub`}
                    className={[
                      "sticky top-[40px] z-30 border border-zinc-300 px-1 py-1 text-center text-[10px] font-medium text-zinc-500",
                      day.isWeekend ? "bg-zinc-200" : "bg-zinc-50",
                    ].join(" ")}
                  >
                    {format(day.d, "yyyy-MM-dd")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                return (
                  <tr key={row.key} className="hover:bg-zinc-50/80">
                    <td className="sticky left-0 z-20 border border-zinc-200 bg-white px-1.5 py-1 align-middle text-[11px] font-semibold text-zinc-900">
                      {postLabel(row.job, row.shiftCode)}
                    </td>
                    {weekDays.map((day) => {
                      const cellKey = `${row.key}|${day.ymd}`;
                      const names = (namesByRowDay.get(cellKey) ?? []).slice().sort((a, b) =>
                        a.localeCompare(b, "fr"),
                      );
                      return (
                        <td
                          key={`${row.key}-${day.ymd}`}
                          className={[
                            "border border-zinc-200 px-1.5 py-1 align-top text-[11px] leading-snug text-zinc-900",
                            day.isWeekend ? "bg-zinc-50/90" : "",
                          ].join(" ")}
                        >
                          {names.length === 0 ? (
                            <span className="text-[10px] text-zinc-400">—</span>
                          ) : (
                            names.join(", ")
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
