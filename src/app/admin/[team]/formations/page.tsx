import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamBySlug } from "@/lib/team";
import { FormationsMatrix, type AgentRow, type CompletionCell, type TrainingColumn } from "./FormationsMatrix";

type Props = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function agentLabel(lastName: string, firstName: string): string {
  return `${lastName.toUpperCase()} ${firstName}`;
}

export default async function AdminFormationsPage({ params, searchParams }: Props) {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const created = sp.created === "1";
  const updated = sp.updated === "1";
  const deleted = sp.deleted === "1";

  const delegates = prisma as unknown as {
    teamTrainingType?: {
      findMany: typeof prisma.teamTrainingType.findMany;
    };
    userTrainingCompletion?: {
      findMany: typeof prisma.userTrainingCompletion.findMany;
    };
  };

  if (!delegates.teamTrainingType || !delegates.userTrainingCompletion) {
    return (
      <main>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Formations</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Suivi des formations obligatoires pour l&apos;équipe {team.label}.
          </p>
        </div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Module indisponible temporairement. Relancez le serveur de développement pour recharger le client Prisma.
        </p>
      </main>
    );
  }

  const [memberships, trainingTypes, completions] = await Promise.all([
    prisma.userTeam.findMany({
      where: { teamId: team.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, active: true } } },
      orderBy: [{ displayOrder: "asc" }, { user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
    }),
    delegates.teamTrainingType.findMany({
      where: { teamId: team.id },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    delegates.userTrainingCompletion.findMany({
      where: { trainingType: { teamId: team.id } },
      select: { userId: true, trainingTypeId: true, lastCompletedAt: true },
    }),
  ]);

  const agents: AgentRow[] = memberships.map((m) => ({
    id: m.user.id,
    label: agentLabel(m.user.lastName, m.user.firstName),
  }));

  const trainings: TrainingColumn[] = trainingTypes.map((t) => ({
    id: t.id,
    name: t.name,
    recurrenceMonths: t.recurrenceMonths,
  }));

  const completionRows: CompletionCell[] = completions.map((c) => ({
    userId: c.userId,
    trainingTypeId: c.trainingTypeId,
    lastCompletedAt: c.lastCompletedAt ? c.lastCompletedAt.toISOString() : null,
  }));

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Formations</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Suivi des formations obligatoires pour l&apos;équipe {team.label}.
        </p>
      </div>

      {created ? (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Formation ajoutée.</p>
      ) : null}
      {updated ? (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Formation mise à jour.</p>
      ) : null}
      {deleted ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Formation supprimée.</p>
      ) : null}
      {error ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 px-4 sm:px-6">
        <FormationsMatrix
          teamSlug={teamSlug}
          trainings={trainings}
          agents={agents}
          completions={completionRows}
        />
      </div>
    </main>
  );
}
