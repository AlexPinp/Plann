import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { notFound } from "next/navigation";
import type { LeaveRequestStatus, LeaveRequestType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { leaveRequestsWhereUserInTeam } from "@/lib/leave-requests";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getTeamBySlug } from "@/lib/team";
import { decideLeaveRequest } from "./actions";

const leaveTypeLabels: Record<LeaveRequestType, string> = {
  CA: "CA",
  CF: "CF",
  CH: "CH",
  RTT: "RTT",
  REC: "REC",
  AUTRE: "Autre",
};

const leaveStatusLabels: Record<LeaveRequestStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Validée",
  REFUSED: "Refusée",
  CANCELLED: "Annulée",
};

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

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <label htmlFor="status" className="mr-2 text-xs font-medium text-zinc-700">
          Filtrer
        </label>
        <select
          id="status"
          name="status"
          defaultValue={statusFilter}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 sm:w-auto"
        >
          <option value="ALL">Toutes</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Validées</option>
          <option value="REFUSED">Refusées</option>
          <option value="CANCELLED">Annulées</option>
        </select>
        <button
          type="submit"
          className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
        >
          Appliquer
        </button>
      </form>

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Agent</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Type</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Période demandée</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Date de demande</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Statut</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Note agent</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Historique décision</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-sm text-zinc-500">
                  Aucune demande.
                </td>
              </tr>
            ) : (
              leaveRequests.map((request) => (
                <tr key={request.id}>
                  <td className="border-b border-zinc-100 p-3 text-zinc-900">
                    <div className="font-medium">
                      {request.user.lastName.toUpperCase()} {request.user.firstName}
                    </div>
                    <div className="text-xs text-zinc-500">{request.user.email}</div>
                  </td>
                  <td className="border-b border-zinc-100 p-3 text-zinc-700">{leaveTypeLabels[request.type]}</td>
                  <td className="border-b border-zinc-100 p-3 text-zinc-700">
                    {format(request.startsAt, "dd/MM/yyyy", { locale: fr })} -{" "}
                    {format(request.endsAt, "dd/MM/yyyy", { locale: fr })}
                  </td>
                  <td className="border-b border-zinc-100 p-3 text-zinc-700">
                    {format(request.createdAt, "dd/MM/yyyy à HH:mm", { locale: fr })}
                  </td>
                  <td className="border-b border-zinc-100 p-3">
                    <span
                      className={[
                        "rounded px-2 py-0.5 text-xs font-medium",
                        request.status === "PENDING"
                          ? "bg-amber-100 text-amber-900"
                          : request.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : request.status === "REFUSED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-zinc-100 text-zinc-700",
                      ].join(" ")}
                    >
                      {leaveStatusLabels[request.status]}
                    </span>
                  </td>
                  <td className="border-b border-zinc-100 p-3 text-zinc-700">{request.note ?? "—"}</td>
                  <td className="border-b border-zinc-100 p-3 text-zinc-700">
                    {request.decidedAt ? (
                      <div className="text-xs">
                        <div>{format(request.decidedAt, "dd/MM/yyyy à HH:mm", { locale: fr })}</div>
                        <div className="text-zinc-500">
                          par{" "}
                          {request.decidedByName ??
                            (request.decidedBy
                              ? `${request.decidedBy.lastName.toUpperCase()} ${request.decidedBy.firstName}`
                              : "—")}
                        </div>
                        {request.decisionNote ? <div className="mt-1 text-zinc-600">{request.decisionNote}</div> : null}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">Pas encore traitée</span>
                    )}
                  </td>
                  <td className="border-b border-zinc-100 p-3">
                    {request.status === "PENDING" ? (
                      <form action={decideLeaveRequest} className="flex min-w-[220px] flex-col gap-2">
                        <input type="hidden" name="teamSlug" value={teamSlug} />
                        <input type="hidden" name="id" value={request.id} />
                        <input
                          type="text"
                          name="decisionNote"
                          placeholder="Commentaire (optionnel)"
                          className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-900"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            name="decision"
                            value="APPROVED"
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            Valider
                          </button>
                          <button
                            type="submit"
                            name="decision"
                            value="REFUSED"
                            className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                          >
                            Refuser
                          </button>
                        </div>
                      </form>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
