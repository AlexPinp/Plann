"use client";

import { useState } from "react";

type GoogleCalendarEventInput = {
  id: string;
  date: string;
  endDate: string;
  startsAt: string;
  endsAt: string;
  code: string;
  label: string;
  teamLabel: string;
};

type Props = {
  events: GoogleCalendarEventInput[];
};

function toGoogleDateTime(date: string, hhmm: string) {
  return `${date}T${hhmm}:00`;
}

export function GoogleCalendarExportButton({ events }: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    if (events.length === 0 || pending) return;
    setPending(true);
    setMessage(null);

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setMessage("Connexion Google indisponible: configuration Supabase manquante.");
        return;
      }

      const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = createSupabaseBrowserClient();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) {
        setMessage("Impossible de lire la session Google.");
        return;
      }

      const providerToken = session?.provider_token;
      if (!providerToken) {
        const redirectTo = window.location.href;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            scopes: "https://www.googleapis.com/auth/calendar.events",
            queryParams: { access_type: "offline", prompt: "consent" },
          },
        });
        if (error) {
          setMessage(`Connexion Google impossible: ${error.message}`);
        }
        return;
      }

      let okCount = 0;
      for (const event of events) {
        const body = {
          summary: `${event.code} - ${event.label}`,
          description: `Equipe: ${event.teamLabel}\nHoraires: ${event.startsAt}-${event.endsAt}\nSource: Planner SAU`,
          start: {
            dateTime: toGoogleDateTime(event.date, event.startsAt),
            timeZone: "Europe/Paris",
          },
          end: {
            dateTime: toGoogleDateTime(event.endDate, event.endsAt),
            timeZone: "Europe/Paris",
          },
          extendedProperties: {
            private: {
              plannerEventId: event.id,
            },
          },
        };

        const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${providerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (res.ok) okCount += 1;
      }

      if (okCount === events.length) {
        setMessage(`${okCount} evenement(s) ajoutes a Google Agenda.`);
      } else {
        setMessage(`${okCount}/${events.length} evenement(s) ajoutes. Verifiez vos autorisations Google.`);
      }
    } catch {
      setMessage("Echec de l'export Google Agenda.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || events.length === 0}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Export Google..." : "Google Agenda auto"}
      </button>
      {message ? <p className="mt-1 text-xs text-zinc-600">{message}</p> : null}
    </div>
  );
}
