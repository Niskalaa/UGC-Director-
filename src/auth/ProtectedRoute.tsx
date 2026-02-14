// src/auth/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

function FullScreenLoader() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontWeight: 800 }}>Loading…</div>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
