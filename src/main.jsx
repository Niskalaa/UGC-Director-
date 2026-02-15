import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import GeneratorPage from "./pages/GeneratorPage.jsx";
import StudioPage from "./pages/Studio.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/studio" replace />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/generator" element={<GeneratorPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
