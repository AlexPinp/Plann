"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppLogo } from "@/components/AppLogo";
import { signInWithPassword, signUpWithPassword } from "./actions";

function LoginForm() {
  const [showSignup, setShowSignup] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || undefined;
  const registered = searchParams.get("registered") === "1";
  const nextRaw = searchParams.get("next") ?? "/";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.includes("..") ? nextRaw : "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-md">
          <div className="mb-6 flex flex-col items-center">
            <AppLogo />
            <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Service d&apos;Accueil des Urgences</p>
          </div>

          {registered && (
            <p className="ui-alert-success mt-4">
              Compte cree. Si la confirmation par email est activee, ouvrez le lien recu avant de vous connecter.
            </p>
          )}
          {error && <p className="ui-alert-danger mt-4">{error}</p>}

          <form action={signInWithPassword} className="mt-6 space-y-3">
            <input type="hidden" name="next" value={next} />
            <div>
              <label className="ui-label" htmlFor="signin-email">
                Email professionnel
              </label>
              <input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="prenom.nom@ght85.fr"
                className="ui-input"
              />
            </div>
            <div>
              <label className="ui-label" htmlFor="signin-password">
                Mot de passe
              </label>
              <input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="ui-input"
              />
            </div>
            <button
              type="submit"
              className="ui-btn-primary w-full py-2.5"
            >
              Se connecter
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setShowSignup((v) => !v)}
              className="text-xs font-medium text-[var(--primary)] underline decoration-[var(--primary-soft)] underline-offset-2 hover:text-[var(--primary-hover)]"
            >
              {showSignup ? "Masquer" : "Premiere connexion ? Creer mon compte"}
            </button>
          </div>

          {showSignup && (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="mb-3 text-xs text-[var(--text-muted)]">
                Votre cadre doit avoir cree votre fiche agent au prealable.
              </p>
              <form action={signUpWithPassword} className="space-y-3">
                <div>
                  <label className="ui-label" htmlFor="signup-email">
                    Email professionnel
                  </label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="prenom.nom@ght85.fr"
                    className="ui-input"
                  />
                </div>
                <div>
                  <label className="ui-label" htmlFor="signup-password">
                    Mot de passe (min. 8 car.)
                  </label>
                  <input
                    id="signup-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="ui-input"
                  />
                </div>
                <div>
                  <label className="ui-label" htmlFor="signup-confirm">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="signup-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="ui-input"
                  />
                </div>
                <button
                  type="submit"
                  className="ui-btn-secondary w-full py-2.5"
                >
                  Creer mon compte
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-[var(--text-muted)]">
          Acces reserve au personnel. En cas de probleme, contactez votre cadre.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
            <p className="text-center text-sm text-[var(--text-muted)]">Chargement…</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
