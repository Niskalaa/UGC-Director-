import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("supabase.getSession error:", error);
        if (!mounted) return;
        setSession(data?.session ?? null);
      } catch (e) {
        console.error("AuthProvider init error:", e);
        if (!mounted) return;
        setSession(null);
      } finally {
        if (mounted) setLoading(false); // ✅ WAJIB, biar gak stuck
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false); // ✅ juga aman di sini
    });

    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthCtx>(() => {
    return { user: session?.user ?? null, session, loading };
  }, [session, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
