import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeInternalPath } from "@/lib/auth-email";
import { getSessionPrismaUser } from "@/lib/current-user";

const OAUTH_STATE_COOKIE = "google_calendar_oauth_state";
const OAUTH_NEXT_COOKIE = "google_calendar_oauth_next";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function getGoogleClientId() {
  const value = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!value) throw new Error("Configuration OAuth Google manquante (GOOGLE_OAUTH_CLIENT_ID).");
  return value;
}

export async function GET(request: NextRequest) {
  const me = await getSessionPrismaUser();
  if (!me) {
    return NextResponse.redirect(new URL("/login?error=Session%20invalide", request.url));
  }

  const next = getSafeInternalPath(request.nextUrl.searchParams.get("next"));
  try {
    const state = randomUUID();
    const redirectUri = `${request.nextUrl.origin}/api/google-calendar/callback`;

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", getGoogleClientId());
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GOOGLE_SCOPE);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 10,
    });
    response.cookies.set(OAUTH_NEXT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    const details = error instanceof Error ? error.message : "Erreur OAuth Google.";
    const url = new URL(next, request.url);
    url.searchParams.set("error", details);
    return NextResponse.redirect(url);
  }
}
