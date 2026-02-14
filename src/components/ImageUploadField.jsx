// src/components/ImageUploadField.jsx
import React, { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const BUCKET = "ugc-assets";

function extFromFile(file) {
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".jpg")) return "jpg";
  return "jpg";
}

export default function ImageUploadField({
  label,
  valueUrl,
  onUrl,
  projectId,
  kind // "model" | "product"
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErr("");
    setUploading(true);

    try {
      const ext = extFromFile(file);
      const path = `projects/${projectId}/refs/${kind}.${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || `image/${ext}`
      });
      if (upErr) throw upErr;

      // Public URL (untuk MVP). Kalau bucket private, ganti ke createSignedUrl.
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error("Failed to get public URL");

      onUrl(publicUrl);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>{label}</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.10)",
            background: "rgba(255,255,255,0.7)",
            fontWeight: 900,
            cursor: uploading ? "not-allowed" : "pointer"
          }}
        >
          {uploading ? "Uploading…" : "Upload Image"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          style={{ display: "none" }}
        />

        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
          {valueUrl ? "Uploaded ✓" : "No image yet"}
        </div>
      </div>

      {valueUrl ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <img
            src={valueUrl}
            alt="preview"
            style={{
              width: 88,
              height: 88,
              objectFit: "cover",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)"
            }}
          />
          <div style={{ fontSize: 12, wordBreak: "break-all", color: "#374151" }}>{valueUrl}</div>
        </div>
      ) : null}

      {err ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c" }}>{err}</div>
      ) : null}
    </div>
  );
}
