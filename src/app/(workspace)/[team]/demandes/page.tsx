import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSessionPrismaUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { cancelLeaveRequest, createLeaveRequest, updateLeaveRequest } from "./actions";

const LEAVE_REQUEST_TYPES = ["CA", "CF", "CH", "RTT", "REC", "AUTRE"] as const;
type LeaveRequestType = (typeof LEAVE_REQUEST_TYPES)[number];
type LeaveRequestStatus = "PENDING" | "APPROVED" | "REFUSED" | "CANCELLED";

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
        <h1 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">Demandes</h1>
        
      </div>

      {created ? <p className="mb-4 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">Demande créée.</p> : null}
      {updated ? <p className="mb-4 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">Demande modifiée.</p> : null}
      {cancelled ? <p className="mb-4 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">Demande annulée.</p> : null}
      {error ? <p className="mb-4 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}

      <section className="mb-6 rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--text)]">Nouvelle demande</h2>
        <form action={createLeaveRequest} className="mt-3 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="teamSlug" value={teamSlug} />
          <div className="md:col-span-2">
            <label htmlFor="type" className="mb-1 block text-xs font-medium text-[#333333]">
              Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue="CA"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
            >
              {LEAVE_REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {leaveTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <div>
              <label htmlFor="startsAt" className="mb-1 block text-xs font-medium text-[#333333]">
                Début
              </label>
              <input
                id="startsAt"
                name="startsAt"
                type="date"
                required
                className="w-full min-w-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
            <div>
              <label htmlFor="endsAt" className="mb-1 block text-xs font-medium text-[#333333]">
                Fin
              </label>
              <input
                id="endsAt"
                name="endsAt"
                type="date"
                required
                className="w-full min-w-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="note" className="mb-1 block text-xs font-medium text-[#333333]">
              Motif / note (optionnel)
            </label>
            <input
              id="note"
              name="note"
              type="text"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
              placeholder="Ex: congés d'été, RDV médical, etc."
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] sm:w-auto"
            >
              Envoyer la demande
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--text)]">Mes demandes</h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Aucune demande pour le moment.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-[var(--border)] text-sm">
              <thead>
                <tr className="bg-[var(--surface-soft)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Type</th>
                  <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Période</th>
                  <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Statut</th>
                  <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Détails</th>
                  <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
            {requests.map((request) => {
              const isPending = request.status === "PENDING";
              return (
                <tr key={request.id} className="align-top even:bg-[#fcfcfc]">
                  <td className="border-b border-[var(--border)] px-3 py-3 font-semibold text-[var(--text)]">{leaveTypeLabels[request.type]}</td>
                  <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--text)]">
                    <span className="font-hours text-xs">{format(request.startsAt, "dd/MM/yyyy", { locale: fr })}</span> au{" "}
                    <span className="font-hours text-xs">{format(request.endsAt, "dd/MM/yyyy", { locale: fr })}</span>
                  </td>
                  <td className="border-b border-[var(--border)] px-3 py-3">
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        request.status === "PENDING"
                          ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                          : request.status === "APPROVED"
                            ? "bg-[var(--success-soft)] text-[var(--success)]"
                            : request.status === "REFUSED"
                              ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                              : "bg-[#f1f1f1] text-[var(--text-muted)]",
                      ].join(" ")}
                    >
                      {leaveStatusLabels[request.status]}
                    </span>
                  </td>
                  <td className="border-b border-[var(--border)] px-3 py-3">
                    <p className="text-xs text-[var(--text-muted)]">
                      Demandée le <span className="font-hours">{format(request.createdAt, "dd/MM/yyyy à HH:mm", { locale: fr })}</span>
                    </p>
                    {request.note ? <p className="mt-1 text-sm text-[#333333]">Note: {request.note}</p> : null}
                    {request.decidedAt ? (
                    <div className="mt-2 rounded-md bg-[var(--surface-soft)] p-2 text-xs text-[var(--text-muted)]">
                      <p>
                        Decision le <span className="font-hours">{format(request.decidedAt, "dd/MM/yyyy à HH:mm", { locale: fr })}</span> par{" "}
                        {request.decidedByName ??
                          (request.decidedBy
                            ? `${request.decidedBy.lastName.toUpperCase()} ${request.decidedBy.firstName}`
                            : "—")}
                      </p>
                      {request.decisionNote ? <p className="mt-1">Commentaire: {request.decisionNote}</p> : null}
                    </div>
                  ) : null}
                  </td>
                  <td className="border-b border-[var(--border)] px-3 py-3">
                    {isPending ? (
                      <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Modifier</p>
                      <form action={updateLeaveRequest} className="grid gap-2">
                        <input type="hidden" name="teamSlug" value={teamSlug} />
                        <input type="hidden" name="id" value={request.id} />
                        <select
                          name="type"
                          defaultValue={request.type}
                          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                        >
                          {LEAVE_REQUEST_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {leaveTypeLabels[type]}
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            name="startsAt"
                            defaultValue={format(request.startsAt, "yyyy-MM-dd")}
                            className="min-w-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                            required
                          />
                          <input
                            type="date"
                            name="endsAt"
                            defaultValue={format(request.endsAt, "yyyy-MM-dd")}
                            className="min-w-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                            required
                          />
                        </div>
                        <input
                          type="text"
                          name="note"
                          defaultValue={request.note ?? ""}
                          placeholder="Note (optionnel)"
                          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] sm:w-auto"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </form>
                      <form action={cancelLeaveRequest}>
                        <input type="hidden" name="teamSlug" value={teamSlug} />
                        <input type="hidden" name="id" value={request.id} />
                        <button
                          type="submit"
                          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-soft)] sm:w-auto"
                        >
                          Annuler la demande
                        </button>
                      </form>
                    </div>
                  ) : null}
                  </td>
                </tr>
              );
            })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
