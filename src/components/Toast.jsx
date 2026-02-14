// src/components/Toast.jsx
import React from "react";

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const type = toast.type || "info"; // info | success | error
  const bg =
    type === "success"
      ? "rgba(34,197,94,0.12)"
      : type === "error"
      ? "rgba(239,68,68,0.12)"
      : "rgba(59,130,246,0.10)";

  const border =
    type === "success"
      ? "rgba(34,197,94,0.18)"
      : type === "error"
      ? "rgba(239,68,68,0.18)"
      : "rgba(59,130,246,0.16)";

  const color =
    type === "success"
      ? "#166534"
      : type === "error"
      ? "#b91c1c"
      : "#1e3a8a";

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(120px + env(safe-area-inset-bottom))",
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none"
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: "100%",
          maxWidth: 520,
          borderRadius: 16,
          padding: 12,
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: "blur(14px)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          justifyContent: "space-between"
        }}
      >
        <div style={{ color, fontWeight: 900, fontSize: 13, lineHeight: 1.35 }}>
          <div style={{ fontWeight: 1000 }}>{toast.title || "Info"}</div>
          {toast.message ? <div style={{ fontWeight: 700, marginTop: 4 }}>{toast.message}</div> : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid rgba(0,0,0,0.10)",
            background: "rgba(255,255,255,0.7)",
            borderRadius: 12,
            padding: "6px 10px",
            fontWeight: 900,
            cursor: "pointer"
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
