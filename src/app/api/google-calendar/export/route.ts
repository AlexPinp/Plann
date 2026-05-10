import { NextResponse } from "next/server";
import { getSessionPrismaUser } from "@/lib/current-user";
import { getValidGoogleAccessToken } from "@/lib/google-calendar";
import { normalizeHHMM } from "@/lib/time-hhmm";

type ExportEventInput = {
  id: string;
  date: string;
  endDate: string;
  startsAt: string;
  endsAt: string;
  code: string;
  label: string;
  teamLabel: string;
};

const MAX_EVENTS_PER_REQUEST = 200;

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function sanitizeEvent(value: unknown): ExportEventInput | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  const startsNorm =
    typeof event.startsAt === "string" ? normalizeHHMM(event.startsAt) : null;
  const endsNorm = typeof event.endsAt === "string" ? normalizeHHMM(event.endsAt) : null;
  if (
    typeof event.id !== "string" ||
    typeof event.code !== "string" ||
    typeof event.label !== "string" ||
    typeof event.teamLabel !== "string" ||
    !isDate(event.date) ||
    !isDate(event.endDate) ||
    !startsNorm ||
    !endsNorm
  ) {
    return null;
  }
  return {
    id: event.id,
    date: event.date,
    endDate: event.endDate,
    startsAt: startsNorm,
    endsAt: endsNorm,
    code: event.code,
    label: event.label,
    teamLabel: event.teamLabel,
  };
}

async function summarizeGoogleCalendarError(response: Response): Promise<string> {
  const status = response.status;
  try {
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const trimmed = text.trim().slice(0, 280);
      return trimmed ? `${status}: ${trimmed}` : `HTTP ${status}`;
    }
    const obj = parsed as {
      error?: string | { message?: string; errors?: Array<{ reason?: string; message?: string }> };
    };
    if (typeof obj.error === "string") return `${status}: ${obj.error}`;
    const msg = obj.error?.message;
    if (typeof msg === "string" && msg.length > 0) return `${status}: ${msg}`;
    const first = obj.error?.errors?.[0];
    if (first?.reason || first?.message) {
      return `${status}: ${[first.reason, first.message].filter(Boolean).join(" — ")}`;
    }
  } catch {
    return `HTTP ${status}`;
  }
  return `HTTP ${status}`;
}

function toGoogleDateTime(date: string, hhmm: string) {
  return `${date}T${hhmm}:00`;
}

export async function POST(request: Request) {
  const me = await getSessionPrismaUser();
  if (!me) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const token = await getValidGoogleAccessToken(me.id);
  if (!token?.accessToken) {
    return NextResponse.json({ error: "Compte Google non lié." }, { status: 409 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }
  const rawEvents = Array.isArray((payload as { events?: unknown })?.events)
    ? ((payload as { events: unknown[] }).events ?? [])
    : [];
  if (rawEvents.length === 0) {
    return NextResponse.json({ error: "Aucun evenement a exporter." }, { status: 400 });
  }
  if (rawEvents.length > MAX_EVENTS_PER_REQUEST) {
    return NextResponse.json({ error: "Trop d'evenements a exporter en une fois." }, { status: 400 });
  }

  const events = rawEvents.map(sanitizeEvent);
  if (events.some((event) => !event)) {
    return NextResponse.json({ error: "Format des evenements invalide." }, { status: 400 });
  }

  let okCount = 0;
  const sampleErrors: string[] = [];

  for (const event of events as ExportEventInput[]) {
    const body = {
      summary: `${event.code} - ${event.label}`,
      description: `Equipe: ${event.teamLabel}\nHoraires: ${event.startsAt}-${event.endsAt}\nRef Plann: ${event.id}\nSource: Plann`,
      start: {
        dateTime: toGoogleDateTime(event.date, event.startsAt),
        timeZone: "Europe/Paris",
      },
      end: {
        dateTime: toGoogleDateTime(event.endDate, event.endsAt),
        timeZone: "Europe/Paris",
      },
    };

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      okCount += 1;
    } else if (sampleErrors.length < 4) {
      sampleErrors.push(await summarizeGoogleCalendarError(response));
    }
  }

  return NextResponse.json({ okCount, total: events.length, sampleErrors });
}
