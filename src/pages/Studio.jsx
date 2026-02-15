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
      navigate("/", { replace: true });
    }
  }

  return <StudioShell onLogout={logout} />;
}
