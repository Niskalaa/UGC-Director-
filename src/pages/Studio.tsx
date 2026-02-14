import React from "react";
import GeneratorInteractive from "../components/GeneratorInteractive.jsx";
import { supabase } from "../lib/supabaseClient";

export default function StudioPage() {
  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div>
      <div style={{ position: "sticky", top: 0, zIndex: 10, padding: 10, backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Studio</div>
          <button onClick={logout} style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 12, padding: "8px 12px", background: "rgba(255,255,255,0.7)" }}>
            Logout
          </button>
        </div>
      </div>

      <GeneratorInteractive />
    </div>
  );
}
