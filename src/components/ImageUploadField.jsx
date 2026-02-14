// src/components/ImageUploadField.jsx
import React, { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";// src/components/ImageUploadField.jsx
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
  kind, // "model" | "product"
  hideUrl = true,
  showPreview = true,
  optional = true
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

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error("Failed to get public URL");

      onUrl(publicUrl);
    } catch (e2) {
      setErr(e2?.message || String(e2));
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
  const m = e?.message || String(e);
  return m;
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

  async function getUidOrThrow() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const uid = data?.session?.user?.id;
    if (!uid) throw new Error("Not logged in. Please login again.");
    return uid;
  }

  async function resolveUrl(path) {
    // 1) coba public URL (bucket public)
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl;

    // kalau publicUrl ada tapi bucket private, biasanya tetap ada string URL tapi 403 saat load.
    // jadi kita test dengan signed URL fallback.
    if (publicUrl) return publicUrl;

    // 2) fallback signed URL (bucket private)
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60); // 1 jam
    if (signErr) throw signErr;

    if (!signed?.signedUrl) throw new Error("Failed to create signed URL");
    return signed.signedUrl;
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErr("");

    // basic validation
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

      // ✅ path aman untuk policy RLS: users/<uid>/...
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

      {err ? <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c" }}>{err}</div> : null}
    </div>
  );
}
