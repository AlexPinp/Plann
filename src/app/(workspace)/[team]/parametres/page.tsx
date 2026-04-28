import { requireTeamMembership } from "@/lib/team";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateMyPassword, updateMyPreferences } from "./actions";

type Props = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ParametresAgentPage({ params, searchParams }: Props) {
  const { team: teamSlug } = await params;
  const ctx = await requireTeamMembership(teamSlug);
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const updatedPassword = sp.updatedPassword === "1";
  const updatedPreferences = sp.updatedPreferences === "1";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const uiTheme = String(authUser?.user_metadata?.uiTheme ?? "system");
  const uiDensity = String(authUser?.user_metadata?.uiDensity ?? "comfortable");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Parametres</h1>
             </div>

      {updatedPassword ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Mot de passe mis à jour.
        </p>
      ) : null}
      {updatedPreferences ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Préférences enregistrées.
        </p>
      ) : null}
      {error ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Compte</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Vous êtes connecté en tant que {ctx.user.firstName} {ctx.user.lastName.toUpperCase()}.
        </p>
        <form action={updateMyPassword} className="mt-4 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 md:max-w-lg">
          <input type="hidden" name="teamSlug" value={teamSlug} />
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-zinc-700">
              Nouveau mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-zinc-700">
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <div>
            <button
              type="submit"
              className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Mettre à jour mon mot de passe
            </button>
          </div>
        </form>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Préférences personnelles</h2>
        <p className="mt-1 text-sm text-zinc-600">Ces réglages sont enregistrés sur votre compte.</p>
        <form action={updateMyPreferences} className="mt-4 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 md:max-w-lg">
          <input type="hidden" name="teamSlug" value={teamSlug} />
          <div>
            <label htmlFor="uiTheme" className="mb-1 block text-xs font-medium text-zinc-700">
              Thème
            </label>
            <select
              id="uiTheme"
              name="uiTheme"
              defaultValue={uiTheme === "light" || uiTheme === "dark" ? uiTheme : "system"}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              <option value="system">Système</option>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </div>
          <div>
            <label htmlFor="uiDensity" className="mb-1 block text-xs font-medium text-zinc-700">
              Densité d&apos;affichage
            </label>
            <select
              id="uiDensity"
              name="uiDensity"
              defaultValue={uiDensity === "compact" ? "compact" : "comfortable"}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              <option value="comfortable">Confort</option>
              <option value="compact">Compacte</option>
            </select>
          </div>
          <div>
            <button
              type="submit"
              className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Enregistrer mes préférences
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
