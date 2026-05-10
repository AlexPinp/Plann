import { type NextRequest, NextResponse } from "next/server";
import { getSafeInternalPath } from "@/lib/auth-email";
import { linkAuthToPrismaUser, messageForLinkFailure } from "@/lib/auth-link";
import { saveGoogleTokensFromSession } from "@/lib/google-calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeInternalPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin),
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id && user.email) {
      const link = await linkAuthToPrismaUser(user.id, user.email);
      if (!link.ok) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(messageForLinkFailure(link.code))}`, requestUrl.origin),
        );
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await saveGoogleTokensFromSession({ ...session, user: { ...session.user, id: user.id } });
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
