"use client";

import { useState } from "react";
import { signInWithPassword, signUpWithPassword } from "./actions";

export default function LoginPage() {
  const [showSignup, setShowSignup] = useState(false);
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const error = params?.get("error") ?? undefined;
  const registered = params?.get("registered") === "1";
  const nextRaw = params?.get("next") ?? "/planning-moi";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.includes("..") ? nextRaw : "/planning-moi";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-center text-2xl font-bold text-zinc-900">Planner SAU</h1>
          <p className="mt-1 text-center text-xs text-zinc-500">Service d&apos;Accueil des Urgences</p>

          {registered && (
            <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              Compte cree. Si la confirmation par email est activee, ouvrez le lien recu avant de vous connecter.
            </p>
          )}
          {error && <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

          <form action={signInWithPassword} className="mt-6 space-y-3">
            <input type="hidden" name="next" value={next} />
            <div>
              <label className="block text-sm font-medium text-zinc-700" htmlFor="signin-email">
                Email professionnel
              </label>
              <input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="prenom.nom@ght85.fr"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700" htmlFor="signin-password">
                Mot de passe
              </label>
              <input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 active:bg-zinc-950"
            >
              Se connecter
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setShowSignup((v) => !v)}
              className="text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
            >
              {showSignup ? "Masquer" : "Premiere connexion ? Creer mon compte"}
            </button>
          </div>

          {showSignup && (
            <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
              <p className="mb-3 text-xs text-zinc-500">
                Votre cadre doit avoir cree votre fiche agent au prealable.
              </p>
              <form action={signUpWithPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600" htmlFor="signup-email">
                    Email professionnel
                  </label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="prenom.nom@ght85.fr"
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600" htmlFor="signup-password">
                    Mot de passe (min. 8 car.)
                  </label>
                  <input
                    id="signup-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600" htmlFor="signup-confirm">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="signup-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
                >
                  Creer mon compte
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-400">
          Acces reserve au personnel. En cas de probleme, contactez votre cadre.
        </p>
      </div>
    </main>
  );
}
