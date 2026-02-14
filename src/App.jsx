import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import StudioPage from "./pages/Studio";
import ProtectedRoute from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthProvider";

function LoginRoute() {
  const { user, loading } = useAuth();
  function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontWeight: 800 }}>Loading…</div>
      </div>
    );
  }
  return user ? <Navigate to="/studio" replace /> : <LoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default masuk ke studio */}
        <Route path="/" element={<Navigate to="/studio" replace />} />

        {/* Login public, tapi kalau sudah login auto ke studio */}
        <Route path="/login" element={<LoginRoute />} />

        {/* Studio protected */}
        <Route
          path="/studio/*"
          element={
            <ProtectedRoute>
              <StudioPage />
            </ProtectedRoute>
          }
        />

        {/* Legacy route (client-side fallback). Edge 301 di Vercel tetap dipakai. */}
        <Route path="/generator" element={<Navigate to="/studio" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
