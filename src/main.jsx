import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import StudioPage from "./pages/Studio.jsx";
import GeneratorPage from "./pages/GeneratorPage.jsx";

import "./styles/global.css";
import { supabase } from "./lib/supabaseClient";
window.supabase = supabase;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* default */}
        <Route path="/" element={<Navigate to="/studio" replace />} />

        {/* main app */}
        <Route path="/studio" element={<StudioPage />} />

        {/* optional legacy */}
        <Route path="/generator" element={<GeneratorPage />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
