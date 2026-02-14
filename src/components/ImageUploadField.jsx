// src/components/ImageUploadField.jsx
import React, { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const BUCKET = "ugc-assets";
const MAX_MB = 8;

function extFromFile(file) {
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".jpg")) return "jpg";
  return "jpg";
}

function safeMsg(e) {
  return e?.message || String(e);
}

async function getUidOrThrow() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data?.session?.user?.id;
  if (!uid) throw new Error("Not logged in. Please login again.");
  return uid;
}

async function resolveUrl(path) {
  // Try public URL first (works if bucket is public)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl;

  // If bucket is private, publicUrl may exist but will 403 when loaded.
  // Use signed URL fallback.
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (!signErr && signed?.signedUrl) return signed.signedUrl;

  // If signed url fails but publicUrl exists, return it anyway.
  if (publicUrl) return publicUrl;

  throw new Error("Failed to resolve file URL (public/signed).");
}

export default function ImageUploadField({
  label,
  valueUrl,
  onUrl,
  projectId,
  kind, // "model" | "product"

  // UX options
  optional = true,
  hideUrl = true,
  showPreview = true
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErr("");

    // Validation
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

      // ✅ RLS-friendly path
      const safeProjectId = projectId || "local";
      const path = `users/${uid}/projects/${safeProjectId}/refs/${kind}.${ext}`;

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
      <div style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>
        {label} {optional ? <span style={{ fontWeight: 700, color: "#6b7280" }}>(optional)</span> : null}
      </div>

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

        <input ref={inputRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: "none" }} />

        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
          {valueUrl ? "Uploaded ✓" : "No image yet"}
        </div>

        {valueUrl ? (
          <button
            type="button"
            onClick={() => onUrl("")}
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
              width: 88,
              height: 88,
              objectFit: "cover",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)"
            }}
          />
          {!hideUrl ? (
            <div style={{ fontSize: 12, wordBreak: "break-all", color: "#374151" }}>{valueUrl}</div>
          ) : null}
        </div>
      ) : null}

      {err ? <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c" }}>{err}</div> : null}
    </div>
  );
}
