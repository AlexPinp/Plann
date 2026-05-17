import { getSessionPrismaUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { AgentLeaveRequestsSection } from "./AgentLeaveRequestsSection";

type SearchProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ team: string }>;
};

export default async function DemandesPage({ searchParams, params }: SearchProps) {
  const { team: teamSlug } = await params;
  const me = await getSessionPrismaUser();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const created = sp.created === "1";
  const updated = sp.updated === "1";
  const cancelled = sp.cancelled === "1";

  if (!me) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6 md:p-10">
        <p className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning)]">
          Profil agent introuvable pour cette session. Reconnectez-vous ou contactez votre cadre.
        </p>
      </main>
    );
  }

  const leaveRequestDelegate = (prisma as unknown as {
    leaveRequest?: {
      findMany: typeof prisma.leaveRequest.findMany;
    };
  }).leaveRequest;

  if (!leaveRequestDelegate) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6 md:p-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">Demandes</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Module indisponible temporairement.</p>
        </div>
        <p className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning)]">
          Les demandes ne sont pas encore disponibles dans le client Prisma actif. Relancez le serveur de
          développement pour recharger le client.
        </p>
      </main>
    );
  }

  const requests = await leaveRequestDelegate.findMany({
    where: { userId: me.id },
    include: { decidedBy: true },
    orderBy: [{ createdAt: "desc" }, { startsAt: "desc" }],
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 md:p-10">
      <div className="mb-6">
        <h1 className="ui-page-title">Demandes</h1>
        <p className="ui-page-subtitle">Congés, RTT et autres absences — suivez l&apos;état de vos demandes.</p>
      </div>

      {created ? <p className="mb-4 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">Demande créée.</p> : null}
      {updated ? <p className="mb-4 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">Demande modifiée.</p> : null}
      {cancelled ? <p className="mb-4 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">Demande annulée.</p> : null}
      {error ? <p className="mb-4 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}

      <AgentLeaveRequestsSection teamSlug={teamSlug} requests={requests} />
    </main>
  );
}
