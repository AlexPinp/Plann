import Link from "next/link";
import { UserRole } from "@/generated/prisma/enums";
import { ColorPicker } from "@/components/ColorPicker";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLANNING_RH_PROFILE, PLANNING_RH_PROFILES, planningRhProfileLabelsFr } from "@/lib/planning-rh";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { roleLabelsFr } from "@/lib/user-roles";
import { createAgent, setAgentActive } from "./actions";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AgentSortKey = "agent" | "role" | "bloc" | "trame" | "profil" | "competences" | "compte" | "actif";
type SortDir = "asc" | "desc";

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function parseSortKey(raw: string): AgentSortKey {
  if (
    raw === "agent" ||
    raw === "role" ||
    raw === "bloc" ||
    raw === "trame" ||
    raw === "profil" ||
    raw === "competences" ||
    raw === "compte" ||
    raw === "actif"
  ) {
    return raw;
  }
  return "agent";
}

function parseSortDir(raw: string): SortDir {
  return raw === "desc" ? "desc" : "asc";
}

export default async function AdminAgentsPage({ searchParams }: Props) {
  const actor = await requireStaffAdmin();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const created = params.created === "1";
  const updated = params.updated === "1";
  const sortKey = parseSortKey(getSingleParam(params.sort));
  const sortDir = parseSortDir(getSingleParam(params.dir));

  const [users, allSkills, templateNumbersRows] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ planningGroupLabel: "asc" }, { displayOrder: "asc" }, { lastName: "asc" }],
      include: { skills: { include: { skill: true } } },
    }),
    prisma.skill.findMany({ orderBy: { name: "asc" } }),
    prisma.planningTemplate.findMany({
      select: { number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const availableTemplateNumbers = Array.from(
    new Set([
      ...templateNumbersRows.map((row) => row.number),
      ...users.map((u) => u.planningTemplateNumber).filter((n): n is number => n !== null),
    ]),
  ).sort((a, b) => a - b);

  const sortedUsers = [...users].sort((a, b) => {
    const aSkills = a.skills.map((us) => us.skill.name).sort().join(", ");
    const bSkills = b.skills.map((us) => us.skill.name).sort().join(", ");
    const aAgent = `${a.lastName} ${a.firstName}`.toLowerCase();
    const bAgent = `${b.lastName} ${b.firstName}`.toLowerCase();
    const cmp = (() => {
      if (sortKey === "agent") return aAgent.localeCompare(bAgent);
      if (sortKey === "role") return roleLabelsFr[a.role].localeCompare(roleLabelsFr[b.role]);
      if (sortKey === "bloc") return (a.planningGroupLabel ?? "").localeCompare(b.planningGroupLabel ?? "");
      if (sortKey === "trame") return (a.planningTemplateNumber ?? -1) - (b.planningTemplateNumber ?? -1);
      if (sortKey === "profil") {
        return planningRhProfileLabelsFr[a.planningRhProfile].localeCompare(planningRhProfileLabelsFr[b.planningRhProfile]);
      }
      if (sortKey === "competences") return aSkills.localeCompare(bSkills);
      if (sortKey === "compte") return Number(!!a.authUserId) - Number(!!b.authUserId);
      return Number(a.active) - Number(b.active);
    })();
    if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
    return aAgent.localeCompare(bAgent);
  });

  function sortHref(key: AgentSortKey) {
    const nextDir: SortDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    return `/admin/agents?sort=${key}&dir=${nextDir}`;
  }

  function sortLabel(key: AgentSortKey, label: string) {
    const arrow = sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "";
    return `${label} ${arrow}`.trim();
  }

  const showRolePicker = actor.role === UserRole.ADMIN;

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Agents & acces</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Gerez les agents, leurs competences et leur visibilite sur le planning.
        </p>
      </div>

      {created && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Agent cree.</p>}
      {updated && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Fiche mise a jour.</p>}
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {/* ── Liste agents ── */}
      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[940px] border-collapse text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("agent")} className="hover:text-zinc-900">
                  {sortLabel("agent", "Agent")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("role")} className="hover:text-zinc-900">
                  {sortLabel("role", "Role")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("bloc")} className="hover:text-zinc-900">
                  {sortLabel("bloc", "Bloc")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("trame")} className="hover:text-zinc-900">
                  {sortLabel("trame", "Trame")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("profil")} className="hover:text-zinc-900">
                  {sortLabel("profil", "Profil RH")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("competences")} className="hover:text-zinc-900">
                  {sortLabel("competences", "Competences")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("compte")} className="hover:text-zinc-900">
                  {sortLabel("compte", "Compte")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("actif")} className="hover:text-zinc-900">
                  {sortLabel("actif", "Actif")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u) => (
              <tr key={u.id} className={!u.active ? "bg-zinc-50 opacity-60" : ""}>
                <td className="border-b border-zinc-100 p-3">
                  <div className="font-medium text-zinc-900">{u.lastName.toUpperCase()} {u.firstName}</div>
                  <div className="text-xs text-zinc-500">{u.email}</div>
                </td>
                <td className="border-b border-zinc-100 p-3 text-zinc-600">{roleLabelsFr[u.role]}</td>
                <td className="border-b border-zinc-100 p-3">
                  {u.planningGroupLabel ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-700">
                      <span className="inline-block h-3 w-3 rounded-full border border-zinc-300" style={{ backgroundColor: u.planningGroupColor ?? "#e5e7eb" }} />
                      {u.planningGroupLabel}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="border-b border-zinc-100 p-3 text-zinc-700">
                  {u.planningTemplateNumber ? `Trame ${u.planningTemplateNumber}` : <span className="text-zinc-400">—</span>}
                </td>
                <td className="border-b border-zinc-100 p-3 text-xs text-zinc-700">
                  {planningRhProfileLabelsFr[u.planningRhProfile]}
                </td>
                <td className="border-b border-zinc-100 p-3">
                  {u.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {u.skills.map((us) => (
                        <span key={us.skillId} className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                          {us.skill.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="border-b border-zinc-100 p-3">
                  {u.authUserId ? (
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Lie</span>
                  ) : (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">En attente</span>
                  )}
                </td>
                <td className="border-b border-zinc-100 p-3">
                  {u.active ? (
                    <span className="text-emerald-700">Oui</span>
                  ) : (
                    <span className="text-rose-700">Non</span>
                  )}
                </td>
                <td className="border-b border-zinc-100 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/agents/${u.id}`} className="text-xs font-medium text-zinc-700 underline hover:text-zinc-900">
                      Modifier
                    </Link>
                    {u.active ? (
                      <form action={setAgentActive} className="inline">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value="false" />
                        <button type="submit" className="text-xs font-medium text-rose-600 hover:text-rose-800">Desactiver</button>
                      </form>
                    ) : (
                      <form action={setAgentActive} className="inline">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value="true" />
                        <button type="submit" className="text-xs font-medium text-emerald-600 hover:text-emerald-800">Reactiver</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Formulaire creation ── */}
      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Nouvel agent</h2>
        <form action={createAgent} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="firstName">Prenom</label>
            <input id="firstName" name="firstName" required className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="lastName">Nom</label>
            <input id="lastName" name="lastName" required className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600" htmlFor="email">Email professionnel</label>
            <input id="email" name="email" type="email" required autoComplete="off" placeholder="prenom.nom@ght85.fr" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="workPercentage">Temps de travail (%)</label>
            <select id="workPercentage" name="workPercentage" defaultValue={100} className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm">
              <option value={100}>100 %</option>
              <option value={90}>90 %</option>
              <option value={80}>80 %</option>
              <option value={75}>75 %</option>
              <option value={70}>70 %</option>
              <option value={60}>60 %</option>
              <option value={50}>50 %</option>
            </select>
          </div>
          {showRolePicker ? (
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="role">Role</label>
              <select id="role" name="role" defaultValue={UserRole.AGENT} className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm">
                <option value={UserRole.AGENT}>Agent (lecture seule)</option>
                <option value={UserRole.CADRE}>Cadre</option>
                <option value={UserRole.REFERENT}>Referent</option>
                <option value={UserRole.ADMIN}>Administrateur</option>
              </select>
            </div>
          ) : (
            <input type="hidden" name="role" value={UserRole.AGENT} />
          )}
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningGroupLabel">Bloc / equipe</label>
            <input id="planningGroupLabel" name="planningGroupLabel" placeholder="Bloc jour" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningTemplateNumber">Numero de trame</label>
            <select
              id="planningTemplateNumber"
              name="planningTemplateNumber"
              defaultValue=""
              className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
            >
              <option value="">Aucune</option>
              {availableTemplateNumbers.map((n) => (
                <option key={n} value={n}>
                  Trame {n}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningRhProfile">Profil RH (CHD)</label>
            <select
              id="planningRhProfile"
              name="planningRhProfile"
              defaultValue={DEFAULT_PLANNING_RH_PROFILE}
              className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
            >
              {PLANNING_RH_PROFILES.map((profile) => (
                <option key={profile} value={profile}>
                  {planningRhProfileLabelsFr[profile]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <ColorPicker name="planningGroupColor" />
          </div>

          {allSkills.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-zinc-600">Competences</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {allSkills.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-sm text-zinc-700">
                    <input type="checkbox" name="skillIds" value={s.id} className="rounded border-zinc-300" />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
              Creer l&apos;agent
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
