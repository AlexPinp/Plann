type RequiredEnvKey = "NEXT_PUBLIC_SUPABASE_URL";

export function getEnv(key: RequiredEnvKey): string {
  // In client bundles, Next.js only inlines NEXT_PUBLIC_* vars on static access.
  // Keep explicit branches instead of process.env[key].
  const value =
    key === "NEXT_PUBLIC_SUPABASE_URL"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      : undefined;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export function getSupabaseKey(): string {
  // Use || not ??: an empty publishable var (common in Vercel) must fall back to anon.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  if (key.startsWith("sb_secret_")) {
    throw new Error(
      "Clé Supabase invalide pour le navigateur / le serveur Next : utilisez la clé Publishable (sb_publishable_…) ou la clé anon legacy (eyJ…), pas la Secret key.",
    );
  }
  return key;
}
