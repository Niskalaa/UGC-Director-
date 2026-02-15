import React, { useEffect, useMemo, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";

const LS_BLUEPRINT = "ugc.blueprint.v1";
const LS_DRAFT = "ugc.draft.v1";

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function clip(s, n = 180) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Normalize many blueprint shapes into a single scenes array.
 * Supports:
 * - blueprint.vo.scenes[]  (your uploaded blueprint.json)
 * - blueprint.storyboard.beats[]
 * - blueprint.beats[]
 * - blueprint.scenes[]
 */
function extractScenes(blueprint) {
  if (!blueprint) return [];

  // 1) VO scenes (your current schema)
  const voScenes = blueprint?.vo?.scenes;
  if (Array.isArray(voScenes) && voScenes.length) {
    return voScenes.map((s, idx) => ({
      id: s.id || `S${idx + 1}`,
      idx,
      start: s.start_seconds ?? idx * 8,
      end: s.end_seconds ?? (idx + 1) * 8,
      shot: s.camera_angle || s.shot_type || "",
      on_screen: s.on_screen || "",
      visual_prompt:
        s.visual_prompt ||
        [
          s.description ? `Scene: ${s.description}` : "",
          s.camera_angle ? `Camera: ${s.camera_angle}` : "",
          s.style ? `Style: ${s.style}` : "",
          s.environment ? `Environment: ${s.environment}` : "",
          s.lighting ? `Lighting: ${s.lighting}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
    }));
  }

  // 2) beats
  const beats =
    blueprint?.storyboard?.beats ||
    blueprint?.beats ||
    blueprint?.storyboard?.scenes ||
    blueprint?.scenes;

  if (Array.isArray(beats) && beats.length) {
    return beats.map((b, idx) => ({
      id: b.id || b.scene_id || `S${idx + 1}`,
      idx,
      start: b.start_seconds ?? idx * 8,
      end: b.end_seconds ?? (idx + 1) * 8,
      shot: b.camera_angle || b.shot || b.shot_type || "",
      on_screen: b.on_screen || b.onscreen_text || "",
      visual_prompt: b.visual_prompt || b.image_prompt || b.prompt || b.description || "",
    }));
  }

  return [];
}

async function postJson(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  const data = safeJsonParse(text) ?? { raw: text };
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

export default function StudioShell({ onLogout }) {
  const [theme, setTheme] = useState(() => {
    const t = document.documentElement.getAttribute("data-theme");
    return t === "dark" ? "dark" : "light";
  });

  const [lang, setLang] = useState("ID");

  const [tab, setTab] = useState("settings"); // settings | scenes | export

  const [draft, setDraft] = useState(() => safeJsonParse(localStorage.getItem(LS_DRAFT)) || {});
  const [blueprint, setBlueprint] = useState(() => safeJsonParse(localStorage.getItem(LS_BLUEPRINT)));
  const scenes = useMemo(() => extractScenes(blueprint), [blueprint]);

  // UI state
  const [toast, setToast] = useState(null);
  const [err, setErr] = useState("");

  // Status dock
  const [collapsed, setCollapsed] = useState(true);
  const [statusText, setStatusText] = useState("Ready — BEDROCK");
  const [isWorking, setIsWorking] = useState(false);

  // Auto-fill from link
  const [productUrl, setProductUrl] = useState(draft?.product_url || "");
  const [autoFillLoading, setAutoFillLoading] = useState(false);

  // assets
  const modelRefUrl = draft?.model_ref_url || "";
  const productRefUrl = draft?.product_ref_url || "";

  // per-scene image results
  const [sceneImages, setSceneImages] = useState(() => ({})); // { [sceneId]: {status, image_url, job_id, error} }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LS_DRAFT, JSON.stringify({ ...draft, product_url: productUrl }));
  }, [draft, productUrl]);

  function pushToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2200);
  }

  async function onAutoFillFromLink() {
    setErr("");
    setAutoFillLoading(true);
    try {
      if (!productUrl) throw new Error("Masukkan product page URL dulu.");

      /**
       * NOTE:
       * Browser tidak bisa scrape halaman e-commerce langsung (CORS).
       * Tombol ini harus hit endpoint server.
       *
       * Kamu bisa bikin endpoint misalnya:
       * - POST /api/scrape { url }
       * Return minimal: { brand, product_type, material, target_audience, ... }
       *
       * Di sini aku panggil /api/scrape (kalau belum ada, error-nya jelas).
       */
      const data = await postJson("/api/scrape", { url: productUrl });

      setDraft((d) => ({
        ...d,
        ...(data?.fields || data || {}),
      }));

      pushToast("Auto-fill berhasil.");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setAutoFillLoading(false);
    }
  }

  async function onGeneratePlan() {
    setErr("");
    setIsWorking(true);
    setStatusText("Generating plan…");
    try {
      // minimal payload, sesuaikan dengan backend /api/plan kamu
      const payload = {
        project: {
          brand: draft?.brand || "",
          product_type: draft?.product_type || "",
          material: draft?.material || "",
          tone: draft?.tone || "",
          audience: draft?.audience || "",
          platform: draft?.platform || "TikTok",
          aspect_ratio: draft?.aspect_ratio || "9:16",
          scene_count: Number(draft?.scene_count || 4),
          seconds_per_scene: Number(draft?.seconds_per_scene || 8),
          product_url: productUrl || "",
        },
        provider: draft?.provider || "bedrock",
        assets: {
          model_ref_url: modelRefUrl || null,
          product_ref_url: productRefUrl || null,
        },
      };

      const data = await postJson("/api/plan", payload);
      localStorage.setItem(LS_BLUEPRINT, JSON.stringify(data));
      setBlueprint(data);

      pushToast("Plan generated.");
      setTab("scenes");
      setStatusText("Plan ready — BEDROCK");
    } catch (e) {
      setErr(String(e?.message || e));
      setStatusText("Failed — check error");
    } finally {
      setIsWorking(false);
    }
  }

  async function onGenerateImageForScene(scene) {
    setErr("");
    setIsWorking(true);
    setStatusText(`Generating image for ${scene.id}…`);
    try {
      const brief =
        scene.visual_prompt ||
        `Scene ${scene.id}: ${scene.on_screen || ""}\nCamera: ${scene.shot || ""}\nStyle: photorealistic`;

      const data = await postJson("/api/jobs", {
        type: "image",
        brief,
        settings: { aspect_ratio: draft?.aspect_ratio || "9:16" },
      });

      // jobs.js returns { id, status, image_url }
      setSceneImages((m) => ({
        ...m,
        [scene.id]: {
          status: data?.status || "done",
          image_url: data?.image_url || null,
          job_id: data?.id || null,
          error: null,
        },
      }));

      pushToast(`Image done for ${scene.id}`);
      setStatusText("Ready — BEDROCK");
    } catch (e) {
      setSceneImages((m) => ({
        ...m,
        [scene.id]: { status: "failed", image_url: null, job_id: null, error: String(e?.message || e) },
      }));
      setErr(String(e?.message || e));
      setStatusText("Failed — check error");
    } finally {
      setIsWorking(false);
    }
  }

  // Save draft helpers
  function setDraftField(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  return (
    <div className="ugc-page">
      {/* Topbar */}
      <div className="ugc-topbar">
        <div className="ugc-topbar-inner">
          <div className="ugc-title">Studio</div>

          <div className="ugc-top-actions">
            <div className="ugc-pill">
              <span className="ugc-pill-label">Language</span>
              <button className={"ugc-pill-btn " + (lang === "ID" ? "active" : "")} onClick={() => setLang("ID")}>
                ID
              </button>
              <button className={"ugc-pill-btn " + (lang === "EN" ? "active" : "")} onClick={() => setLang("EN")}>
                EN
              </button>
            </div>

            <button
              className="ugc-pill-btn"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              title="Toggle theme"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>

            <button className="ugc-pill-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="ugc-container">
        {err ? <div className="ugc-error">{err}</div> : null}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div className="ugc-card">
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">Settings</div>
              <div className="ugc-cardsub">Generate plan → render image per scene</div>
            </div>

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">Product page URL (optional)</div>
                <input
                  className="ugc-input"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://..."
                />
                <div style={{ height: 10 }} />
                <button className={"ugc-btn " + (autoFillLoading ? "loading" : "")} onClick={onAutoFillFromLink} disabled={autoFillLoading}>
                  {autoFillLoading ? "Auto-filling…" : "Auto-fill from Link"}
                </button>
              </div>

              <div>
                <div className="ugc-label">AI Brain</div>
                <select className="ugc-select" value={draft?.provider || "bedrock"} onChange={(e) => setDraftField("provider", e.target.value)}>
                  <option value="bedrock">Bedrock</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">Platform</div>
                <select className="ugc-select" value={draft?.platform || "TikTok"} onChange={(e) => setDraftField("platform", e.target.value)}>
                  <option value="TikTok">TikTok</option>
                  <option value="Reels">Reels</option>
                  <option value="Shorts">Shorts</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">Aspect ratio</div>
                <select
                  className="ugc-select"
                  value={draft?.aspect_ratio || "9:16"}
                  onChange={(e) => setDraftField("aspect_ratio", e.target.value)}
                >
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                  <option value="4:5">4:5</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">Scene count</div>
                <select className="ugc-select" value={draft?.scene_count || 4} onChange={(e) => setDraftField("scene_count", e.target.value)}>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">Seconds / scene</div>
                <select
                  className="ugc-select"
                  value={draft?.seconds_per_scene || 8}
                  onChange={(e) => setDraftField("seconds_per_scene", e.target.value)}
                >
                  <option value={6}>6s</option>
                  <option value={8}>8s</option>
                  <option value={10}>10s</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">Brand *</div>
                <input className="ugc-input" value={draft?.brand || ""} onChange={(e) => setDraftField("brand", e.target.value)} />
              </div>

              <div>
                <div className="ugc-label">Product type *</div>
                <input className="ugc-input" value={draft?.product_type || ""} onChange={(e) => setDraftField("product_type", e.target.value)} />
              </div>

              <div>
                <div className="ugc-label">Material *</div>
                <input className="ugc-input" value={draft?.material || ""} onChange={(e) => setDraftField("material", e.target.value)} />
              </div>

              <div>
                <div className="ugc-label">Tone (optional)</div>
                <input className="ugc-input" value={draft?.tone || ""} onChange={(e) => setDraftField("tone", e.target.value)} />
              </div>

              <div>
                <div className="ugc-label">Target audience (optional)</div>
                <input className="ugc-input" value={draft?.audience || ""} onChange={(e) => setDraftField("audience", e.target.value)} />
              </div>
            </div>

            <div style={{ height: 12 }} />
            <div className="ugc-sectiontitle">Assets (optional)</div>

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">Model reference (optional)</div>
                <ImageUploadField
                  label="Model reference"
                  projectId={draft?.project_id || "default"}
                  kind="model"
                  value={modelRefUrl}
                  onUrl={(url) => setDraftField("model_ref_url", url)}
                />
              </div>

              <div>
                <div className="ugc-label">Product reference (optional)</div>
                <ImageUploadField
                  label="Product reference"
                  projectId={draft?.project_id || "default"}
                  kind="product"
                  value={productRefUrl}
                  onUrl={(url) => setDraftField("product_ref_url", url)}
                />
              </div>
            </div>

            <div className="ugc-generate">
              <button className="ugc-btn" onClick={() => pushToast("Draft saved.")}>
                Save Draft
              </button>
              <button className="ugc-btn primary" onClick={onGeneratePlan} disabled={isWorking}>
                {isWorking ? "Generating…" : "Generate Plan"}
              </button>
            </div>
          </div>
        )}

        {/* SCENES */}
        {tab === "scenes" && (
          <div className="ugc-card">
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">Scenes</div>
              <div className="ugc-cardsub">plan → image → approve → video → audio</div>
            </div>

            {!blueprint ? (
              <div className="ugc-muted-box">No blueprint yet. Generate it in Settings.</div>
            ) : scenes.length === 0 ? (
              <div className="ugc-muted-box">
                Blueprint exists, but scenes not readable. (Tip: pastikan blueprint punya <b>vo.scenes</b> atau <b>storyboard.beats</b>)
              </div>
            ) : (
              <div className="ugc-list">
                {scenes.map((s) => {
                  const img = sceneImages[s.id];
                  return (
                    <div className="ugc-scene" key={s.id}>
                      <div className="ugc-scene-top">
                        <span className="ugc-badge">{s.id}</span>
                        <div className="ugc-scene-title">SCENE</div>
                        <span className="ugc-chip">
                          {String(s.start)}s–{String(s.end)}s
                        </span>
                        {s.shot ? <span className="ugc-chip">{s.shot}</span> : null}
                      </div>

                      <div className="ugc-row">
                        <div className="ugc-row-label">On-screen</div>
                        <div className="ugc-row-val">{s.on_screen || "-"}</div>
                      </div>

                      <div className="ugc-row">
                        <div className="ugc-row-label">visual_prompt</div>
                        <div className="ugc-row-val" style={{ whiteSpace: "pre-wrap" }}>
                          {clip(s.visual_prompt, 420) || "-"}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <button className="ugc-btn primary" onClick={() => onGenerateImageForScene(s)} disabled={isWorking}>
                          Generate Image
                        </button>

                        {img?.status === "failed" ? <span className="ugc-muted">Failed</span> : null}
                        {img?.status && img?.status !== "failed" ? <span className="ugc-muted">{img.status}</span> : null}
                      </div>

                      {img?.image_url ? (
                        <div style={{ marginTop: 12 }}>
                          <img
                            src={img.image_url}
                            alt={`${s.id} result`}
                            style={{ width: "100%", borderRadius: 14, border: "1px solid var(--stroke)" }}
                          />
                        </div>
                      ) : null}

                      {img?.error ? <div className="ugc-error">{img.error}</div> : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* EXPORT */}
        {tab === "export" && (
          <div className="ugc-card">
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">Export</div>
              <div className="ugc-cardsub">Open / download blueprint JSON</div>
            </div>

            {!blueprint ? (
              <div className="ugc-muted-box">No blueprint yet.</div>
            ) : (
              <div className="ugc-row-actions">
                <button
                  className="ugc-btn"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                  }}
                >
                  Open JSON
                </button>

                <button
                  className="ugc-btn"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "blueprint.json";
                    a.click();
                  }}
                >
                  Download JSON
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Dock */}
      <div className={"ugc-status " + (collapsed ? "collapsed" : "")}>
        <div className="ugc-status-inner">
          <div className="ugc-status-head">
            <div className="ugc-status-title">Status</div>
            <button className="ugc-btn small" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? "Show" : "Minimize"}
            </button>
          </div>

          {collapsed ? (
            <div className="ugc-progress">
              <div className={"ugc-progress-track " + (isWorking ? "indeterminate" : "")} />
              <div className="ugc-progress-meta">
                <span className="ugc-muted">{statusText}</span>
                <span className="ugc-muted">{draft?.provider ? String(draft.provider).toUpperCase() : "BEDROCK"}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="ugc-chiprow">
                <span className={"ugc-chip " + (blueprint ? "ok" : "")}>Core {blueprint ? "✓" : "×"}</span>
                <span className={"ugc-chip " + (modelRefUrl ? "ok" : "")}>Model {modelRefUrl ? "✓" : "×"}</span>
                <span className={"ugc-chip " + (productRefUrl ? "ok" : "")}>Product {productRefUrl ? "✓" : "×"}</span>
                <span className="ugc-chip">≈ 32s</span>
              </div>

              <div style={{ marginTop: 10 }} className="ugc-progress">
                <div className={"ugc-progress-track " + (isWorking ? "indeterminate" : "")} />
                <div className="ugc-progress-meta">
                  <span>Progress</span>
                  <span>{statusText}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Tabbar */}
      <div className="ugc-tabbar">
        <div className="ugc-tabbar-inner">
          <button className={"ugc-tab " + (tab === "settings" ? "active" : "")} onClick={() => setTab("settings")}>
            Settings
          </button>
          <button className={"ugc-tab " + (tab === "scenes" ? "active" : "")} onClick={() => setTab("scenes")}>
            Scenes
          </button>
          <button className={"ugc-tab " + (tab === "export" ? "active" : "")} onClick={() => setTab("export")}>
            Export
          </button>
        </div>
      </div>

      <div className="ugc-credit">Created by @adryndian</div>

      {toast ? <div className={"ugc-toast " + toast.kind}>{toast.msg}</div> : null}
    </div>
  );
}
