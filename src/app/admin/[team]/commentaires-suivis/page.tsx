import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import {
  createCommentaryEntry,
  createFollowUpEntry,
  deleteCommentaryEntry,
  deleteFollowUpEntry,
  updateCommentaryEntry,
  updateFollowUpEntry,
} from "./actions";

const MONTH_OPTIONS = [
  "JANVIER",
  "FEVRIER",
  "MARS",
  "AVRIL",
  "MAI",
  "JUIN",
  "JUILLET",
  "AOUT",
  "SEPTEMBRE",
  "OCTOBRE",
  "NOVEMBRE",
  "DECEMBRE",
];

const STATUS_OPTIONS = ["TODO", "IN_PROGRESS", "DONE"] as const;
type CommentaryStatus = (typeof STATUS_OPTIONS)[number];

const statusLabels: Record<CommentaryStatus, string> = {
  TODO: "A faire",
  IN_PROGRESS: "En cours",
  DONE: "Fait",
};

const statusClasses: Record<CommentaryStatus, string> = {
  TODO: "bg-rose-100 text-rose-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  DONE: "bg-emerald-100 text-emerald-700",
};

type SearchProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ team: string }>;
};

export default async function AdminCommentairesSuivisPage({ searchParams, params }: SearchProps) {
  await requireStaffAdmin();
  const { team: teamSlug } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const commentCreated = sp.commentCreated === "1";
  const commentUpdated = sp.commentUpdated === "1";
  const commentDeleted = sp.commentDeleted === "1";
  const followCreated = sp.followCreated === "1";
  const followUpdated = sp.followUpdated === "1";
  const followDeleted = sp.followDeleted === "1";

  const delegates = prisma as unknown as {
    commentaryEntry?: {
      findMany: typeof prisma.commentaryEntry.findMany;
    };
    followUpEntry?: {
      findMany: typeof prisma.followUpEntry.findMany;
    };
  };

  if (!delegates.commentaryEntry || !delegates.followUpEntry) {
    return (
      <main>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Commentaires et suivis</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">Module indisponible temporairement.</p>
        </div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Les nouveaux tableaux ne sont pas encore disponibles dans le client Prisma actif. Relancez le serveur de
          développement pour recharger le client.
        </p>
      </main>
    );
  }

  const [commentaryEntries, followUpEntries] = await Promise.all([
    delegates.commentaryEntry.findMany({ orderBy: [{ createdAt: "desc" }] }),
    delegates.followUpEntry.findMany({ orderBy: [{ createdAt: "desc" }] }),
  ]);

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Commentaires et suivis</h1>
      </div>

      {commentCreated ? <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Commentaire créé.</p> : null}
      {commentUpdated ? <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Commentaire modifié.</p> : null}
      {commentDeleted ? <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Commentaire supprimé.</p> : null}
      {followCreated ? <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Suivi créé.</p> : null}
      {followUpdated ? <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Suivi modifié.</p> : null}
      {followDeleted ? <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Suivi supprimé.</p> : null}
      {error ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Commentaires opérationnels</h2>
          </div>
          <details className="rounded-lg border border-zinc-300 bg-white">
            <summary className="cursor-pointer list-none px-2 py-1 text-sm font-semibold text-zinc-700">+</summary>
            <form action={createCommentaryEntry} className="grid w-full max-w-[900px] gap-2 border-t border-zinc-200 p-2 lg:grid-cols-8">
              <input type="hidden" name="teamSlug" value={teamSlug} />
              <select name="monthLabel" defaultValue="" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900">
                <option value="">Mois</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input name="datesLabel" placeholder="Date(s)" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900" />
              <input name="subject" required placeholder="Objet(s)" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900 lg:col-span-2" />
              <input name="personnel" placeholder="Personnel(s)" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900" />
              <input name="trainer" placeholder="Formateur(s)" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900" />
              <input name="comment" placeholder="Commentaire(s)" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900" />
              <div className="flex items-center gap-2">
                <select name="status" defaultValue="TODO" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900">
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">
                  Ajouter
                </button>
              </div>
            </form>
          </details>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[1050px] border-collapse text-xs">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="border-b border-zinc-200 p-2 text-left">Mois</th>
                <th className="border-b border-zinc-200 p-2 text-left">Date(s)</th>
                <th className="border-b border-zinc-200 p-2 text-left">Objet(s)</th>
                <th className="border-b border-zinc-200 p-2 text-left">Personnel(s)</th>
                <th className="border-b border-zinc-200 p-2 text-left">Formateur(s)</th>
                <th className="border-b border-zinc-200 p-2 text-left">Commentaire(s)</th>
                <th className="border-b border-zinc-200 p-2 text-left">État</th>
                <th className="border-b border-zinc-200 p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commentaryEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-3 text-center text-zinc-500">
                    Aucun commentaire pour le moment.
                  </td>
                </tr>
              ) : (
                commentaryEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border-b border-zinc-100 p-2">{entry.monthLabel ?? "—"}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.datesLabel ?? "—"}</td>
                    <td className="border-b border-zinc-100 p-2 font-medium text-zinc-800">{entry.subject}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.personnel ?? "—"}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.trainer ?? "—"}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.comment ?? "—"}</td>
                    <td className="border-b border-zinc-100 p-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${statusClasses[entry.status as CommentaryStatus]}`}>
                        {statusLabels[entry.status as CommentaryStatus]}
                      </span>
                    </td>
                    <td className="border-b border-zinc-100 p-2">
                      <div className="flex items-center gap-2">
                        <details>
                          <summary className="cursor-pointer text-base leading-none" title="Modifier">✏️</summary>
                          <form action={updateCommentaryEntry} className="mt-2 grid w-full gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 lg:min-w-[760px] lg:grid-cols-8">
                            <input type="hidden" name="teamSlug" value={teamSlug} />
                            <input type="hidden" name="id" value={entry.id} />
                            <select name="monthLabel" defaultValue={entry.monthLabel ?? ""} className="rounded border border-zinc-300 px-2 py-1 text-xs">
                              <option value="">Mois</option>
                              {MONTH_OPTIONS.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                            <input name="datesLabel" defaultValue={entry.datesLabel ?? ""} placeholder="Date(s)" className="rounded border border-zinc-300 px-2 py-1 text-xs" />
                            <input name="subject" required defaultValue={entry.subject} placeholder="Objet(s)" className="rounded border border-zinc-300 px-2 py-1 text-xs lg:col-span-2" />
                            <input name="personnel" defaultValue={entry.personnel ?? ""} placeholder="Personnel(s)" className="rounded border border-zinc-300 px-2 py-1 text-xs" />
                            <input name="trainer" defaultValue={entry.trainer ?? ""} placeholder="Formateur(s)" className="rounded border border-zinc-300 px-2 py-1 text-xs" />
                            <input name="comment" defaultValue={entry.comment ?? ""} placeholder="Commentaire(s)" className="rounded border border-zinc-300 px-2 py-1 text-xs" />
                            <div className="flex items-center gap-2">
                              <select name="status" defaultValue={entry.status} className="rounded border border-zinc-300 px-2 py-1 text-xs">
                                {STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {statusLabels[status]}
                                  </option>
                                ))}
                              </select>
                              <button type="submit" className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800">
                                <span role="img" aria-label="Enregistrer" title="Enregistrer">💾</span>
                              </button>
                            </div>
                          </form>
                        </details>
                        <form action={deleteCommentaryEntry}>
                          <input type="hidden" name="teamSlug" value={teamSlug} />
                          <input type="hidden" name="id" value={entry.id} />
                          <button type="submit" className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100">
                            <span role="img" aria-label="Supprimer" title="Supprimer">❌</span>
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Suivi périodique</h2>
            
          </div>
          <details className="rounded-lg border border-zinc-300 bg-white">
            <summary className="cursor-pointer list-none px-2 py-1 text-sm font-semibold text-zinc-700">+</summary>
            <form action={createFollowUpEntry} className="grid w-full max-w-[900px] gap-2 border-t border-zinc-200 p-2 lg:grid-cols-8">
              <input type="hidden" name="teamSlug" value={teamSlug} />
              <input name="subject" required placeholder="Objet" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900 lg:col-span-2" />
              <input name="personnel" placeholder="Personnel(s)" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900 lg:col-span-2" />
              <input name="lastDate" type="date" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900" />
              <input name="lastBy" placeholder="Dernier suivi par" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900" />
              <input name="nextDate" type="date" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900" />
              <input name="nextBy" placeholder="Prochain suivi par" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900" />
              <input name="note" placeholder="Commentaire (optionnel)" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900 lg:col-span-6" />
              <button type="submit" className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 lg:col-span-2">
                Ajouter
              </button>
            </form>
          </details>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="border-b border-zinc-200 p-2 text-left">Objet</th>
                <th className="border-b border-zinc-200 p-2 text-left">Personnel(s)</th>
                <th className="border-b border-zinc-200 p-2 text-left">Dernière date</th>
                <th className="border-b border-zinc-200 p-2 text-left">Par</th>
                <th className="border-b border-zinc-200 p-2 text-left">Prochaine date</th>
                <th className="border-b border-zinc-200 p-2 text-left">Par</th>
                <th className="border-b border-zinc-200 p-2 text-left">Commentaire</th>
                <th className="border-b border-zinc-200 p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {followUpEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-3 text-center text-zinc-500">
                    Aucun suivi pour le moment.
                  </td>
                </tr>
              ) : (
                followUpEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border-b border-zinc-100 p-2 font-medium text-zinc-800">{entry.subject}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.personnel ?? "—"}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.lastDate ? format(entry.lastDate, "dd/MM/yyyy", { locale: fr }) : "—"}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.lastBy ?? "—"}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.nextDate ? format(entry.nextDate, "dd/MM/yyyy", { locale: fr }) : "—"}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.nextBy ?? "—"}</td>
                    <td className="border-b border-zinc-100 p-2">{entry.note ?? "—"}</td>
                    <td className="border-b border-zinc-100 p-2">
                      <div className="flex items-center gap-2">
                        <details>
                          <summary className="cursor-pointer text-base leading-none" title="Modifier">✏️</summary>
                          <form action={updateFollowUpEntry} className="mt-2 grid w-full gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 lg:min-w-[760px] lg:grid-cols-8">
                            <input type="hidden" name="teamSlug" value={teamSlug} />
                            <input type="hidden" name="id" value={entry.id} />
                            <input name="subject" required defaultValue={entry.subject} placeholder="Objet" className="rounded border border-zinc-300 px-2 py-1 text-xs lg:col-span-2" />
                            <input name="personnel" defaultValue={entry.personnel ?? ""} placeholder="Personnel(s)" className="rounded border border-zinc-300 px-2 py-1 text-xs lg:col-span-2" />
                            <input type="date" name="lastDate" defaultValue={entry.lastDate ? format(entry.lastDate, "yyyy-MM-dd") : ""} className="rounded border border-zinc-300 px-2 py-1 text-xs" />
                            <input name="lastBy" defaultValue={entry.lastBy ?? ""} placeholder="Dernier suivi par" className="rounded border border-zinc-300 px-2 py-1 text-xs" />
                            <input type="date" name="nextDate" defaultValue={entry.nextDate ? format(entry.nextDate, "yyyy-MM-dd") : ""} className="rounded border border-zinc-300 px-2 py-1 text-xs" />
                            <input name="nextBy" defaultValue={entry.nextBy ?? ""} placeholder="Prochain suivi par" className="rounded border border-zinc-300 px-2 py-1 text-xs" />
                            <input name="note" defaultValue={entry.note ?? ""} placeholder="Commentaire (optionnel)" className="rounded border border-zinc-300 px-2 py-1 text-xs lg:col-span-7" />
                            <button type="submit" className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800">
                              <span role="img" aria-label="Enregistrer" title="Enregistrer">💾</span>
                            </button>
                          </form>
                        </details>
                        <form action={deleteFollowUpEntry}>
                          <input type="hidden" name="teamSlug" value={teamSlug} />
                          <input type="hidden" name="id" value={entry.id} />
                          <button type="submit" className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100">
                            <span role="img" aria-label="Supprimer" title="Supprimer">❌</span>
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
