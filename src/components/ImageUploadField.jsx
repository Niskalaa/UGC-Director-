// src/components/ImageUploadField.jsx
import React, { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const BUCKET = "ugc-assets";
const MAX_MB = 8;

function extFromFile(file) {
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".jpeg")) return "jpeg";
  if (name.endsWith(".jpg")) return "jpeg";
  return "jpeg";
}

function safeMsg(e) {
  return e?.message || String(e);
}

export default function ImageUploadField({
  label,
  valueUrl,
  onUrl,
  projectId,
  kind, // "model" | "product"
  optional = true,
  hideUrl = true,
  showPreview = true
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function getUidOrThrow() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const uid = data?.session?.user?.id;
    if (!uid) throw new Error("Not logged in. Please login again.");
    return uid;
  }

  async function resolveUrl(path) {
    // Try public url first
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (publicUrl) return publicUrl;

    // Fallback signed url
    const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signErr) throw signErr;
    if (!signed?.signedUrl) throw new Error("Failed to create signed URL");
    return signed.signedUrl;
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErr("");

    if (!file.type?.startsWith("image/")) {
      setErr("File harus gambar (image/*).");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_MB) {
      setErr(`File terlalu besar (${sizeMb.toFixed(1)}MB). Max ${MAX_MB}MB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);

    try {
      const uid = await getUidOrThrow();
      const ext = extFromFile(file);
      const path = `users/${uid}/projects/${projectId}/refs/${kind}.${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || `image/${ext}`
      });
      if (upErr) throw upErr;

      const url = await resolveUrl(path);
      onUrl(url);
    } catch (e2) {
      setErr(safeMsg(e2));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 800 }}>
        {label} {optional ? <span style={{ opacity: 0.7, fontWeight: 700 }}>(optional)</span> : null}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "transparent",
            color: "inherit",
            fontWeight: 900,
            cursor: uploading ? "not-allowed" : "pointer"
          }}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          style={{ display: "none" }}
        />

        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>
          {valueUrl ? "Uploaded ✓" : "No image"}
        </div>

        {valueUrl ? (
          <button
            type="button"
            onClick={() => onUrl("")}
            disabled={uploading}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
              color: "inherit",
              fontWeight: 900,
              cursor: uploading ? "not-allowed" : "pointer"
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {valueUrl && showPreview ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <img
            src={valueUrl}
            alt="preview"
            style={{
              width: 72,
              height: 72,
              objectFit: "cover",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)"
            }}
          />
          {!hideUrl ? <div style={{ fontSize: 12, wordBreak: "break-all", opacity: 0.8 }}>{valueUrl}</div> : null}
        </div>
      ) : null}

      {err ? <div style={{ fontSize: 12, fontWeight: 900, color: "#ef4444" }}>{err}</div> : null}
    </div>
  );
}
