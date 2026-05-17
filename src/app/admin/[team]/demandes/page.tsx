import { notFound } from "next/navigation";
import type { LeaveRequestStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { leaveRequestsWhereUserInTeam } from "@/lib/leave-requests";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getTeamBySlug } from "@/lib/team";
import { AdminLeaveRequestsSection } from "./AdminLeaveRequestsSection";

type SearchProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ team: string }>;
};

export default async function AdminDemandesPage({ searchParams, params }: SearchProps) {
  await requireStaffAdmin();
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const updated = sp.updated === "1";
  const statusFilter =
    typeof sp.status === "string" &&
    (sp.status === "PENDING" || sp.status === "APPROVED" || sp.status === "REFUSED" || sp.status === "CANCELLED")
      ? sp.status
      : "ALL";

  const leaveRequestDelegate = (prisma as unknown as {
    leaveRequest?: {
      findMany: typeof prisma.leaveRequest.findMany;
    };
  }).leaveRequest;

  if (!leaveRequestDelegate) {
    return (
      <main>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Demandes agents</h1>
          <p className="mt-1 text-sm text-zinc-600">Module indisponible temporairement.</p>
        </div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Les demandes ne sont pas disponibles dans le client Prisma actif. Relancez le serveur de développement pour
          recharger le client.
        </p>
      </main>
    );
  }

  const scope = leaveRequestsWhereUserInTeam(team.id);
  const leaveRequests = await leaveRequestDelegate.findMany({
    where: {
      ...scope,
      ...(statusFilter === "ALL" ? {} : { status: statusFilter }),
    },
    include: { user: true, decidedBy: true },
    orderBy: [{ createdAt: "desc" }, { startsAt: "desc" }],
  });

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Demandes agents</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Demandes des agents qui sont membres de cette équipe. Une même personne peut apparaître dans plusieurs
          équipes : la demande est partagée ; une décision (validation ou refus) s&apos;applique partout.
        </p>
      </div>
      {updated ? <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Statut mis à jour.</p> : null}
      {error ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <AdminLeaveRequestsSection
        teamSlug={teamSlug}
        requests={leaveRequests}
        statusFilter={statusFilter as LeaveRequestStatus | "ALL"}
      />
    </main>
  );
}
