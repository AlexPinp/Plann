import Link from "next/link";
import { notFound } from "next/navigation";
import { ShiftCategory } from "@/generated/prisma/enums";
import { adminTeamPath } from "@/lib/routes";
import { getShiftDurationHoursRounded } from "@/lib/shift-hours";
import { getAllTeams, getTeamBySlug } from "@/lib/team";
import { findManyShiftTypesOrdered } from "@/lib/shift-type-queries";
import { copyShiftCodesFromTeam, createShiftCode, deleteShiftCode, updateShiftCode } from "./actions";

type Props = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function AdminTeamShiftCodesPage({ params, searchParams }: Props) {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const pagePath = adminTeamPath(team.slug, "codes-horaires");
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;
  const created = query.created === "1";
  const updated = query.updated === "1";
  const deleted = query.deleted === "1";
  const copiedRaw = typeof query.copied === "string" ? query.copied : undefined;
  const copiedCount =
    copiedRaw !== undefined && /^\d+$/.test(copiedRaw) ? Math.min(9999, Math.max(0, Number(copiedRaw))) : null;
  const q = getStringParam(query.q).trim().toLowerCase();
  const categoryFilter = getStringParam(query.category);
  const sort = getStringParam(query.sort) || "code-asc";

  const [teamsOtherThanCurrent, { shifts: allShifts, usedLegacyCategoryFallback: hadInvalidCategoryData }] =
    await Promise.all([
      getAllTeams(),
      findManyShiftTypesOrdered(team.id),
    ]);
  const sourceTeamsForCopy = teamsOtherThanCurrent.filter((t) => t.id !== team.id);
  const filtered = allShifts.filter((shift) => {
    if (categoryFilter && categoryFilter !== "all" && shift.category !== categoryFilter) return false;
    if (!q) return true;
    return (
      shift.code.toLowerCase().includes(q) ||
      shift.label.toLowerCase().includes(q) ||
      shift.category.toLowerCase().includes(q)
    );
  });

  let filteredShifts: typeof filtered;
  if (sort === "hours-asc" || sort === "hours-desc") {
    const decorated = filtered.map((shift) => ({
      shift,
      hours: getShiftDurationHoursRounded(shift.startsAt, shift.endsAt),
    }));
    decorated.sort((a, b) => (sort === "hours-asc" ? a.hours - b.hours : b.hours - a.hours));
    filteredShifts = decorated.map((d) => d.shift);
  } else {
    filteredShifts = [...filtered].sort((a, b) => {
      if (sort === "code-desc") return b.code.localeCompare(a.code);
      if (sort === "category") return a.category.localeCompare(b.category) || a.code.localeCompare(b.code);
      return a.code.localeCompare(b.code);
    });
  }

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Codes horaires</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Codes utilisés dans le planning de <span className="font-medium text-zinc-800">{team.label}</span> uniquement
          (horaires et affichage independants des autres equipes).
        </p>
      </div>

      {created && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Code créé.</p>}
      {updated && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Code mis à jour.</p>}
      {deleted && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Code supprimé.</p>}
      {copiedCount !== null && copiedCount > 0 ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {copiedCount} code{copiedCount > 1 ? "s" : ""} copié{copiedCount > 1 ? "s" : ""} depuis l&apos;autre équipe (les
          codes déjà présents ici ont été ignorés).
        </p>
      ) : null}
      {copiedCount === 0 ? (
        <p className="mb-4 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
          Aucun nouveau code copié : tous les codes de la source existent déjà pour cette équipe.
        </p>
      ) : null}
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {hadInvalidCategoryData ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Des catégories invalides ont été détectées en base. Elles sont affichées en JOUR pour permettre correction.
        </p>
      ) : null}

      <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form method="get" className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="q" className="text-xs font-medium text-zinc-600">
              Recherche
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Code, nom ou catégorie"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="categoryFilter" className="text-xs font-medium text-zinc-600">
              Catégorie
            </label>
            <select
              id="categoryFilter"
              name="category"
              defaultValue={categoryFilter || "all"}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="all">Toutes</option>
              <option value={ShiftCategory.JOUR}>JOUR</option>
              <option value={ShiftCategory.NUIT}>NUIT</option>
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="text-xs font-medium text-zinc-600">
              Tri
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="code-asc">Code (A → Z)</option>
              <option value="code-desc">Code (Z → A)</option>
              <option value="hours-asc">Heures (croissant)</option>
              <option value="hours-desc">Heures (décroissant)</option>
              <option value="category">Catégorie puis code</option>
            </select>
          </div>
          <div className="md:col-span-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              {filteredShifts.length} code(s) affiché(s) sur {allShifts.length}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="submit"
                className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Filtrer
              </button>
              <Link
                href={pagePath}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Réinitialiser
              </Link>
            </div>
          </div>
        </form>
      </section>

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Code</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Nom</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Debut</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Fin</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Valeur (h)</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Couleur</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Catégorie</th>
              <th
                className="border-b border-zinc-200 p-3 text-center font-semibold text-zinc-700"
                title="Compte dans le récap d'heures des agents (planning et Droits)"
              >
                Récap h.
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredShifts.map((shift) => (
              <tr key={shift.id} className="align-top">
                <td className="border-b border-zinc-100 p-3">
                  <input type="hidden" form={`update-${shift.id}`} name="id" value={shift.id} />
                  <input type="hidden" form={`update-${shift.id}`} name="teamSlug" value={team.slug} />
                  <input
                    form={`update-${shift.id}`}
                    name="code"
                    required
                    defaultValue={shift.code}
                    className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs font-semibold uppercase"
                  />
                </td>
                <td className="border-b border-zinc-100 p-3">
                  <input
                    form={`update-${shift.id}`}
                    name="label"
                    required
                    defaultValue={shift.label}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                  />
                </td>
                <td className="border-b border-zinc-100 p-3">
                  <input
                    form={`update-${shift.id}`}
                    name="startsAt"
                    type="time"
                    defaultValue={shift.startsAt}
                    className="w-28 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                  />
                </td>
                <td className="border-b border-zinc-100 p-3">
                  <input
                    form={`update-${shift.id}`}
                    name="endsAt"
                    type="time"
                    defaultValue={shift.endsAt}
                    className="w-28 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                  />
                </td>
                <td className="border-b border-zinc-100 p-3">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs font-semibold text-zinc-700">
                    {getShiftDurationHoursRounded(shift.startsAt, shift.endsAt)}
                  </div>
                </td>
                <td className="border-b border-zinc-100 p-3">
                  <input
                    form={`update-${shift.id}`}
                    name="color"
                    type="color"
                    defaultValue={shift.color}
                    className="h-9 w-14 rounded-md border border-zinc-300 p-1"
                  />
                </td>
                <td className="border-b border-zinc-100 p-3">
                  <select
                    form={`update-${shift.id}`}
                    name="category"
                    defaultValue={shift.category}
                    className="w-28 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                  >
                    <option value={ShiftCategory.JOUR}>JOUR</option>
                    <option value={ShiftCategory.NUIT}>NUIT</option>
                  </select>
                </td>
                <td className="border-b border-zinc-100 p-3 text-center">
                  <label className="inline-flex cursor-pointer items-center justify-center">
                    <input
                      form={`update-${shift.id}`}
                      type="checkbox"
                      name="countsInHoursRecap"
                      value="1"
                      defaultChecked={shift.countsInHoursRecap}
                      className="h-4 w-4 rounded border-zinc-300"
                      title="Compte dans le récap d'heures"
                    />
                  </label>
                </td>
                <td className="border-b border-zinc-100 p-3">
                  <div className="flex flex-wrap gap-2">
                    <form id={`update-${shift.id}`} action={updateShiftCode}>
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Enregistrer
                      </button>
                    </form>
                    <form action={deleteShiftCode}>
                      <input type="hidden" name="id" value={shift.id} />
                      <input type="hidden" name="teamSlug" value={team.slug} />
                      <button
                        type="submit"
                        className="rounded-md border border-rose-300 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Supprimer
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {filteredShifts.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-sm text-zinc-500">
                  Aucun code ne correspond au filtre actuel.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Nouveau code horaire</h2>
        <form
          action={createShiftCode}
          className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[110px_minmax(220px,1fr)_110px_150px_150px_120px_auto] xl:items-end"
        >
          <input type="hidden" name="teamSlug" value={team.slug} />
          <div>
            <label htmlFor="code" className="text-xs font-medium text-zinc-600">
              Code
            </label>
            <input
              id="code"
              name="code"
              required
              maxLength={16}
              placeholder="JM1"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="label" className="text-xs font-medium text-zinc-600">
              Nom
            </label>
            <input
              id="label"
              name="label"
              required
              placeholder="Jour matin 1"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="color" className="text-xs font-medium text-zinc-600">
              Couleur
            </label>
            <input
              id="color"
              name="color"
              type="color"
              defaultValue="#e5e7eb"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-1.5 py-1"
            />
          </div>
          <div>
            <label htmlFor="category" className="text-xs font-medium text-zinc-600">
              Catégorie
            </label>
            <select
              id="category"
              name="category"
              defaultValue={ShiftCategory.JOUR}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value={ShiftCategory.JOUR}>JOUR</option>
              <option value={ShiftCategory.NUIT}>NUIT</option>
            </select>
          </div>
          <div>
            <label htmlFor="startsAt" className="text-xs font-medium text-zinc-600">
              Debut (HH:MM)
            </label>
            <input
              id="startsAt"
              name="startsAt"
              type="time"
              defaultValue="08:00"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="endsAt" className="text-xs font-medium text-zinc-600">
              Fin (HH:MM)
            </label>
            <input
              id="endsAt"
              name="endsAt"
              type="time"
              defaultValue="16:00"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="countsInHoursRecap"
                value="1"
                defaultChecked
                className="h-4 w-4 rounded border-zinc-300"
              />
              Compte dans le récap d&apos;heures
            </label>
          </div>
          <div className="sm:col-span-2 xl:col-span-1">
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 xl:w-auto"
            >
              Créer le code
            </button>
          </div>
        </form>
      </section>

      {sourceTeamsForCopy.length > 0 ? (
        <section className="mt-8 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-indigo-950">Copier depuis une autre équipe</h2>
          <p className="mt-1 text-xs text-indigo-900/90">
            Ajoute uniquement les codes qui n&apos;existent pas encore pour {team.label} (horaires, libellés,
            couleurs et liaisons compétences comme à la source).
          </p>
          <form action={copyShiftCodesFromTeam} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="teamSlug" value={team.slug} />
            <div className="min-w-[220px] flex-1">
              <label htmlFor="sourceTeamSlug" className="text-xs font-medium text-indigo-950">
                Équipe source
              </label>
              <select
                id="sourceTeamSlug"
                name="sourceTeamSlug"
                required
                defaultValue={sourceTeamsForCopy[0]!.slug}
                className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-zinc-900"
              >
                {sourceTeamsForCopy.map((t) => (
                  <option key={t.id} value={t.slug}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg border border-indigo-700 bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800"
            >
              Copier les codes manquants
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
