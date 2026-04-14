import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv, getSupabaseKey } from "@/lib/env";

/**
 * Supabase server client safe for Server Components, Server Actions and Route Handlers.
 *
 * In Server Components, cookies are read-only — the `setAll` call from a
 * token refresh will silently no-op.  The middleware already handles the
 * actual cookie write on every request, so sessions stay fresh.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getSupabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — cookies are read-only here.
          // The middleware refreshes the session cookie on every request,
          // so skipping the write is safe.
        }
      },
    },
  });
}
