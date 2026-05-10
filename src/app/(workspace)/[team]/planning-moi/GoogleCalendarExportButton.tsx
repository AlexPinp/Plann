"use client";

import { useState } from "react";
import { explainGoogleCalendarExportFailure } from "@/lib/google-calendar-export-errors";

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
  teamSlug: string;
  events: GoogleCalendarEventInput[];
  isGoogleLinked: boolean;
};

export function GoogleCalendarExportButton({ teamSlug, events, isGoogleLinked }: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    if (events.length === 0 || pending || !isGoogleLinked) return;
    setPending(true);
    setMessage(null);

    try {
      const exportResponse = await fetch("/api/google-calendar/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      if (exportResponse.status === 409) {
        const nextPath = `/${teamSlug}/planning-moi${window.location.search}`;
        window.location.assign(`/api/google-calendar/link?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      if (!exportResponse.ok) {
        const body = (await exportResponse.json().catch(() => null)) as { error?: string } | null;
        setMessage(body?.error ?? "Echec de l'export Google Agenda.");
        return;
      }

      const data = (await exportResponse.json()) as {
        okCount: number;
        total: number;
        sampleErrors?: string[];
      };
      if (data.okCount === data.total) {
        const okCount = data.okCount;
        setMessage(`${okCount} evenement(s) ajoutes a Google Agenda.`);
      } else {
        const samples = data.sampleErrors ?? [];
        const firstErr = samples[0];
        const hint = explainGoogleCalendarExportFailure(samples);
        const detail = firstErr ? ` Détail Google : ${firstErr}` : "";
        const suffix =
          hint ?? (!detail ? " Verifiez vos autorisations Google ou reliancez le compte dans Réglages." : "");
        setMessage(`${data.okCount}/${data.total} evenement(s) ajoutes.${detail}${suffix ? `\n\n${suffix}` : ""}`);
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
        disabled={pending || events.length === 0 || !isGoogleLinked}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        title={!isGoogleLinked ? "Liez d'abord votre compte Google dans Reglages." : undefined}
      >
        {pending ? "Export Google..." : "Google Agenda auto"}
      </button>
      {!isGoogleLinked ? (
        <p className="mt-1 text-xs text-amber-700">
          Compte Google non lie. Activez-le dans <a href={`/${teamSlug}/parametres`} className="underline">Reglages</a>.
        </p>
      ) : null}
      {message ? (
        <p className="mt-1 max-w-xl whitespace-pre-wrap text-xs text-zinc-600">{message}</p>
      ) : null}
    </div>
  );
}
