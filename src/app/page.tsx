import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserTeams } from "@/lib/team";
import { signOut } from "./login/actions";

export default async function HomePage() {
  const { user, userTeams } = await getSessionUserTeams();
  if (!user) {
    redirect("/login");
  }

  if (userTeams.length === 1) {
    redirect(`/${userTeams[0].team.slug}/planning-moi`);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Choisir une équipe</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Vous appartenez à plusieurs équipes. Sélectionnez celle pour laquelle vous souhaitez consulter le planning.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {userTeams.map((ut) => (
          <li key={ut.teamId}>
            <Link
              href={`/${ut.team.slug}/planning-moi`}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                style={{ backgroundColor: ut.team.color }}
                aria-hidden
              />
              <span className="font-medium text-zinc-900">{ut.team.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut} className="pt-4">
        <button
          type="submit"
          className="text-sm text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
        >
          Déconnexion
        </button>
      </form>
    </div>
  );
}
