import React from "react";
import { useNavigate } from "react-router-dom";
import StudioShell from "../components/StudioShell.jsx";
import { supabase } from "../lib/supabaseClient";

export default function StudioPage() {
  const navigate = useNavigate();

  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding: 10,
          backdropFilter: "blur(10px)",
          background: "rgba(255,255,255,0.6)",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Studio</div>
          <button
            onClick={logout}
            style={{
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 12,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.7)",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <StudioShell />
    </div>
  );
}
