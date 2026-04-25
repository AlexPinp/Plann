import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_TEMPLATE_CYCLE_WEEKS, normalizeTemplateCycleWeeks } from "@/lib/planning-template";
import { prisma } from "@/lib/prisma";
import { getTeamBySlug } from "@/lib/team";
import { adminTeamPath } from "@/lib/routes";
import { savePlanningTemplate } from "./actions";

type Props = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseTemplateNumber(sp: Record<string, string | string[] | undefined>): number {
  const raw = typeof sp.template === "string" ? Number(sp.template) : 1;
  if (!Number.isInteger(raw) || raw < 1) return 1;
  return raw;
}

export default async function AdminTemplatesPage({ params, searchParams }: Props) {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const sp = await searchParams;
  const selectedNumber = parseTemplateNumber(sp);
  const saved = sp.saved === "1";
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const tramesPath = adminTeamPath(team.slug, "trames");

  const [shifts, template, existingTemplates] = await Promise.all([
    prisma.shiftType.findMany({ orderBy: { code: "asc" } }),
    prisma.planningTemplate.findUnique({
      where: { teamId_number: { teamId: team.id, number: selectedNumber } },
      include: { entries: true },
    }),
    prisma.planningTemplate.findMany({
      where: { teamId: team.id },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const entryByOffset = new Map<number, string>();
  for (const entry of template?.entries ?? []) {
    if (entry.shiftTypeId) entryByOffset.set(entry.dayOffset, entry.shiftTypeId);
  }

  const existingNumbers = existingTemplates.map((t) => t.number);
  const maxExistingNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 33;
  const nextNewTemplateNumber = Math.max(selectedNumber, maxExistingNumber) + 1;
  const selectorNumbers = Array.from(
    new Set([...existingNumbers, selectedNumber].filter((n) => Number.isInteger(n) && n > 0)),
  ).sort((a, b) => a - b);

  const previousTemplate = selectedNumber > 1 ? selectedNumber - 1 : 1;
  const nextTemplate = selectedNumber + 1;
  const cycleWeeks = normalizeTemplateCycleWeeks(template?.cycleWeeks ?? DEFAULT_TEMPLATE_CYCLE_WEEKS);
  const templateLabel = template?.label ?? `Trame ${selectedNumber}`;

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Trames cycliques</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Autant de trames que necessaire par equipe ; duree du cycle reglable de 1 a 52 semaines. Attribuez un numero
          de trame a chaque agent pour derouler son cycle.
        </p>
      </div>

      {saved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Trame enregistree.</p>}
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Selection de la trame</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${tramesPath}?template=${previousTemplate}`}
            aria-disabled={selectedNumber === 1}
            className={[
              "rounded-md border px-2.5 py-1.5 text-xs font-semibold",
              selectedNumber === 1
                ? "pointer-events-none border-zinc-200 bg-zinc-100 text-zinc-400"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
          >
            &larr; Precedente
          </Link>

          <form action={tramesPath} method="get" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label htmlFor="template" className="text-xs font-medium text-zinc-600">
              Trame
            </label>
            <select
              id="template"
              name="template"
              defaultValue={String(selectedNumber)}
              className="h-9 min-w-[140px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 sm:flex-none"
            >
              {selectorNumbers.map((n) => (
                <option key={n} value={n}>
                  Trame {n}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Ouvrir
            </button>
          </form>

          <Link
            href={`${tramesPath}?template=${nextTemplate}`}
            aria-disabled={false}
            className={[
              "rounded-md border px-2.5 py-1.5 text-xs font-semibold",
              "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
          >
            Suivante &rarr;
          </Link>

          <Link
            href={`${tramesPath}?template=${nextNewTemplateNumber}`}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            + Ajouter une trame
          </Link>
        </div>
      </section>

      <form
        key={`template-form-${selectedNumber}`}
        action={savePlanningTemplate}
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <input type="hidden" name="teamSlug" value={team.slug} />
        <input type="hidden" name="templateNumber" value={selectedNumber} />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Edition trame {selectedNumber}
            {template ? (
              <span className="ml-2 font-normal normal-case text-zinc-500">— {template.label}</span>
            ) : null}
          </h2>
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Enregistrer la trame
          </button>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="templateLabel" className="text-xs font-medium text-zinc-600">
              Libelle
            </label>
            <input
              id="templateLabel"
              name="templateLabel"
              defaultValue={templateLabel}
              placeholder={`Trame ${selectedNumber}`}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cycleWeeks" className="text-xs font-medium text-zinc-600">
              Duree du cycle (semaines)
            </label>
            <input
              id="cycleWeeks"
              name="cycleWeeks"
              type="number"
              min={1}
              max={52}
              defaultValue={cycleWeeks}
              className="mt-1 w-full max-w-[8rem] rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-zinc-500">La grille comporte ce nombre de semaines × 7 jours.</p>
          </div>
        </div>

        <div className="overflow-auto rounded-lg border border-zinc-200">
          <table className="min-w-max border-collapse text-xs">
            <thead className="bg-zinc-50">
              <tr>
                <th className="border border-zinc-200 px-2 py-1 text-left">Semaine</th>
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                  <th key={`${d}-${i}`} className="border border-zinc-200 px-2 py-1 text-center">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: cycleWeeks }, (_, weekIdx) => (
                <tr key={weekIdx} className={weekIdx % 2 === 0 ? "bg-white" : "bg-zinc-50/40"}>
                  <td className="border border-zinc-200 px-2 py-1 font-medium text-zinc-700">S{weekIdx + 1}</td>
                  {Array.from({ length: 7 }, (_, dow) => {
                    const dayOffset = weekIdx * 7 + dow;
                    return (
                      <td key={dayOffset} className="border border-zinc-200 p-0.5">
                        <select
                          key={`tpl-${selectedNumber}-d-${dayOffset}`}
                          name={`d-${dayOffset}`}
                          defaultValue={entryByOffset.get(dayOffset) ?? ""}
                          className="h-7 min-w-[60px] rounded border border-zinc-300 bg-white px-1 text-[11px] font-semibold text-zinc-900"
                        >
                          <option value=""> </option>
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </main>
  );
}
