import { supabase } from "./supabaseClient";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

const REFRESH_BUFFER_SEC = 120;

function functionsRoot(): string {
  return `${getSupabaseUrl()}/functions/v1`;
}

/**
 * User access token for Edge Function calls. Refreshes when close to expiry.
 * Empty or whitespace tokens are never returned.
 */
export async function getSessionAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  let token = data.session?.access_token?.trim() ?? "";
  const now = Math.floor(Date.now() / 1000);
  const exp = data.session?.expires_at ?? 0;

  if (!token || exp <= now + REFRESH_BUFFER_SEC) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    token = refreshed.session?.access_token?.trim() ?? "";
  }

  if (!token) {
    throw new Error("Not signed in, or session has no access token. Sign in again.");
  }

  return token;
}

type EdgeMethod = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * Call a deployed Edge Function with the headers Supabase expects:
 * - apikey: project anon (publishable) key
 * - Authorization: Bearer <user access_token>
 *
 * Uses fetch against the same host as VITE_SUPABASE_URL (no separate VITE_API_URL).
 */
export async function callEdgeFunction<T>(
  path: string,
  options: { method: EdgeMethod; body?: unknown }
): Promise<T> {
  const relativePath = path.replace(/^\/+/, "");
  const url = `${functionsRoot()}/${relativePath}`;
  const token = await getSessionAccessToken();
  const anonKey = getSupabaseAnonKey();

  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
  };

  let body: string | undefined;
  if (options.body !== undefined && options.method !== "GET" && options.method !== "DELETE") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method,
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text ? `${options.method} /${relativePath}: ${res.status} — ${text.slice(0, 400)}` : `${options.method} /${relativePath}: ${res.status}`
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }

  return (await res.text()) as T;
}
