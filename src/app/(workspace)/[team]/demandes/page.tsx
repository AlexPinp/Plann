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
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Demandes</h1>
          <p className="mt-1 text-sm text-zinc-600">Module indisponible temporairement.</p>
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Demandes</h1>
        
      </div>

      {created ? <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Demande créée.</p> : null}
      {updated ? <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Demande modifiée.</p> : null}
      {cancelled ? <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Demande annulée.</p> : null}
      {error ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Nouvelle demande</h2>
        <form action={createLeaveRequest} className="mt-3 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="teamSlug" value={teamSlug} />
          <div className="md:col-span-2">
            <label htmlFor="type" className="mb-1 block text-xs font-medium text-zinc-700">
              Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue="CA"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
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
              <label htmlFor="startsAt" className="mb-1 block text-xs font-medium text-zinc-700">
                Début
              </label>
              <input
                id="startsAt"
                name="startsAt"
                type="date"
                required
                className="w-full min-w-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="endsAt" className="mb-1 block text-xs font-medium text-zinc-700">
                Fin
              </label>
              <input
                id="endsAt"
                name="endsAt"
                type="date"
                required
                className="w-full min-w-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="note" className="mb-1 block text-xs font-medium text-zinc-700">
              Motif / note (optionnel)
            </label>
            <input
              id="note"
              name="note"
              type="text"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              placeholder="Ex: congés d'été, RDV médical, etc."
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
            >
              Envoyer la demande
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Mes demandes</h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Aucune demande pour le moment.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {requests.map((request) => {
              const isPending = request.status === "PENDING";
              return (
                <article key={request.id} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">
                      {leaveTypeLabels[request.type]} - du {format(request.startsAt, "dd/MM/yyyy", { locale: fr })} au{" "}
                      {format(request.endsAt, "dd/MM/yyyy", { locale: fr })}
                    </p>
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
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Demandée le {format(request.createdAt, "dd/MM/yyyy à HH:mm", { locale: fr })}
                  </p>
                  {request.note ? <p className="mt-1 text-sm text-zinc-700">Note: {request.note}</p> : null}
                  {request.decidedAt ? (
                    <div className="mt-2 rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
                      <p>
                        Décision le {format(request.decidedAt, "dd/MM/yyyy à HH:mm", { locale: fr })} par{" "}
                        {request.decidedByName ??
                          (request.decidedBy
                            ? `${request.decidedBy.lastName.toUpperCase()} ${request.decidedBy.firstName}`
                            : "—")}
                      </p>
                      {request.decisionNote ? <p className="mt-1">Commentaire: {request.decisionNote}</p> : null}
                    </div>
                  ) : null}

                  {isPending ? (
                    <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Modifier la demande</p>
                      <form action={updateLeaveRequest} className="grid gap-2 md:grid-cols-2">
                        <input type="hidden" name="teamSlug" value={teamSlug} />
                        <input type="hidden" name="id" value={request.id} />
                        <select
                          name="type"
                          defaultValue={request.type}
                          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 md:col-span-2"
                        >
                          {LEAVE_REQUEST_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {leaveTypeLabels[type]}
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2 md:col-span-2">
                          <input
                            type="date"
                            name="startsAt"
                            defaultValue={format(request.startsAt, "yyyy-MM-dd")}
                            className="min-w-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                            required
                          />
                          <input
                            type="date"
                            name="endsAt"
                            defaultValue={format(request.endsAt, "yyyy-MM-dd")}
                            className="min-w-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                            required
                          />
                        </div>
                        <input
                          type="text"
                          name="note"
                          defaultValue={request.note ?? ""}
                          placeholder="Note (optionnel)"
                          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 md:col-span-2"
                        />
                        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
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
                          className="w-full rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 sm:w-auto"
                        >
                          Annuler la demande
                        </button>
                      </form>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
