import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamJob, TeamRhythm } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { adminTeamPath } from "@/lib/routes";
import { getAllTeams, getTeamBySlug } from "@/lib/team";

type Props = { params: Promise<{ team: string }> };

function teamAxisShortLabel(team: { job: TeamJob; rhythm: TeamRhythm }): string {
  const job = team.job === TeamJob.IDE ? "IDE" : "AS";
  const rh = team.rhythm === TeamRhythm.JOUR ? "jour" : "nuit";
  return `${job} ${rh}`;
}

export default async function AgentsPage({ params }: Props) {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const agentsAdmin = adminTeamPath(teamSlug, "agents");
  const [axisTeams, memberships] = await Promise.all([
    getAllTeams(),
    prisma.userTeam.findMany({
      where: { teamId: team.id },
      include: {
        user: {
          include: {
            skills: { include: { skill: true } },
            availabilities: true,
            teams: { include: { team: true } },
          },
        },
      },
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
    }),
  ]);

  const teamById = new Map(axisTeams.map((t) => [t.id, t]));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Vue équipe</h1>
        <p className="text-sm text-zinc-600">
          Membres de {team.label} et compétences. Les rattachements IDE/AS · jour/nuit sont en lecture seule ici ; pour
          les modifier, ouvrez le{" "}
          <Link href={agentsAdmin} className="font-medium text-zinc-800 underline hover:text-zinc-950">
            panneau admin — Agents
          </Link>
          .
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-[680px] w-full border-collapse text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Nom</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">IDE/AS · jour/nuit</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Compétences</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">État</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((mem) => {
              const nurse = mem.user;
              const attached = nurse.teams
                .map((ut) => teamById.get(ut.teamId))
                .filter((t): t is NonNullable<typeof t> => Boolean(t))
                .sort((a, b) => a.displayOrder - b.displayOrder);
              return (
                <tr key={nurse.id}>
                  <td className="border-b border-zinc-100 p-3 font-medium text-zinc-800">
                    {nurse.firstName} {nurse.lastName}
                  </td>
                  <td className="border-b border-zinc-100 p-3 text-xs text-zinc-700">
                    {attached.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {attached.map((t) => (
                          <span
                            key={t.id}
                            className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-800"
                            title={t.label}
                          >
                            {teamAxisShortLabel(t)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="border-b border-zinc-100 p-3 text-zinc-700">
                    {nurse.skills.length ? nurse.skills.map((entry) => entry.skill.name).join(", ") : "Aucune"}
                  </td>
                  <td className="border-b border-zinc-100 p-3">
                    {nurse.availabilities.length ? (
                      <span className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
                        Indisponible
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                        Disponible
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
