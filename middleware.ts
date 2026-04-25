import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value);
  });
}

export async function middleware(request: NextRequest) {
  const { supabase, response: supabaseResponse } = createSupabaseMiddlewareClient(request);

  if (!supabase) {
    return supabaseResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = pathname + request.nextUrl.search;
    if (nextPath !== "/") loginUrl.searchParams.set("next", nextPath);
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  if (user && pathname === "/login") {
    const nextRaw = request.nextUrl.searchParams.get("next") ?? "/";
    const safe =
      nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.includes("..") ? nextRaw : "/";
    const target = new URL(safe, request.url);
    const redirectResponse = NextResponse.redirect(target);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
