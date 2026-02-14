import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const next = useMemo(() => params.get("next") || "/studio", [params]);

  // kalau sudah login, langsung ke studio
  React.useEffect(() => {
    if (user) navigate("/studio", { replace: true });
  }, [user, navigate]);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!email || !password) throw new Error("Email dan password wajib diisi.");

      if (mode === "signup") {
        if (password !== password2) throw new Error("Password tidak sama.");
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // untuk MVP: setelah signup, tetap arahkan ke studio (kalau email verify off).
        // kalau email verify on, user akan diminta cek email.
        navigate(next, { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(next, { replace: true });
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ marginBottom: 14 }}>
          <div style={styles.title}>Sign in</div>
          <div style={styles.sub}>Access your Studio workspace</div>
        </div>

        <div style={styles.segmentWrap}>
          <button
            style={{ ...styles.segmentBtn, ...(mode === "signin" ? styles.segmentActive : {}) }}
            onClick={() => setMode("signin")}
            type="button"
          >
            Sign In
          </button>
          <button
            style={{ ...styles.segmentBtn, ...(mode === "signup" ? styles.segmentActive : {}) }}
            onClick={() => setMode("signup")}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {mode === "signup" && (
            <>
              <label style={styles.label}>Confirm password</label>
              <input
                style={styles.input}
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </>
          )}

          {err && <div style={styles.error}>{err}</div>}

          <button style={styles.primaryBtn} disabled={loading} type="submit">
            {loading ? "Processing…" : mode === "signup" ? "Create account" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,237,213,1) 100%)"
  },
  card: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    padding: 18,
    background: "rgba(255,255,255,0.65)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.5)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
  },
  title: { fontSize: 22, fontWeight: 800, color: "#111827" },
  sub: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  segmentWrap: {
    display: "flex",
    gap: 8,
    padding: 6,
    borderRadius: 14,
    background: "rgba(255,255,255,0.6)",
    border: "1px solid rgba(0,0,0,0.06)"
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 12,
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    fontWeight: 700,
    cursor: "pointer"
  },
  segmentActive: {
    background: "rgba(255,255,255,0.9)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)"
  },
  label: { display: "block", fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6, color: "#111827" },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    outline: "none",
    background: "rgba(255,255,255,0.9)"
  },
  primaryBtn: {
    width: "100%",
    marginTop: 14,
    padding: "12px 12px",
    borderRadius: 14,
    border: "none",
    background: "#f97316",
    color: "white",
    fontWeight: 800,
    cursor: "pointer"
  },
  error: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(239,68,68,0.12)",
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: 600
  }
};
