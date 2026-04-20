/**
 * Vite-inlined env. Throws on missing values so misconfiguration fails fast.
 *
 * Key: use the **public** client key from the dashboard (Project Settings → API Keys, or Connect).
 * That may be the legacy `anon` JWT or the newer **publishable** key (`sb_publishable_...`); both work
 * in the client during Supabase’s transition. You do not put the JWT *signing* secret or service_role
 * key in the frontend.
 */
export function getSupabaseUrl(): string {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (!url) throw new Error("Missing VITE_SUPABASE_URL in environment.");
  return url.replace(/\/+$/, "");
}

export function getSupabaseAnonKey(): string {
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!key) throw new Error("Missing VITE_SUPABASE_ANON_KEY in environment.");
  return key;
}
