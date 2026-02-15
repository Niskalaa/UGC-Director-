import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import "./styles/global.css";

// ✅ Auth
import { AuthProvider } from "./auth/AuthProvider.tsx"; // jika path berbeda, sesuaikan

// ✅ Pages
import StudioPage from "./pages/Studio.jsx";
import LoginPage from "./pages/Login.tsx";
import GeneratorPage from "./pages/GeneratorPage.jsx";

// (Optional) Home kecil — boleh hapus
function Home() {
  return <Navigate to="/studio" replace />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* ✅ Auth routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* ✅ Main app */}
          <Route path="/studio" element={<StudioPage />} />

          {/* optional legacy */}
          <Route path="/generator" element={<GeneratorPage />} />

          {/* ✅ fallback */}
          <Route path="*" element={<Navigate to="/studio" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
