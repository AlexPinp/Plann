"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  teamSlug: string;
  /** Connexion Google (identité Supabase) ou liaison Agenda OAuth en base */
  linked: boolean;
  /** Jetons Google Agenda stockés en base (flux /api/google-calendar/link) — l’export ne passe pas par provider_token Supabase */
  hasSavedCalendarTokens: boolean;
};

export function GoogleAccountLinkButton({ teamSlug, linked, hasSavedCalendarTokens }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleLinkGoogle = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      const nextPath = `/${teamSlug}/parametres?linkedGoogle=1`;
      window.location.assign(`/api/google-calendar/link?next=${encodeURIComponent(nextPath)}`);
    } catch (err) {
      const details = err instanceof Error ? err.message : String(err);
      setError(`Impossible de lier le compte Google. Vérifiez la config Supabase/Google. (${details})`);
    } finally {
      setPending(false);
    }
  };

  const handleCheckGoogleConnection = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError("Impossible de verifier la connexion Google.");
        return;
      }

      if (hasSavedCalendarTokens) {
        setInfo("Google Agenda est bien relié. Vous pouvez utiliser l'export depuis votre planning.");
      } else if (session?.provider_token) {
        setInfo(
          "Connexion Google détectée, mais l'accès Agenda n'est pas encore autorisé. Utilisez « Lier mon compte Google » pour activer l'export.",
        );
      } else if (linked) {
        setInfo(
          "Compte Google associé, mais sans autorisation Agenda pour Plann. Cliquez sur « Lier mon compte Google » pour finaliser.",
        );
      } else {
        setInfo("Aucune liaison Google Agenda pour ce profil.");
      }
    } catch {
      setError("Echec de verification Google.");
    } finally {
      setPending(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (pending || !linked) return;
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: identitiesError } = await supabase.auth.getUserIdentities();
      if (identitiesError) {
        setError(identitiesError.message);
        return;
      }

      const googleIdentity = data?.identities?.find((identity) => identity.provider === "google");
      if (!googleIdentity) {
        setInfo("Aucune identite Google trouvee.");
        return;
      }

      const { error: unlinkError } = await supabase.auth.unlinkIdentity(googleIdentity);
      if (unlinkError) {
        setError(unlinkError.message);
        return;
      }

      window.location.href = `/${teamSlug}/parametres?unlinkedGoogle=1`;
    } catch {
      setError("Impossible de delier le compte Google.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleLinkGoogle}
          disabled={pending}
          className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Traitement..." : linked ? "Relier a un autre compte Google" : "Lier mon compte Google"}
        </button>
        <button
          type="button"
          onClick={handleCheckGoogleConnection}
          disabled={pending}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Verifier la connexion
        </button>
        <button
          type="button"
          onClick={handleUnlinkGoogle}
          disabled={pending || !linked}
          className="rounded-md border border-rose-300 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delier Google
        </button>
      </div>
      {info ? <p className="mt-2 text-xs text-zinc-600">{info}</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
