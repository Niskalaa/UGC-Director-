import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import GeneratorPage from "./pages/GeneratorPage.jsx";

function Home() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 16 }}>
      <h2>Home</h2>
      <p>
        Buka generator di: <a href="/generator">/generator</a>
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/generator" element={<GeneratorPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
