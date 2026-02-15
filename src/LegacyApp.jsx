// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import StudioPage from "./pages/Studio";
import ProtectedRoute from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthProvider";

function FullScreenLoader() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontWeight: 800 }}>Loading…</div>
    </div>
  );
}

function IndexRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return user ? <Navigate to="/studio" replace /> : <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return user ? <Navigate to="/studio" replace /> : <LoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexRoute />} />
        <Route path="/login" element={<LoginRoute />} />

        <Route
          path="/studio/*"
          element={
            <ProtectedRoute>
              <StudioPage />
            </ProtectedRoute>
          }
        />

        <Route path="/generator" element={<Navigate to="/studio" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
