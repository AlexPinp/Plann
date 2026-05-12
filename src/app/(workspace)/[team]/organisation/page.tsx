import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { startOfIsoWeekMondayUtc } from "@/lib/planning-week";
import { prisma } from "@/lib/prisma";
import { getAllTeams, getTeamBySlug, requireTeamMembership } from "@/lib/team";
import { workspacePath } from "@/lib/routes";
import { PlanningStatus, TeamJob, TeamRhythm } from "@/generated/prisma/enums";
import { ExportPdfButton } from "./ExportPdfButton";

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

type TemplateRow = {
  id: string;
  sector: "CMC" | "IOA" | "CC" | "SAUV" | "UDOM";
  rhythm: TeamRhythm;
  job: TeamJob;
  label: string;
  acceptedCodes: string[];
};

const TEMPLATE_ROWS: TemplateRow[] = [
  { id: "cmc-jour-ide-jm1", sector: "CMC", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JM1", acceptedCodes: ["JM1"] },
  { id: "cmc-jour-as-jm1", sector: "CMC", rhythm: TeamRhythm.JOUR, job: TeamJob.AS, label: "AS JM1", acceptedCodes: ["JM1"] },
  { id: "cmc-jour-ide-jm2", sector: "CMC", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JM2", acceptedCodes: ["JM2"] },
  { id: "cmc-jour-as-jm2", sector: "CMC", rhythm: TeamRhythm.JOUR, job: TeamJob.AS, label: "AS JM2", acceptedCodes: ["JM2"] },
  { id: "cmc-jour-ide-jm3", sector: "CMC", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JM3", acceptedCodes: ["JM3"] },
  { id: "cmc-jour-as-jm3", sector: "CMC", rhythm: TeamRhythm.JOUR, job: TeamJob.AS, label: "AS JM3", acceptedCodes: ["JM3"] },
  { id: "cmc-jour-ide-jm4", sector: "CMC", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JM4", acceptedCodes: ["JM4"] },
  { id: "cmc-jour-as-jc", sector: "CMC", rhythm: TeamRhythm.JOUR, job: TeamJob.AS, label: "AS course JC", acceptedCodes: ["JC", "JCD"] },
  { id: "cmc-nuit-ide-nm1", sector: "CMC", rhythm: TeamRhythm.NUIT, job: TeamJob.IDE, label: "IDE NM1", acceptedCodes: ["NM1"] },
  { id: "cmc-nuit-as-nm1", sector: "CMC", rhythm: TeamRhythm.NUIT, job: TeamJob.AS, label: "AS NM1", acceptedCodes: ["NM1"] },
  { id: "cmc-nuit-ide-nm2", sector: "CMC", rhythm: TeamRhythm.NUIT, job: TeamJob.IDE, label: "IDE NM2", acceptedCodes: ["NM2"] },
  { id: "cmc-nuit-as-nm2", sector: "CMC", rhythm: TeamRhythm.NUIT, job: TeamJob.AS, label: "AS NM2", acceptedCodes: ["NM2"] },
  { id: "cmc-nuit-ide-nm3", sector: "CMC", rhythm: TeamRhythm.NUIT, job: TeamJob.IDE, label: "IDE NM3", acceptedCodes: ["NM3"] },
  { id: "cmc-nuit-as-nm3", sector: "CMC", rhythm: TeamRhythm.NUIT, job: TeamJob.AS, label: "AS NM3", acceptedCodes: ["NM3"] },
  { id: "ioa-jour-ide-jo1", sector: "IOA", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JO1", acceptedCodes: ["JO1"] },
  { id: "ioa-jour-ide-jo2", sector: "IOA", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JO2", acceptedCodes: ["JO2"] },
  { id: "ioa-jour-as-ioa", sector: "IOA", rhythm: TeamRhythm.JOUR, job: TeamJob.AS, label: "AS IOA", acceptedCodes: ["IOA"] },
  { id: "ioa-jour-ide-jcd", sector: "IOA", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JCD", acceptedCodes: ["JCD"] },
  { id: "ioa-nuit-ide-no1", sector: "IOA", rhythm: TeamRhythm.NUIT, job: TeamJob.IDE, label: "IDE NO1", acceptedCodes: ["NO1"] },
  { id: "ioa-nuit-ide-no2", sector: "IOA", rhythm: TeamRhythm.NUIT, job: TeamJob.IDE, label: "IDE NO2", acceptedCodes: ["NO2"] },
  { id: "cc-jour-ide-jg1", sector: "CC", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JG1", acceptedCodes: ["JG1"] },
  { id: "cc-jour-ide-jg2", sector: "CC", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JG2", acceptedCodes: ["JG2"] },
  { id: "cc-jour-as-jg", sector: "CC", rhythm: TeamRhythm.JOUR, job: TeamJob.AS, label: "AS JG", acceptedCodes: ["JG", "JG1", "JG2"] },
  { id: "cc-nuit-ide-ng", sector: "CC", rhythm: TeamRhythm.NUIT, job: TeamJob.IDE, label: "IDE NG", acceptedCodes: ["NG"] },
  { id: "cc-nuit-as-ng", sector: "CC", rhythm: TeamRhythm.NUIT, job: TeamJob.AS, label: "AS NG", acceptedCodes: ["NG"] },
  { id: "sauv-jour-ide-js1", sector: "SAUV", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JS", acceptedCodes: ["JS"] },
  { id: "sauv-jour-as-js", sector: "SAUV", rhythm: TeamRhythm.JOUR, job: TeamJob.AS, label: "AS JS", acceptedCodes: ["JS"] },
  { id: "sauv-nuit-ide-ns", sector: "SAUV", rhythm: TeamRhythm.NUIT, job: TeamJob.IDE, label: "IDE NS", acceptedCodes: ["NS"] },
  { id: "sauv-nuit-as-ns", sector: "SAUV", rhythm: TeamRhythm.NUIT, job: TeamJob.AS, label: "AS NS", acceptedCodes: ["NS"] },
  { id: "udom-jour-ide-jh1", sector: "UDOM", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JH1", acceptedCodes: ["JH1"] },
  { id: "udom-jour-as-jh1", sector: "UDOM", rhythm: TeamRhythm.JOUR, job: TeamJob.AS, label: "AS JH1", acceptedCodes: ["JH1"] },
  { id: "udom-jour-ide-jh2", sector: "UDOM", rhythm: TeamRhythm.JOUR, job: TeamJob.IDE, label: "IDE JH2", acceptedCodes: ["JH2"] },
  { id: "udom-jour-as-jh2", sector: "UDOM", rhythm: TeamRhythm.JOUR, job: TeamJob.AS, label: "AS JH2", acceptedCodes: ["JH2"] },
  { id: "udom-nuit-ide-nh", sector: "UDOM", rhythm: TeamRhythm.NUIT, job: TeamJob.IDE, label: "IDE NH", acceptedCodes: ["NH"] },
  { id: "udom-nuit-as-nh", sector: "UDOM", rhythm: TeamRhythm.NUIT, job: TeamJob.AS, label: "AS NH", acceptedCodes: ["NH"] },
];

function normalizeShiftCode(code: string): string {
  return code.trim().toUpperCase();
}

function inferSectorFromShiftCode(code: string): TemplateRow["sector"] | null {
  const c = normalizeShiftCode(code);
  if (/^(JM|NM|JC)/.test(c)) return "CMC";
  if (/^(JG|NG)/.test(c)) return "CC";
  if (/^(JS|NS)/.test(c)) return "SAUV";
  if (/^(JH|NH)/.test(c)) return "UDOM";
  return null;
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
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    return { d, ymd, isWeekend };
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

  const namesByRowDay = new Map<string, string[]>();
  /** Lignes « hors grille » : clé stable `${teamId}|${shiftCode}` (plusieurs équipes peuvent partager un même code). */
  const namesByDynamicRowDay = new Map<string, string[]>();
  const dynamicRowOrder: string[] = [];
  const dynamicRowsMeta = new Map<string, { teamLabel: string; shiftCode: string; job: TeamJob; rhythm: TeamRhythm }>();

  for (const a of assignments) {
    const teamId = teamIdByWeekId.get(a.planningWeekId);
    if (!teamId || !a.user || !a.shiftType || !a.userId) continue;
    const team = teamById.get(teamId);
    if (!team) continue;

    const shiftCode = normalizeShiftCode(a.shiftType.code.trim() || a.shiftType.label);
    const dk = formatUtcYmd(a.date);
    const templateMatch = TEMPLATE_ROWS.find(
      (row) => row.job === team.job && row.rhythm === team.rhythm && row.acceptedCodes.includes(shiftCode),
    );

    if (templateMatch) {
      const cellKey = `${templateMatch.id}|${dk}`;
      const list = namesByRowDay.get(cellKey) ?? [];
      const name = `${a.user.lastName.toUpperCase()} ${a.user.firstName}`;
      if (!list.includes(name)) list.push(name);
      namesByRowDay.set(cellKey, list);
      continue;
    }

    const rowKey = `${teamId}|${shiftCode}`;
    if (!dynamicRowsMeta.has(rowKey)) {
      dynamicRowsMeta.set(rowKey, {
        teamLabel: team.label,
        shiftCode,
        job: team.job,
        rhythm: team.rhythm,
      });
      dynamicRowOrder.push(rowKey);
    }
    const dynCellKey = `${rowKey}|${dk}`;
    const dlist = namesByDynamicRowDay.get(dynCellKey) ?? [];
    const dname = `${a.user.lastName.toUpperCase()} ${a.user.firstName}`;
    if (!dlist.includes(dname)) dlist.push(dname);
    namesByDynamicRowDay.set(dynCellKey, dlist);
  }

  const rows = TEMPLATE_ROWS;
  const sectorRowSpans = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.sector] = (acc[row.sector] ?? 0) + 1;
    return acc;
  }, {});
  const periodRowSpans = rows.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.sector}|${row.rhythm}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const seenSector = new Set<string>();
  const seenPeriod = new Set<string>();

  const orgPath = workspacePath(teamCtx.slug, "planification");
  const prevWeek = shiftWeekUtc(weekStart, -1);
  const nextWeek = shiftWeekUtc(weekStart, 1);
  const weekRangeLabel = `${format(monday, "d MMM", { locale: fr })} – ${format(sunday, "d MMM yyyy", { locale: fr })}`;

  return (
    <main className="mx-auto w-full max-w-[99.5vw] flex-1 p-2 sm:p-3 md:p-4 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Planification</h1>
          <p className="hidden text-sm text-zinc-700 print:block">Semaine : {weekRangeLabel}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto print:hidden">
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
          <div className="print:hidden">
            <ExportPdfButton />
          </div>
        </div>
      </div>

      {provisionalFromDraft ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
          Au moins une équipe est encore en brouillon pour cette semaine — les noms affichés sont ceux du planning tel
          qu’enregistré. Validez chaque équipe en administration pour une vue officielle.
        </p>
      ) : null}

      {weekIds.length === 0 ? (
        <p className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700 print:hidden">
          Aucune semaine de planning en base pour cette semaine (toutes équipes). Les noms apparaissent une fois les
          semaines créées dans le planning admin et des affectations enregistrées.
        </p>
      ) : null}

      <div className="max-h-[85vh] overflow-auto print:max-h-none print:overflow-visible print:[&_*.sticky]:!static">
        <div className="mx-auto w-fit rounded-lg border border-zinc-300 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <table className="mx-auto min-w-max border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-100">
              <th className="sticky left-0 top-0 z-40 min-w-[56px] border border-zinc-300 bg-zinc-100 px-1.5 py-2 text-center text-[10px] font-bold uppercase text-zinc-800">
                Secteur
              </th>
              <th className="sticky left-[56px] top-0 z-40 min-w-[52px] border border-zinc-300 bg-zinc-100 px-1.5 py-2 text-center text-[10px] font-bold uppercase text-zinc-800">
                Rythme
              </th>
              <th className="sticky left-[108px] top-0 z-40 min-w-[98px] border border-zinc-300 bg-zinc-100 px-1 py-2 text-left text-[10px] font-bold uppercase text-zinc-800">
                Poste
              </th>
              {weekDays.map((day) => (
                <th
                  key={day.ymd}
                  className={[
                    "sticky top-0 z-30 min-w-[86px] border border-zinc-300 px-1.5 py-2 text-center text-[11px] font-semibold text-zinc-800",
                    day.isWeekend ? "bg-zinc-200 text-zinc-600" : "bg-zinc-100",
                  ].join(" ")}
                >
                  {format(day.d, "dd/MM")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const periodKey = `${row.sector}|${row.rhythm}`;
              const showSector = !seenSector.has(row.sector);
              const showPeriod = !seenPeriod.has(periodKey);
              if (showSector) seenSector.add(row.sector);
              if (showPeriod) seenPeriod.add(periodKey);

              return (
                <tr key={row.id} className="hover:bg-zinc-50/80">
                  {showSector ? (
                    <td
                      rowSpan={sectorRowSpans[row.sector]}
                      className="sticky left-0 z-20 border border-zinc-300 bg-zinc-100 px-1 py-1 text-center text-[11px] font-bold tracking-wide text-zinc-900 [writing-mode:vertical-rl] [text-orientation:mixed]"
                    >
                      {row.sector}
                    </td>
                  ) : null}
                  {showPeriod ? (
                    <td
                      rowSpan={periodRowSpans[periodKey]}
                      className="sticky left-[56px] z-20 border border-zinc-300 bg-zinc-50 px-1 py-1 text-center text-[10px] font-semibold uppercase text-zinc-700 [writing-mode:vertical-rl] [text-orientation:mixed]"
                    >
                      {row.rhythm}
                    </td>
                  ) : null}
                  <td className="sticky left-[108px] z-20 border border-zinc-300 bg-white px-1 py-1 align-middle text-[11px] font-semibold text-zinc-900">
                    {row.label}
                  </td>
                  {weekDays.map((day) => {
                    const cellKey = `${row.id}|${day.ymd}`;
                    const names = (namesByRowDay.get(cellKey) ?? []).slice().sort((a, b) => a.localeCompare(b, "fr"));
                    return (
                      <td
                        key={`${row.id}-${day.ymd}`}
                        className={[
                          "border border-zinc-300 px-1.5 py-1 align-middle text-center text-[11px] font-semibold leading-snug text-zinc-900",
                          day.isWeekend ? "bg-zinc-50/90" : "",
                        ].join(" ")}
                      >
                        {names.length === 0 ? <span className="text-[10px] text-zinc-400"> </span> : names.join(", ")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {dynamicRowOrder.map((rowKey) => {
              const meta = dynamicRowsMeta.get(rowKey);
              if (!meta) return null;
              const sectorGuess = inferSectorFromShiftCode(meta.shiftCode);
              return (
                <tr key={`dyn-${rowKey}`} className="bg-amber-50/40 hover:bg-amber-50/80">
                  <td className="sticky left-0 z-20 border border-zinc-300 bg-amber-100/80 px-1 py-1 text-center text-[10px] font-bold text-amber-950">
                    {sectorGuess ?? "—"}
                  </td>
                  <td className="sticky left-[56px] z-20 border border-zinc-300 bg-amber-50 px-1 py-1 text-center text-[10px] font-semibold uppercase text-amber-900">
                    {meta.rhythm}
                  </td>
                  <td className="sticky left-[108px] z-20 border border-zinc-300 bg-white px-1 py-1 align-middle text-[10px] font-semibold leading-tight text-amber-950">
                    <span className="block text-zinc-600">{meta.teamLabel}</span>
                    <span className="text-[11px] text-zinc-900">{meta.shiftCode}</span>
                    <span className="mt-0.5 block text-[9px] font-normal text-amber-800">hors grille fixe</span>
                  </td>
                  {weekDays.map((day) => {
                    const names = (namesByDynamicRowDay.get(`${rowKey}|${day.ymd}`) ?? [])
                      .slice()
                      .sort((a, b) => a.localeCompare(b, "fr"));
                    return (
                      <td
                        key={`dyn-${rowKey}-${day.ymd}`}
                        className={[
                          "border border-zinc-300 px-1.5 py-1 align-middle text-center text-[11px] font-semibold leading-snug text-zinc-900",
                          day.isWeekend ? "bg-zinc-50/90" : "",
                        ].join(" ")}
                      >
                        {names.length === 0 ? <span className="text-[10px] text-zinc-400"> </span> : names.join(", ")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
