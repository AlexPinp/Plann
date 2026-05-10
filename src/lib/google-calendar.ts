import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

type SupabaseOAuthSession = {
  provider_token?: string | null;
  provider_refresh_token?: string | null;
  user?: {
    id?: string;
    email?: string | null;
    identities?: Array<{
      provider?: string;
      identity_data?: { sub?: string; email?: string };
    }>;
  };
  expires_at?: number;
};

type GoogleTokenPayload = {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiry?: Date | null;
  scope?: string | null;
  googleSubject?: string | null;
  googleEmail?: string | null;
};

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_REFRESH_SKEW_SECONDS = 90;

const MISSING_REFRESH_HINT =
  "Google n'a pas renvoye de jeton de rafraichissement. Dans votre compte Google : Securite > Connexion a Google > Applications tierces, retirez l'acces a cette application puis recommencez la liaison depuis Reglages.";

function isMissingGoogleCalendarTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    typeof error.message === "string" &&
    error.message.includes("GoogleCalendarAccount")
  );
}

function getGoogleEnv() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Configuration OAuth Google manquante (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).");
  }
  return { clientId, clientSecret };
}

function getGoogleIdentity(session: SupabaseOAuthSession) {
  return session.user?.identities?.find((identity) => identity.provider === "google");
}

export async function saveGoogleTokensFromSession(session: SupabaseOAuthSession) {
  const authUserId = session.user?.id;
  const accessToken = session.provider_token;
  const refreshToken = session.provider_refresh_token;
  if (!authUserId || !accessToken || !refreshToken) return;

  const user = await prisma.user.findFirst({ where: { authUserId }, select: { id: true } });
  if (!user) return;

  const googleIdentity = getGoogleIdentity(session);
  const expiresAt =
    typeof session.expires_at === "number" && Number.isFinite(session.expires_at)
      ? new Date(session.expires_at * 1000)
      : null;

  try {
    await prisma.googleCalendarAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        accessToken,
        refreshToken,
        accessTokenExpiry: expiresAt,
        googleSubject: googleIdentity?.identity_data?.sub,
        googleEmail: googleIdentity?.identity_data?.email ?? session.user?.email ?? null,
        scope: GOOGLE_SCOPE,
      },
      update: {
        accessToken,
        refreshToken,
        accessTokenExpiry: expiresAt,
        googleSubject: googleIdentity?.identity_data?.sub,
        googleEmail: googleIdentity?.identity_data?.email ?? session.user?.email ?? null,
        scope: GOOGLE_SCOPE,
      },
    });
  } catch (error) {
    if (isMissingGoogleCalendarTableError(error)) return;
    throw error;
  }
}

export async function saveGoogleTokensForUser(userId: string, payload: GoogleTokenPayload): Promise<boolean> {
  let existing: { refreshToken: string } | null = null;
  try {
    existing = await prisma.googleCalendarAccount.findUnique({
      where: { userId },
      select: { refreshToken: true },
    });
  } catch (error) {
    if (isMissingGoogleCalendarTableError(error)) return false;
    throw error;
  }

  const refreshToken = payload.refreshToken ?? existing?.refreshToken;
  if (!refreshToken) {
    throw new Error(MISSING_REFRESH_HINT);
  }

  try {
    await prisma.googleCalendarAccount.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: payload.accessToken,
        refreshToken,
        accessTokenExpiry: payload.accessTokenExpiry ?? null,
        scope: payload.scope ?? GOOGLE_SCOPE,
        googleSubject: payload.googleSubject ?? null,
        googleEmail: payload.googleEmail ?? null,
      },
      update: {
        accessToken: payload.accessToken,
        refreshToken,
        accessTokenExpiry: payload.accessTokenExpiry ?? null,
        scope: payload.scope ?? GOOGLE_SCOPE,
        googleSubject: payload.googleSubject ?? null,
        googleEmail: payload.googleEmail ?? null,
      },
    });
  } catch (error) {
    if (isMissingGoogleCalendarTableError(error)) return false;
    throw error;
  }
  return true;
}

type ValidGoogleToken = {
  accessToken: string;
};

async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date | null;
  nextRefreshToken: string;
}> {
  const { clientId, clientSecret } = getGoogleEnv();
  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Impossible de rafraichir le token Google (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!data.access_token) throw new Error("Reponse OAuth Google invalide (access_token manquant).");
  const expiresAt =
    typeof data.expires_in === "number" && Number.isFinite(data.expires_in)
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

  return {
    accessToken: data.access_token,
    expiresAt,
    nextRefreshToken: data.refresh_token ?? refreshToken,
  };
}

export async function getValidGoogleAccessToken(userId: string): Promise<ValidGoogleToken | null> {
  let account: {
    userId: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: Date | null;
  } | null = null;
  try {
    account = await prisma.googleCalendarAccount.findUnique({ where: { userId } });
  } catch (error) {
    if (isMissingGoogleCalendarTableError(error)) return null;
    throw error;
  }
  if (!account) return null;

  const nowWithSkew = Date.now() + TOKEN_REFRESH_SKEW_SECONDS * 1000;
  if (!account.accessTokenExpiry || account.accessTokenExpiry.getTime() > nowWithSkew) {
    return { accessToken: account.accessToken };
  }

  const refreshed = await refreshGoogleAccessToken(account.refreshToken);
  try {
    await prisma.googleCalendarAccount.update({
      where: { userId },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.nextRefreshToken,
        accessTokenExpiry: refreshed.expiresAt,
      },
    });
  } catch (error) {
    if (isMissingGoogleCalendarTableError(error)) return null;
    throw error;
  }
  return { accessToken: refreshed.accessToken };
}

export async function isGoogleCalendarLinked(userId: string): Promise<boolean> {
  let account: { userId: string } | null = null;
  try {
    account = await prisma.googleCalendarAccount.findUnique({
      where: { userId },
      select: { userId: true },
    });
  } catch (error) {
    if (isMissingGoogleCalendarTableError(error)) return false;
    throw error;
  }
  return Boolean(account);
}
