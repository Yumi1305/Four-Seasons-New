import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { AuthContext, type AuthContextValue } from "./auth-context";

type AdminGate = "admin" | "not_admin" | "error";

async function resolveAdminGate(user: User): Promise<AdminGate> {
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth] admin_users lookup failed:", error.message);
    return "error";
  }
  return data ? "admin" : "not_admin";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reset gating state in the SAME update that changes session, so AdminRoute
  // never observes a new session paired with stale isAdmin from the previous user.
  // Wrapped together with React's automatic batching (React 18+) — no flushSync needed.
  const applySession = useCallback((next: Session | null) => {
    setSession(next);
    setIsAdmin(false);
    setLoading(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      applySession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;
    const user = session?.user ?? null;

    if (!user) {
      setLoading(false);
      return;
    }

    void (async () => {
      const gate = await resolveAdminGate(user);
      if (cancelled) return;

      if (gate === "admin") {
        setIsAdmin(true);
        setLoading(false);
        return;
      }

      if (gate === "not_admin") {
        setLoading(false);
        await supabase.auth.signOut();
        return;
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, session?.user?.id, session]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error("Sign-in succeeded but no user was returned.");

    const gate = await resolveAdminGate(user);
    if (gate === "error") {
      throw new Error("Could not verify admin access. Check the admin_users table and RLS policies.");
    }
    if (gate === "not_admin") {
      await supabase.auth.signOut();
      throw new Error("This account is not authorized for admin access.");
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAdmin,
      loading,
      signIn,
      signOut,
    }),
    [session, isAdmin, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
