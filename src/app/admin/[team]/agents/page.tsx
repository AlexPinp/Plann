import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamJob, TeamRhythm, UserRole } from "@/generated/prisma/enums";
import { ColorPicker } from "@/components/ColorPicker";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLANNING_RH_PROFILE, PLANNING_RH_PROFILES, planningRhProfileLabelsFr } from "@/lib/planning-rh";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getAllTeams, getTeamBySlug } from "@/lib/team";
import { getEditableTeamIds } from "@/lib/user-roles";
import { adminTeamPath } from "@/lib/routes";
import { roleLabelsFr } from "@/lib/user-roles";
import { normalizeTemplateCycleWeeks } from "@/lib/planning-template";
import { createAgent } from "./actions";
import { CreateAgentCollapsible } from "./CreateAgentCollapsible";

function teamAxisShortLabel(team: { job: TeamJob; rhythm: TeamRhythm }): string {
  const job = team.job === TeamJob.IDE ? "IDE" : "AS";
  const rh = team.rhythm === TeamRhythm.JOUR ? "jour" : "nuit";
  return `${job} ${rh}`;
}

type Props = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AgentSortKey = "agent" | "role" | "equipe" | "bloc" | "competences" | "actif";
type SortDir = "asc" | "desc";

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function parseSortKey(raw: string): AgentSortKey {
  if (
    raw === "agent" ||
    raw === "role" ||
    raw === "equipe" ||
    raw === "bloc" ||
    raw === "competences" ||
    raw === "actif"
  ) {
    return raw;
  }
  return "agent";
}

function parseSortDir(raw: string): SortDir {
  return raw === "desc" ? "desc" : "asc";
}

export default async function AdminAgentsPage({ params, searchParams }: Props) {
  const actor = await requireStaffAdmin();
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const created = sp.created === "1";
  const updated = sp.updated === "1";
  const sortKey = parseSortKey(getSingleParam(sp.sort));
  const sortDir = parseSortDir(getSingleParam(sp.dir));

  const agentsBase = adminTeamPath(team.slug, "agents");

  const [memberships, allSkills, templatesMeta, axisTeams, editableTeamIds] = await Promise.all([
    prisma.userTeam.findMany({
      where: { teamId: team.id },
      include: {
        user: {
          include: {
            skills: { include: { skill: true } },
            teams: { include: { team: true } },
          },
        },
      },
    }),
    prisma.skill.findMany({ orderBy: { name: "asc" } }),
    prisma.planningTemplate.findMany({
      where: { teamId: team.id },
      select: { number: true, cycleWeeks: true, label: true },
      orderBy: { number: "asc" },
    }),
    getAllTeams(),
    getEditableTeamIds(actor.id, actor.role),
  ]);

  const templateMetaByNumber = new Map(templatesMeta.map((t) => [t.number, t]));

  const availableTemplateNumbers = Array.from(
    new Set([
      ...templatesMeta.map((row) => row.number),
      ...memberships.map((m) => m.planningTemplateNumber).filter((n): n is number => n !== null),
    ]),
  ).sort((a, b) => a - b);

  const sortedMemberships = [...memberships].sort((ma, mb) => {
    const a = ma.user;
    const b = mb.user;
    const aAxes = a.teams
      .map((ut) => teamAxisShortLabel(ut.team))
      .sort((x, y) => x.localeCompare(y, "fr", { sensitivity: "base" }))
      .join(" | ");
    const bAxes = b.teams
      .map((ut) => teamAxisShortLabel(ut.team))
      .sort((x, y) => x.localeCompare(y, "fr", { sensitivity: "base" }))
      .join(" | ");
    const bloc = (m: typeof ma) => m.planningGroupLabel ?? m.user.planningGroupLabel ?? "";
    const aSkills = a.skills.map((us) => us.skill.name).sort().join(", ");
    const bSkills = b.skills.map((us) => us.skill.name).sort().join(", ");
    const aAgent = `${a.lastName} ${a.firstName}`.toLowerCase();
    const bAgent = `${b.lastName} ${b.firstName}`.toLowerCase();
    const cmp = (() => {
      if (sortKey === "agent") return aAgent.localeCompare(bAgent);
      if (sortKey === "role") return roleLabelsFr[ma.roleInTeam].localeCompare(roleLabelsFr[mb.roleInTeam]);
      if (sortKey === "equipe") return aAxes.localeCompare(bAxes, "fr", { sensitivity: "base" });
      if (sortKey === "bloc") return bloc(ma).localeCompare(bloc(mb));
      if (sortKey === "competences") return aSkills.localeCompare(bSkills);
      return Number(a.active) - Number(b.active);
    })();
    if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
    return aAgent.localeCompare(bAgent);
  });

  function sortHref(key: AgentSortKey) {
    const nextDir: SortDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    return `${agentsBase}?sort=${key}&dir=${nextDir}`;
  }

  function sortLabel(key: AgentSortKey, label: string) {
    const arrow = sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "";
    return `${label} ${arrow}`.trim();
  }

  const showRolePicker = actor.role === UserRole.ADMIN;

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Agents</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Gerez les agents et leurs competences.
        </p>
      </div>

      {created && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Agent cree.</p>}
      {updated && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Fiche mise a jour.</p>}
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {/* ── Liste agents ── */}
      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] border-collapse text-sm">
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
                <Link href={sortHref("equipe")} className="hover:text-zinc-900">
                  {sortLabel("equipe", "Equipe")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("bloc")} className="hover:text-zinc-900">
                  {sortLabel("bloc", "Bloc")}
                </Link>
              </th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">
                <Link href={sortHref("competences")} className="hover:text-zinc-900">
                  {sortLabel("competences", "Competences")}
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
            {sortedMemberships.map((mem) => {
              const u = mem.user;
              const blocLabel = mem.planningGroupLabel ?? u.planningGroupLabel;
              const blocColor = mem.planningGroupColor ?? u.planningGroupColor;
              return (
              <tr key={u.id} className={!u.active ? "bg-zinc-50 opacity-60" : ""}>
                <td className="border-b border-zinc-100 p-3">
                  <div className="font-medium text-zinc-900">{u.lastName.toUpperCase()} {u.firstName}</div>
                  <div className="text-xs text-zinc-500">{u.email}</div>
                </td>
                <td className="border-b border-zinc-100 p-3 text-zinc-600">{roleLabelsFr[mem.roleInTeam]}</td>
                <td className="border-b border-zinc-100 p-3 text-xs text-zinc-700">
                  {u.teams.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {u.teams
                        .map((ut) => ut.team)
                        .sort((a, b) => a.displayOrder - b.displayOrder)
                        .map((axisTeam) => (
                          <span
                            key={axisTeam.id}
                            className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-800"
                            title={axisTeam.label}
                          >
                            {teamAxisShortLabel(axisTeam)}
                          </span>
                        ))}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="border-b border-zinc-100 p-3">
                  {blocLabel ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-700">
                      <span className="inline-block h-3 w-3 rounded-full border border-zinc-300" style={{ backgroundColor: blocColor ?? "#e5e7eb" }} />
                      {blocLabel}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
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
                  {u.active ? (
                    <span className="text-emerald-700">Oui</span>
                  ) : (
                    <span className="text-rose-700">Non</span>
                  )}
                </td>
                <td className="border-b border-zinc-100 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`${agentsBase}/${u.id}`} className="text-xs font-medium text-zinc-700 underline hover:text-zinc-900">
                      Modifier
                    </Link>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── Formulaire creation (replie par defaut) ── */}
      <CreateAgentCollapsible>
        <form action={createAgent} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="teamSlug" value={team.slug} />
          <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
            <p className="text-xs font-medium text-zinc-700">Rattachement IDE/AS · jour/nuit</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Cochez toutes les equipes auxquelles la personne appartient. La trame et le bloc ci-dessous s&apos;appliquent
              a l&apos;equipe de cette page ({team.label}).
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {axisTeams.map((t) => {
                const canEdit = editableTeamIds.includes(t.id);
                const isPageTeam = t.id === team.id;
                return (
                  <label
                    key={t.id}
                    className={[
                      "flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800",
                      !canEdit ? "cursor-not-allowed opacity-50" : "",
                    ].join(" ")}
                    title={t.label}
                  >
                    <input
                      type="checkbox"
                      name="initialTeamId"
                      value={t.id}
                      defaultChecked={isPageTeam}
                      disabled={!canEdit}
                      className="rounded border-zinc-300"
                    />
                    <span>{teamAxisShortLabel(t)}</span>
                  </label>
                );
              })}
            </div>
          </div>
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
                <option value={UserRole.AGENT}>{roleLabelsFr[UserRole.AGENT]}</option>
                <option value={UserRole.CADRE}>Cadre</option>
                <option value={UserRole.REFERENT}>Referent</option>
                <option value={UserRole.ADMIN}>Administrateur</option>
              </select>
            </div>
          ) : (
            <input type="hidden" name="role" value={UserRole.AGENT} />
          )}
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningGroupLabel">Equipe</label>
            <input id="planningGroupLabel" name="planningGroupLabel" placeholder="A / B / C / CDS / etc." className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningTemplateNumber">Numéro de trame</label>
            <select
              id="planningTemplateNumber"
              name="planningTemplateNumber"
              defaultValue=""
              className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
            >
              <option value="">Aucune</option>
              {availableTemplateNumbers.map((n) => {
                const meta = templateMetaByNumber.get(n);
                return (
                  <option key={n} value={n}>
                    Trame {n}
                    {meta ? ` (${normalizeTemplateCycleWeeks(meta.cycleWeeks)} sem.)` : ""}
                  </option>
                );
              })}
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
      </CreateAgentCollapsible>
    </main>
  );
}
