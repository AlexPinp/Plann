import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function supabaseAuthKeyFromEnv(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

/**
 * Supabase client + mutable response for Next.js middleware (session refresh).
 * Call `getUser()` (or any auth call) on `supabase` so `setAll` can update cookies on `response`.
 */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = supabaseAuthKeyFromEnv();

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!supabaseUrl || !supabaseKey) {
    return { supabase: null as null, response };
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  return { supabase, response };
}
