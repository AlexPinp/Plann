import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamJob, TeamRhythm, UserRole } from "@/generated/prisma/enums";
import { ColorPicker } from "@/components/ColorPicker";
import { PLANNING_RH_PROFILES, planningRhProfileLabelsFr } from "@/lib/planning-rh";
import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getAllTeams, getTeamBySlug } from "@/lib/team";
import { getEditableTeamIds, roleLabelsFr } from "@/lib/user-roles";
import { adminTeamPath } from "@/lib/routes";
import { normalizeTemplateCycleWeeks } from "@/lib/planning-template";
import { setAgentActive, updateAgent, updateAgentTeamMemberships } from "../actions";

function teamAxisShortLabel(team: { job: TeamJob; rhythm: TeamRhythm }): string {
  const job = team.job === TeamJob.IDE ? "IDE" : "AS";
  const rh = team.rhythm === TeamRhythm.JOUR ? "jour" : "nuit";
  return `${job} ${rh}`;
}

type Props = {
  params: Promise<{ team: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditAgentPage({ params, searchParams }: Props) {
  const actor = await requireStaffAdmin();
  const { team: teamSlug, id } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const teamsUpdated = sp.teamsUpdated === "1";

  const [user, allSkills, templatesMeta, allUsers, axisTeams, editableTeamIds, userTeamRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { skills: { select: { skillId: true } } },
    }),
    prisma.skill.findMany({ orderBy: { name: "asc" } }),
    prisma.planningTemplate.findMany({
      where: { teamId: team.id },
      select: { number: true, cycleWeeks: true },
      orderBy: { number: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, firstName: true, lastName: true, alternancePartnerId: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    getAllTeams(),
    getEditableTeamIds(actor.id, actor.role),
    prisma.userTeam.findMany({ where: { userId: id }, select: { teamId: true } }),
  ]);

  if (!user) notFound();

  const teamIdsForUser = new Set(userTeamRows.map((r) => r.teamId));

  const membership = await prisma.userTeam.findUnique({
    where: { userId_teamId: { userId: id, teamId: team.id } },
  });

  const userSkillIds = new Set(user.skills.map((us) => us.skillId));
  const agentsListPath = adminTeamPath(team.slug, "agents");

  const effBloc = membership?.planningGroupLabel ?? user.planningGroupLabel;
  const effBlocColor = membership?.planningGroupColor ?? user.planningGroupColor;
  const effTrame = membership?.planningTemplateNumber ?? user.planningTemplateNumber;
  const effTrameA = membership?.planningTemplateNumberA ?? user.planningTemplateNumberA;
  const effTrameB = membership?.planningTemplateNumberB ?? user.planningTemplateNumberB;
  const effLabelA = membership?.planningGroupLabelA ?? user.planningGroupLabelA;
  const effLabelB = membership?.planningGroupLabelB ?? user.planningGroupLabelB;
  const effDisplayOrder = membership?.displayOrder ?? user.displayOrder;
  const effRole = membership?.roleInTeam ?? user.role;
  const showRolePicker = actor.role === UserRole.ADMIN;
  const templateMetaByNumber = new Map(templatesMeta.map((t) => [t.number, t]));
  const availableTemplateNumbers = Array.from(
    new Set([
      ...templatesMeta.map((row) => row.number),
      ...(effTrame ? [effTrame] : []),
      ...(effTrameA ? [effTrameA] : []),
      ...(effTrameB ? [effTrameB] : []),
    ]),
  ).sort((a, b) => a - b);
  const potentialPartners = allUsers.filter((candidate) => candidate.id !== user.id);
  const anchorDateInputValue = user.alternanceAnchorDate
    ? `${user.alternanceAnchorDate.getUTCFullYear()}-${String(user.alternanceAnchorDate.getUTCMonth() + 1).padStart(2, "0")}-${String(user.alternanceAnchorDate.getUTCDate()).padStart(2, "0")}`
    : "";

  return (
    <main>
      <Link href={agentsListPath} className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Liste des agents
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-zinc-900 sm:text-2xl">
        Modifier {user.lastName.toUpperCase()} {user.firstName}
      </h1>

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {teamsUpdated && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Rattachements equipes mis a jour.
        </p>
      )}

      {user.authUserId && (
        <p className="mt-3 text-sm text-amber-800">
          Compte deja lie a Supabase : l&apos;email ne peut pas etre modifie ici.
        </p>
      )}

      <section className="mt-6 max-w-2xl rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Activation du compte agent</h2>
        <p className="mt-1 text-xs text-zinc-600">
          La desactivation/reactivation se fait ici.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {user.active ? (
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Actif</span>
          ) : (
            <span className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">Inactif</span>
          )}
          <form action={setAgentActive}>
            <input type="hidden" name="teamSlug" value={team.slug} />
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="active" value={user.active ? "false" : "true"} />
            <button
              type="submit"
              className={[
                "rounded-lg px-4 py-2 text-sm font-medium",
                user.active
                  ? "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
              ].join(" ")}
            >
              {user.active ? "Desactiver l'agent" : "Reactiver l'agent"}
            </button>
          </form>
        </div>
      </section>

      <section className="mt-6 max-w-2xl rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Rattachement IDE/AS · jour/nuit</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Cochez toutes les equipes auxquelles la personne appartient. Les cases grisees ne sont pas modifiables avec vos
          droits.
        </p>
        <form action={updateAgentTeamMemberships} className="mt-4">
          <input type="hidden" name="teamSlug" value={team.slug} />
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="afterMembership" value="detail" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {axisTeams.map((t) => {
              const checked = teamIdsForUser.has(t.id);
              const canEdit = editableTeamIds.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={[
                    "flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-xs text-zinc-800",
                    !canEdit ? "cursor-not-allowed opacity-50" : "",
                  ].join(" ")}
                  title={t.label}
                >
                  <input
                    type="checkbox"
                    name="membershipTeamId"
                    value={t.id}
                    defaultChecked={checked}
                    disabled={!canEdit}
                    className="rounded border-zinc-300"
                  />
                  <span>{teamAxisShortLabel(t)}</span>
                </label>
              );
            })}
          </div>
          <button
            type="submit"
            className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Enregistrer les equipes
          </button>
        </form>
      </section>

      <form action={updateAgent} className="mt-6 max-w-2xl space-y-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="teamSlug" value={team.slug} />
        <input type="hidden" name="id" value={user.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="firstName">Prenom</label>
            <input id="firstName" name="firstName" required defaultValue={user.firstName} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="lastName">Nom</label>
            <input id="lastName" name="lastName" required defaultValue={user.lastName} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor="email">Email professionnel</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            readOnly={!!user.authUserId}
            aria-readonly={!!user.authUserId}
            defaultValue={user.email}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm read-only:bg-zinc-100 read-only:text-zinc-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="workPercentage">Temps de travail (%)</label>
            <select id="workPercentage" name="workPercentage" defaultValue={user.workPercentage} className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm">
              <option value={100}>100 %</option>
              <option value={90}>90 %</option>
              <option value={80}>80 %</option>
              <option value={75}>75 %</option>
              <option value={70}>70 %</option>
              <option value={60}>60 %</option>
              <option value={50}>50 %</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningGroupLabel">Bloc / equipe</label>
            <input id="planningGroupLabel" name="planningGroupLabel" defaultValue={effBloc ?? ""} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <p className="mt-1 text-[11px] text-zinc-500">Libelle interne (grille planning). Independ du secteur Organisation.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningTemplateNumber">Numero de trame</label>
            <select
              id="planningTemplateNumber"
              name="planningTemplateNumber"
              defaultValue={effTrame ?? ""}
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
              defaultValue={user.planningRhProfile}
              className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
            >
              {PLANNING_RH_PROFILES.map((profile) => (
                <option key={profile} value={profile}>
                  {planningRhProfileLabelsFr[profile]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800">
            <input
              type="checkbox"
              name="isAlternant"
              defaultChecked={user.isAlternant}
              className="rounded border-zinc-300"
            />
            Agent alternant (A/B)
          </label>
          <p className="mt-1 text-[11px] text-zinc-600">
            Configurez les 2 etats (A et B), la duree du cycle et le binome.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="alternanceCycleWeeks">Duree d&apos;un bloc (semaines)</label>
              <input
                id="alternanceCycleWeeks"
                name="alternanceCycleWeeks"
                type="number"
                min={1}
                max={52}
                defaultValue={user.alternanceCycleWeeks}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="alternanceAnchorDate">Date d&apos;ancrage (debut cycle)</label>
              <input
                id="alternanceAnchorDate"
                name="alternanceAnchorDate"
                type="date"
                defaultValue={anchorDateInputValue}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="alternancePhase">Phase binome</label>
              <select
                id="alternancePhase"
                name="alternancePhase"
                defaultValue={String(user.alternancePhase)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="0">Phase 0 (A au demarrage)</option>
                <option value="1">Phase 1 (B au demarrage)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="alternancePartnerId">Binome alternant</label>
              <select
                id="alternancePartnerId"
                name="alternancePartnerId"
                defaultValue={user.alternancePartnerId ?? ""}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Aucun</option>
                {potentialPartners.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.lastName.toUpperCase()} {candidate.firstName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="planningTemplateNumberA">Trame A</label>
              <select
                id="planningTemplateNumberA"
                name="planningTemplateNumberA"
                defaultValue={effTrameA ?? ""}
                className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
              >
                <option value="">Aucune</option>
                {availableTemplateNumbers.map((n) => {
                  const meta = templateMetaByNumber.get(n);
                  return (
                    <option key={`a-${n}`} value={n}>
                      Trame {n}
                      {meta ? ` (${normalizeTemplateCycleWeeks(meta.cycleWeeks)} sem.)` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="planningTemplateNumberB">Trame B</label>
              <select
                id="planningTemplateNumberB"
                name="planningTemplateNumberB"
                defaultValue={effTrameB ?? ""}
                className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
              >
                <option value="">Aucune</option>
                {availableTemplateNumbers.map((n) => {
                  const meta = templateMetaByNumber.get(n);
                  return (
                    <option key={`b-${n}`} value={n}>
                      Trame {n}
                      {meta ? ` (${normalizeTemplateCycleWeeks(meta.cycleWeeks)} sem.)` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="planningGroupLabelA">Equipe / bloc A</label>
              <input
                id="planningGroupLabelA"
                name="planningGroupLabelA"
                defaultValue={effLabelA ?? ""}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="planningGroupLabelB">Equipe / bloc B</label>
              <input
                id="planningGroupLabelB"
                name="planningGroupLabelB"
                defaultValue={effLabelB ?? ""}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <ColorPicker name="planningGroupColor" defaultValue={effBlocColor} />

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor="displayOrder">Ordre d&apos;affichage</label>
          <input id="displayOrder" name="displayOrder" type="number" min={0} defaultValue={effDisplayOrder} className="mt-1 w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          <p className="mt-1 text-[11px] text-zinc-500">Plus petit = plus haut dans la grille planning.</p>
        </div>

        {showRolePicker ? (
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue={effRole} className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm">
              <option value={UserRole.AGENT}>{roleLabelsFr[UserRole.AGENT]}</option>
              <option value={UserRole.CADRE}>Cadre</option>
              <option value={UserRole.REFERENT}>Referent</option>
              <option value={UserRole.ADMIN}>Administrateur</option>
            </select>
          </div>
        ) : (
          <input type="hidden" name="role" value={effRole} />
        )}

        {allSkills.length > 0 && (
          <div>
            <p className="text-xs font-medium text-zinc-600">Competences / secteurs</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Cochez les secteurs ou l&apos;agent peut etre affecte.</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {allSkills.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    name="skillIds"
                    value={s.id}
                    defaultChecked={userSkillIds.has(s.id)}
                    className="rounded border-zinc-300"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Enregistrer
          </button>
          <Link href={agentsListPath} className="text-sm text-zinc-500 hover:text-zinc-800">Annuler</Link>
        </div>
      </form>
    </main>
  );
}
