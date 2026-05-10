import { NextResponse, type NextRequest } from "next/server";
import { getSafeInternalPath } from "@/lib/auth-email";
import { getSessionPrismaUser } from "@/lib/current-user";
import { saveGoogleTokensForUser } from "@/lib/google-calendar";

const OAUTH_STATE_COOKIE = "google_calendar_oauth_state";
const OAUTH_NEXT_COOKIE = "google_calendar_oauth_next";

function withError(next: string, message: string) {
  const url = new URL(next, "http://localhost");
  url.searchParams.set("error", message);
  return `${url.pathname}${url.search}`;
}

function getGoogleOAuthSecrets() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Configuration OAuth Google manquante.");
  }
  return { clientId, clientSecret };
}

export async function GET(request: NextRequest) {
  const nextFromCookie = getSafeInternalPath(request.cookies.get(OAUTH_NEXT_COOKIE)?.value);
  const stateFromCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "";

  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    const redirectPath = withError(nextFromCookie, `Connexion Google refusée (${oauthError}).`);
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.cookies.delete(OAUTH_NEXT_COOKIE);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  if (!code || !state || stateFromCookie !== state) {
    const redirectPath = withError(nextFromCookie, "Etat OAuth invalide. Recommencez la liaison Google.");
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.cookies.delete(OAUTH_NEXT_COOKIE);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  const me = await getSessionPrismaUser();
  if (!me) {
    const response = NextResponse.redirect(new URL("/login?error=Session%20invalide", request.url));
    response.cookies.delete(OAUTH_NEXT_COOKIE);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  try {
    const { clientId, clientSecret } = getGoogleOAuthSecrets();
    const redirectUri = `${request.nextUrl.origin}/api/google-calendar/callback`;
    const payload = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });
    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      throw new Error(`Token Google invalide (${tokenResponse.status}): ${text}`);
    }
    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      id_token?: string;
    };
    if (!tokenData.access_token) {
      throw new Error("Réponse Google invalide (access_token manquant).");
    }

    let googleSubject: string | null = null;
    let googleEmail: string | null = null;
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userInfoResponse.ok) {
      const userInfo = (await userInfoResponse.json()) as { sub?: string; email?: string };
      googleSubject = userInfo.sub ?? null;
      googleEmail = userInfo.email ?? null;
    }

    const expiresAt =
      typeof tokenData.expires_in === "number" && Number.isFinite(tokenData.expires_in)
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null;

    const saved = await saveGoogleTokensForUser(me.id, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      accessTokenExpiry: expiresAt,
      scope: tokenData.scope ?? null,
      googleSubject,
      googleEmail,
    });

    if (!saved) {
      const redirectPath = withError(
        nextFromCookie,
        "Impossible d'enregistrer la liaison Google : table ou migration manquante (GoogleCalendarAccount). Lancez les migrations Prisma sur cette base.",
      );
      const response = NextResponse.redirect(new URL(redirectPath, request.url));
      response.cookies.delete(OAUTH_NEXT_COOKIE);
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    const successUrl = new URL(nextFromCookie, request.url);
    successUrl.searchParams.set("linkedGoogle", "1");
    const response = NextResponse.redirect(successUrl);
    response.cookies.delete(OAUTH_NEXT_COOKIE);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    const details = error instanceof Error ? error.message : "Erreur inconnue.";
    const redirectPath = withError(nextFromCookie, `Liaison Google impossible: ${details}`);
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.cookies.delete(OAUTH_NEXT_COOKIE);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }
}
