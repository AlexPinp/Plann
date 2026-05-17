import { notFound } from "next/navigation";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getAllTeams, getTeamBySlug } from "@/lib/team";
import { teamAxisShortLabel } from "@/lib/team-axis-label";
import { getEditableTeamIds } from "@/lib/user-roles";
import { adminTeamPath } from "@/lib/routes";
import { roleLabelsFr } from "@/lib/user-roles";
import { AgentsList, type AgentListItem } from "./_components/AgentsList";
import { CreateAgentForm } from "./_components/CreateAgentForm";
import { CreateAgentCollapsible } from "./CreateAgentCollapsible";

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

  const agentListItems: AgentListItem[] = sortedMemberships.map((mem) => {
    const u = mem.user;
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      active: u.active,
      roleInTeam: mem.roleInTeam,
      planningGroupLabel: mem.planningGroupLabel ?? u.planningGroupLabel,
      planningGroupColor: mem.planningGroupColor ?? u.planningGroupColor,
      teams: u.teams.map((ut) => ({
        id: ut.team.id,
        job: ut.team.job,
        rhythm: ut.team.rhythm,
        displayOrder: ut.team.displayOrder,
      })),
      skills: u.skills.map((us) => us.skill.name).sort((a, b) => a.localeCompare(b, "fr")),
    };
  });

  const showRolePicker = actor.role === UserRole.ADMIN;

  return (
    <main className="mx-auto w-full max-w-3xl">
      <header className="mb-6 text-left">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Agents</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {agentListItems.length} membre{agentListItems.length !== 1 ? "s" : ""} sur {team.label}
        </p>
      </header>

      {created && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Agent créé.</p>}
      {updated && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Fiche mise à jour.</p>}
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      <CreateAgentCollapsible>
        <CreateAgentForm
          teamSlug={team.slug}
          teamLabel={team.label}
          pageTeamId={team.id}
          axisTeams={axisTeams}
          editableTeamIds={editableTeamIds}
          allSkills={allSkills}
          availableTemplateNumbers={availableTemplateNumbers}
          templateMetaByNumber={templateMetaByNumber}
          showRolePicker={showRolePicker}
        />
      </CreateAgentCollapsible>

      <AgentsList agents={agentListItems} agentsBase={agentsBase} sortKey={sortKey} sortDir={sortDir} />
    </main>
  );
}
