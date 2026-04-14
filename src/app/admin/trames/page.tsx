import Link from "next/link";
import { TEMPLATE_CYCLE_WEEKS } from "@/lib/planning-template";
import { prisma } from "@/lib/prisma";
import { savePlanningTemplate } from "./actions";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseTemplateNumber(sp: Record<string, string | string[] | undefined>): number {
  const raw = typeof sp.template === "string" ? Number(sp.template) : 1;
  if (!Number.isInteger(raw) || raw < 1) return 1;
  return raw;
}

export default async function AdminTemplatesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const selectedNumber = parseTemplateNumber(sp);
  const saved = sp.saved === "1";
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const [shifts, template, existingTemplates] = await Promise.all([
    prisma.shiftType.findMany({ orderBy: { code: "asc" } }),
    prisma.planningTemplate.findUnique({
      where: { number: selectedNumber },
      include: { entries: true },
    }),
    prisma.planningTemplate.findMany({
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

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Trames cycliques (1 a 33)</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Attribuez ensuite un numero de trame a chaque agent pour derouler automatiquement son cycle.
        </p>
      </div>

      {saved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Trame enregistree.</p>}
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Selection de la trame</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/trames?template=${previousTemplate}`}
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

          <form action="/admin/trames" method="get" className="flex items-center gap-2">
            <label htmlFor="template" className="text-xs font-medium text-zinc-600">
              Trame
            </label>
            <select
              id="template"
              name="template"
              defaultValue={String(selectedNumber)}
              className="h-9 min-w-[170px] rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900"
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
            href={`/admin/trames?template=${nextTemplate}`}
            aria-disabled={false}
            className={[
              "rounded-md border px-2.5 py-1.5 text-xs font-semibold",
              "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
          >
            Suivante &rarr;
          </Link>

          <Link
            href={`/admin/trames?template=${nextNewTemplateNumber}`}
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
        <input type="hidden" name="templateNumber" value={selectedNumber} />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Edition trame {selectedNumber}</h2>
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Enregistrer la trame
          </button>
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
              {Array.from({ length: TEMPLATE_CYCLE_WEEKS }, (_, weekIdx) => (
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
