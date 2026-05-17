import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { OperationalCommentsSection } from "./OperationalCommentsSection";
import { PeriodicFollowUpSection } from "./PeriodicFollowUpSection";

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

      <OperationalCommentsSection teamSlug={teamSlug} entries={commentaryEntries} />

      <PeriodicFollowUpSection teamSlug={teamSlug} entries={followUpEntries} />
    </main>
  );
}
