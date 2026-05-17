import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getAllTeams, getTeamBySlug } from "@/lib/team";
import { getEditableTeamIds } from "@/lib/user-roles";
import { adminTeamPath } from "@/lib/routes";
import { EditAgentHeaderStatus } from "../_components/EditAgentHeaderStatus";
import { EditAgentMainForm } from "../_components/EditAgentMainForm";
import { EditAgentTeamsPanel } from "../_components/EditAgentTeamsPanel";

type Props = {
  params: Promise<{ team: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function FlashMessages({
  error,
  teamsUpdated,
  segmentSaved,
  segmentDeleted,
}: {
  error?: string;
  teamsUpdated: boolean;
  segmentSaved: boolean;
  segmentDeleted: boolean;
}) {
  const items: { key: string; className: string; text: string }[] = [];
  if (error) items.push({ key: "err", className: "bg-rose-50 text-rose-800", text: error });
  if (teamsUpdated)
    items.push({ key: "teams", className: "bg-emerald-50 text-emerald-800", text: "Équipes enregistrées." });
  if (segmentSaved)
    items.push({ key: "seg", className: "bg-emerald-50 text-emerald-800", text: "Segment enregistré." });
  if (segmentDeleted)
    items.push({ key: "del", className: "bg-emerald-50 text-emerald-800", text: "Segment supprimé." });

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5 px-4 py-2">
      {items.map((item) => (
        <p key={item.key} className={`rounded-md px-2.5 py-1.5 text-xs ${item.className}`}>
          {item.text}
        </p>
      ))}
    </div>
  );
}

export default async function EditAgentPage({ params, searchParams }: Props) {
  const actor = await requireStaffAdmin();
  const { team: teamSlug, id } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const teamsUpdated = sp.teamsUpdated === "1";
  const segmentSaved = sp.segmentSaved === "1";
  const segmentDeleted = sp.segmentDeleted === "1";

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

  const workRateSegments = await prisma.userWorkRateSegment.findMany({
    where: { userId: id },
    orderBy: { monthStartsOn: "desc" },
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
  const showInTeamPlanning = membership?.showInTeamPlanning ?? true;
  const showInAdminPlanning = membership?.showInAdminPlanning ?? true;
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
    <main className="mx-auto w-full max-w-2xl">
      <header className="mb-4 text-left">
        <Link href={agentsListPath} className="text-xs text-zinc-500 hover:text-zinc-800">
          &larr; Retour à la liste
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          {user.lastName.toUpperCase()} {user.firstName}
        </h1>
        <p className="text-xs text-zinc-500">{team.label}</p>
        <EditAgentHeaderStatus teamSlug={team.slug} userId={user.id} active={user.active} />
      </header>

      <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm divide-y divide-zinc-100">
        <FlashMessages
          error={error}
          teamsUpdated={teamsUpdated}
          segmentSaved={segmentSaved}
          segmentDeleted={segmentDeleted}
        />

        {user.authUserId ? (
          <p className="px-4 py-2 text-center text-xs text-amber-900 bg-amber-50">
            Email verrouillé (compte Supabase lié).
          </p>
        ) : null}

        <EditAgentTeamsPanel
          teamSlug={team.slug}
          userId={user.id}
          axisTeams={axisTeams}
          editableTeamIds={editableTeamIds}
          checkedTeamIds={teamIdsForUser}
        />

        <EditAgentMainForm
          teamSlug={team.slug}
          teamLabel={team.label}
          agentsListPath={agentsListPath}
          user={{
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            authUserId: user.authUserId,
            workPercentage: user.workPercentage,
            planningRhProfile: user.planningRhProfile,
            isAlternant: user.isAlternant,
            alternanceCycleWeeks: user.alternanceCycleWeeks,
            alternancePhase: user.alternancePhase,
            alternancePartnerId: user.alternancePartnerId,
          }}
          effBloc={effBloc}
          effBlocColor={effBlocColor}
          effTrame={effTrame}
          effTrameA={effTrameA}
          effTrameB={effTrameB}
          effLabelA={effLabelA}
          effLabelB={effLabelB}
          effRole={effRole}
          showInTeamPlanning={showInTeamPlanning}
          showInAdminPlanning={showInAdminPlanning}
          showRolePicker={showRolePicker}
          anchorDateInputValue={anchorDateInputValue}
          availableTemplateNumbers={availableTemplateNumbers}
          templateMetaByNumber={templateMetaByNumber}
          allSkills={allSkills}
          userSkillIds={userSkillIds}
          potentialPartners={potentialPartners}
          workRateSegments={workRateSegments}
        />
      </article>
    </main>
  );
}
