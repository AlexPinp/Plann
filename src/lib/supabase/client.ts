"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getEnv, getSupabaseKey } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getSupabaseKey());
}
