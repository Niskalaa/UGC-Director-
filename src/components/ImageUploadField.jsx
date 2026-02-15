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

async function getUidOrThrow() {
  // getUser lebih “tegas” daripada getSession buat kasus timing
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data?.user?.id;
  if (!uid) throw new Error("Not logged in. Please login again.");
  return uid;
}

async function resolveUrl(path) {
  const pub = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (pub?.data?.publicUrl) return pub.data.publicUrl;

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  if (!signed?.signedUrl) throw new Error("Failed to create signed URL");
  return signed.signedUrl;
}

async function tryUpload(path, file, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType,
  });
  if (error) throw error;
  return path;
}

export default function ImageUploadField({
  label,
  valueUrl,
  onUrl,
  projectId,
  kind, // "model" | "product"
  hideUrl = true,
  showPreview = true,
  optional = true,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

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
      if (typeof onUrl !== "function") throw new Error("onUrl prop is missing");
      if (!projectId) throw new Error("projectId is missing");
      if (!kind) throw new Error("kind is missing");

      const uid = await getUidOrThrow();
      const ext = extFromFile(file);
      const ct = file.type || `image/${ext}`;

      // ✅ IMPORTANT: coba beberapa path yang umum (biar match policy lama)
      // Urutan paling umum dulu:
      const candidates = [
        `users/${uid}/${projectId}/${kind}.${ext}`,
        `users/${uid}/projects/${projectId}/${kind}.${ext}`,
        `users/${uid}/projects/${projectId}/refs/${kind}.${ext}`,
        `${uid}/${projectId}/${kind}.${ext}`,
      ];

      let finalPath = null;
      let lastError = null;

      for (const p of candidates) {
        try {
          finalPath = await tryUpload(p, file, ct);
          break;
        } catch (e2) {
          lastError = e2;
          // lanjut coba path berikutnya
        }
      }

      if (!finalPath) throw lastError || new Error("Upload failed");

      const url = await resolveUrl(finalPath);
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
      <div className="ugc-label" style={{ marginBottom: 0 }}>
        {label}{" "}
        {optional ? (
          <span style={{ fontWeight: 800, opacity: 0.65 }}>(optional)</span>
        ) : null}
      </div>

      <div className="ugc-row-actions">
        <button
          type="button"
          className="ugc-btn small"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span className="ugc-spinner" />
              Uploading…
            </span>
          ) : (
            "Upload"
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          style={{ display: "none" }}
        />

        <span className="ugc-muted" style={{ fontSize: 12 }}>
          {valueUrl ? "Uploaded ✓" : "No image"}
        </span>

        {valueUrl ? (
          <button
            type="button"
            className="ugc-btn small"
            onClick={() => onUrl?.("")}
            disabled={uploading}
          >
            Clear
          </button>
        ) : null}
      </div>

      {valueUrl && showPreview ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 78,
              height: 78,
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid var(--stroke)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <img
              src={valueUrl}
              alt="preview"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>

          {!hideUrl ? (
            <div style={{ fontSize: 12, wordBreak: "break-all", opacity: 0.8 }}>
              {valueUrl}
            </div>
          ) : null}
        </div>
      ) : null}

      {err ? (
        <div className="ugc-error" style={{ marginTop: 0 }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}
