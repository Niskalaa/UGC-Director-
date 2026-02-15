// src/components/StudioShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";

const LS_THEME = "ugc_theme";
const LS_LANG = "ugc_lang";

const i18n = {
  id: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Bahasa",
    light: "Light",
    dark: "Dark",
    logout: "Logout",
    workflow: "plan → image → approve → video → audio",
    status: "Status",
    show: "Show",
    minimize: "Minimize",
    generating: "Generating…",
    progress: "Progress",
    generatePlan: "Generate Plan",
    saveDraft: "Save Draft",
    cancel: "Cancel",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    noBlueprint: "Belum ada blueprint. Generate dulu di Settings.",
    beatsNotReadable: "Blueprint ada, tapi scenes/beats tidak terbaca.",
    // fields
    aiBrain: "AI Brain",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds / scene",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    tone: "Tone (optional)",
    targetAudience: "Target audience (optional)",
    productUrl: "Product page URL (optional)",
    autoFill: "Auto-fill from Link",
    // assets
    assets: "Assets (optional)",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    // scene
    prompt: "Prompt",
    narration: "Narasi (VO)",
    onScreen: "On-screen",
    generateImage: "Generate Image",
    imageReady: "Image ready ✓",
    imageFailed: "Image failed",
    openImage: "Open",
    downloadImage: "Download",
  },
  en: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Language",
    light: "Light",
    dark: "Dark",
    logout: "Logout",
    workflow: "plan → image → approve → video → audio",
    status: "Status",
    show: "Show",
    minimize: "Minimize",
    generating: "Generating…",
    progress: "Progress",
    generatePlan: "Generate Plan",
    saveDraft: "Save Draft",
    cancel: "Cancel",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    noBlueprint: "No blueprint yet. Generate it in Settings.",
    beatsNotReadable: "Blueprint exists, but scenes/beats not readable.",
    // fields
    aiBrain: "AI Brain",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds / scene",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    tone: "Tone (optional)",
    targetAudience: "Target audience (optional)",
    productUrl: "Product page URL (optional)",
    autoFill: "Auto-fill from Link",
    // assets
    assets: "Assets (optional)",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    // scene
    prompt: "Prompt",
    narration: "Narration (VO)",
    onScreen: "On-screen",
    generateImage: "Generate Image",
    imageReady: "Image ready ✓",
    imageFailed: "Image failed",
    openImage: "Open",
    downloadImage: "Download",
  },
};

function safeJsonParseLoose(content) {
  try {
    return JSON.parse(content);
  } catch {
    const s = String(content || "");
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error("Invalid JSON");
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * ✅ Blueprint terbaru:
 * blueprint.scenes[].visual_direction (utama)
 * blueprint.scenes[].voiceover (string)
 * blueprint.scenes[].camera_movement
 * blueprint.scenes[].onscreen_text (string)
 * fallback: visual_prompt, voiceover.text, camera_angle, on_screen
 */
function extractScenes(blueprint, defaultSecondsPerScene = 8) {
  if (!blueprint) return [];

  let bp = blueprint;
  try {
    if (typeof bp === "string") bp = safeJsonParseLoose(bp);
  } catch {}

  if (bp?.blueprint) bp = bp.blueprint;

  const arr = bp?.scenes;
  if (!Array.isArray(arr)) return [];

  return arr.map((s, idx) => {
    const sec = Number(s?.duration_seconds || s?.duration || defaultSecondsPerScene) || defaultSecondsPerScene;

    const visual =
      s?.visual_direction ||
      s?.visual_prompt ||
      s?.visual ||
      s?.prompt ||
      "";

    const vo =
      typeof s?.voiceover === "string"
        ? s.voiceover
        : (s?.voiceover?.text || s?.narration || "");

    const onScreen =
      s?.onscreen_text ||
      s?.on_screen ||
      s?.onScreen ||
      "";

    const cam = s?.camera_movement || s?.camera_angle || s?.camera || "";

    return {
      id: s?.id || `S${idx + 1}`,
      index: idx + 1,
      seconds: sec,
      visual_prompt: String(visual || "").trim(),
      narration: String(vo || "").trim(),
      on_screen: String(onScreen || "").trim(),
      camera: String(cam || "").trim(),
    };
  });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildImageBrief(scene, project) {
  const parts = [];

  const cam = scene?.camera ? `Camera: ${scene.camera}.` : "";
  const ons = scene?.on_screen ? `On-screen text: ${scene.on_screen}.` : "";

  if (scene?.visual_prompt) parts.push(scene.visual_prompt);
  if (cam) parts.push(cam);
  if (ons) parts.push(ons);

  parts.push(
    "Style: photorealistic, clean commercial look, natural lighting, handheld phone camera vibe, sharp focus, high detail, realistic textures."
  );

  if (project?.brand || project?.product_type) {
    parts.push(`Product context: ${project?.brand || ""} ${project?.product_type || ""}.`);
  }
  return parts.filter(Boolean).join("\n");
}

/**
 * ✅ /api/jobs POST:
 * { type:"image", brief:"...", settings:{ aspect_ratio:"9:16" } }
 * ✅ Response: { id, status, image_url } atau { id, status, imageUrl }
 */
async function createImageJob({ scene, project, signal }) {
  const payload = {
    type: "image",
    brief: buildImageBrief(scene, project),
    settings: { aspect_ratio: project?.aspect_ratio || "9:16" },
  };

  const r = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  const raw = await r.text();
  let json;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`Non-JSON jobs response (${r.status}). Preview: ${String(raw).slice(0, 160)}`);
  }

  if (!r.ok) throw new Error(json?.error || `Jobs failed (${r.status})`);
  if (!json?.id) throw new Error(`Jobs returned no id. keys=${Object.keys(json || {}).join(",")}`);

  // normalize
  const imageUrl = json.imageUrl || json.image_url || json.url || "";
  return { ...json, imageUrl };
}

export default function StudioShell({ onLogout }) {
  const [tab, setTab] = useState("Scenes");

  const [lang, setLang] = useState(() => localStorage.getItem(LS_LANG) || "id");
  const [theme, setTheme] = useState(() => localStorage.getItem(LS_THEME) || "dark");
  const t = i18n[lang] || i18n.id;

  // project draft
  const [project, setProject] = useState(() => ({
    ai_brain: "bedrock",
    platform: "tiktok",
    aspect_ratio: "9:16",
    scene_count: 4,
    seconds_per_scene: 8,
    brand: "",
    product_type: "",
    material: "",
    tone: "",
    target_audience: "",
    product_url: "",
    model_ref_url: "",
    product_ref_url: "",
  }));

  const [blueprint, setBlueprint] = useState(null);
  const scenes = useMemo(() => extractScenes(blueprint, project.seconds_per_scene), [blueprint, project.seconds_per_scene]);

  // plan state
  const abortRef = useRef(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [statusOpen, setStatusOpen] = useState(true);
  const [toast, setToast] = useState(null);

  // per-scene images
  const [sceneJobs, setSceneJobs] = useState(() => ({})); // { [sceneId]: { status, imageUrl, error } }
  const [busySceneId, setBusySceneId] = useState(null);

  // theme attach to html
  useEffect(() => {
    try {
      localStorage.setItem(LS_THEME, theme);
      localStorage.setItem(LS_LANG, lang);
    } catch {}
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  }, [theme, lang]);

  // timer for progress
  useEffect(() => {
    if (!loadingPlan) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - t0) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [loadingPlan]);

  const est = useMemo(() => {
    // rough estimate: base + scenes*?
    const base = 10;
    const sc = Number(project.scene_count || 4);
    return base + sc * 6;
  }, [project.scene_count]);

  function showToast(msg, tone = "ok") {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2200);
  }

  async function openJson() {
    if (!blueprint) return;
    const s = JSON.stringify(blueprint, null, 2);
    const w = window.open();
    if (w) w.document.write(`<pre>${s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre>`);
  }

  async function downloadJson() {
    if (!blueprint) return;
    downloadText("blueprint.json", JSON.stringify(blueprint, null, 2));
  }

  async function analyzeFromLink() {
    // optional: if you have /api/analyze wired
    // keep safe: no crash if missing
    const url = String(project.product_url || "").trim();
    if (!url) return showToast("URL kosong", "bad");
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const raw = await r.text();
      let json = null;
      try { json = raw ? JSON.parse(raw) : null; } catch {}
      if (!r.ok) throw new Error(json?.error || `Analyze failed (${r.status})`);

      // merge minimal if returned
      setProject((p) => ({
        ...p,
        brand: json?.brand || p.brand,
        product_type: json?.product_type || p.product_type,
        material: json?.material || p.material,
        tone: json?.tone || p.tone,
        target_audience: json?.target_audience || p.target_audience,
      }));
      showToast("Auto-fill ok", "ok");
    } catch (e) {
      showToast(String(e?.message || e), "bad");
    }
  }

  async function generatePlan() {
    setToast(null);
    setLoadingPlan(true);
    setElapsed(0);

    try {
      abortRef.current?.abort?.();
    } catch {}
    abortRef.current = new AbortController();

    try {
      const payload = {
        provider: project.ai_brain || "bedrock",
        project: project,
      };

      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        // tolerate "text with JSON inside"
        json = safeJsonParseLoose(raw);
      }

      if (!r.ok) throw new Error(json?.error || `Plan failed (${r.status})`);
      setBlueprint(json);
      setTab("Scenes");
      showToast("Plan generated ✓", "ok");
    } catch (e) {
      showToast(String(e?.message || e), "bad");
    } finally {
      setLoadingPlan(false);
    }
  }

  async function generateImageForScene(scene) {
    if (!scene?.id) return;
    setBusySceneId(scene.id);
    setSceneJobs((m) => ({
      ...m,
      [scene.id]: { status: "loading", imageUrl: "", error: "" },
    }));

    const ac = new AbortController();
    try {
      const job = await createImageJob({ scene, project, signal: ac.signal });
      const url = job.imageUrl || "";
      setSceneJobs((m) => ({
        ...m,
        [scene.id]: { status: "done", imageUrl: url, error: "" },
      }));
      if (url) showToast("Image ready ✓", "ok");
      else showToast("Job done, but image url missing", "bad");
    } catch (e) {
      setSceneJobs((m) => ({
        ...m,
        [scene.id]: { status: "error", imageUrl: "", error: String(e?.message || e) },
      }));
      showToast(String(e?.message || e), "bad");
    } finally {
      setBusySceneId(null);
    }
  }

  const hasBlueprint = !!blueprint;
  const scenesReadable = scenes.length > 0;

  return (
    <div className="ugc-page">
      {/* ===== Topbar (Telegram-like responsive) ===== */}
      <div className="ugc-topbar">
        <div
          className="ugc-topbar-inner"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div className="ugc-title" style={{ minWidth: 0, whiteSpace: "nowrap" }}>
            {t.studio}
          </div>

          <div
            className="ugc-top-actions"
            style={{
              justifySelf: "end",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
              rowGap: 10,
              whiteSpace: "nowrap",
            }}
          >
            <div className="ugc-pill" style={{ whiteSpace: "nowrap" }}>
              <div className="ugc-pill-label">{t.language}</div>
              <button
                className={`ugc-pill-btn ${lang === "id" ? "active" : ""}`}
                onClick={() => setLang("id")}
                type="button"
              >
                ID
              </button>
              <button
                className={`ugc-pill-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
                type="button"
              >
                EN
              </button>
            </div>

            <button
              className="ugc-pill-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              type="button"
              style={{ whiteSpace: "nowrap" }}
            >
              {theme === "dark" ? t.light : t.dark}
            </button>

            {typeof onLogout === "function" ? (
              <button className="ugc-pill-btn" onClick={onLogout} type="button" style={{ whiteSpace: "nowrap" }}>
                {t.logout}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ===== Main container ===== */}
      <div className="ugc-container" style={{ paddingBottom: 280 }}>
        {/* SETTINGS */}
        {tab === "Settings" ? (
          <div className="ugc-card">
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">{t.settings}</div>
              <div className="ugc-cardsub">Fill inputs → Generate Plan</div>
            </div>

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">{t.aiBrain}</div>
                <select
                  className="ugc-select"
                  value={project.ai_brain}
                  onChange={(e) => setProject((p) => ({ ...p, ai_brain: e.target.value }))}
                >
                  <option value="bedrock">Bedrock</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">{t.productUrl}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    className="ugc-input"
                    value={project.product_url}
                    onChange={(e) => setProject((p) => ({ ...p, product_url: e.target.value }))}
                    placeholder="https://..."
                    style={{ flex: "1 1 260px", minWidth: 180 }}
                  />
                  <button className="ugc-btn small" onClick={analyzeFromLink} type="button">
                    {t.autoFill}
                  </button>
                </div>
              </div>

              <div>
                <div className="ugc-label">{t.platform}</div>
                <select
                  className="ugc-select"
                  value={project.platform}
                  onChange={(e) => setProject((p) => ({ ...p, platform: e.target.value }))}
                >
                  <option value="tiktok">TikTok</option>
                  <option value="reels">Instagram Reels</option>
                  <option value="shorts">YouTube Shorts</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">{t.aspectRatio}</div>
                <select
                  className="ugc-select"
                  value={project.aspect_ratio}
                  onChange={(e) => setProject((p) => ({ ...p, aspect_ratio: e.target.value }))}
                >
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                  <option value="16:9">16:9</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">{t.sceneCount}</div>
                <select
                  className="ugc-select"
                  value={project.scene_count}
                  onChange={(e) => setProject((p) => ({ ...p, scene_count: Number(e.target.value) }))}
                >
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">{t.secondsPerScene}</div>
                <select
                  className="ugc-select"
                  value={project.seconds_per_scene}
                  onChange={(e) => setProject((p) => ({ ...p, seconds_per_scene: Number(e.target.value) }))}
                >
                  <option value={6}>6s</option>
                  <option value={8}>8s</option>
                  <option value={10}>10s</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">{t.brand}</div>
                <input
                  className="ugc-input"
                  value={project.brand}
                  onChange={(e) => setProject((p) => ({ ...p, brand: e.target.value }))}
                />
              </div>

              <div>
                <div className="ugc-label">{t.productType}</div>
                <input
                  className="ugc-input"
                  value={project.product_type}
                  onChange={(e) => setProject((p) => ({ ...p, product_type: e.target.value }))}
                />
              </div>

              <div>
                <div className="ugc-label">{t.material}</div>
                <input
                  className="ugc-input"
                  value={project.material}
                  onChange={(e) => setProject((p) => ({ ...p, material: e.target.value }))}
                />
              </div>

              <div>
                <div className="ugc-label">{t.tone}</div>
                <input
                  className="ugc-input"
                  value={project.tone}
                  onChange={(e) => setProject((p) => ({ ...p, tone: e.target.value }))}
                />
              </div>

              <div>
                <div className="ugc-label">{t.targetAudience}</div>
                <input
                  className="ugc-input"
                  value={project.target_audience}
                  onChange={(e) => setProject((p) => ({ ...p, target_audience: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ height: 14 }} />

            <div className="ugc-sectiontitle">{t.assets}</div>

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">{t.modelRef}</div>
                <ImageUploadField
                  kind="model"
                  projectId="default"
                  value={project.model_ref_url}
                  onUrl={(url) => setProject((p) => ({ ...p, model_ref_url: url }))}
                />
              </div>

              <div>
                <div className="ugc-label">{t.productRef}</div>
                <ImageUploadField
                  kind="product"
                  projectId="default"
                  value={project.product_ref_url}
                  onUrl={(url) => setProject((p) => ({ ...p, product_ref_url: url }))}
                />
              </div>
            </div>

            <div className="ugc-generate" style={{ justifyContent: "space-between" }}>
              <button className="ugc-btn" type="button" onClick={() => showToast("Draft saved (local)", "ok")}>
                {t.saveDraft}
              </button>
              <button className="ugc-btn primary" type="button" onClick={generatePlan} disabled={loadingPlan}>
                {t.generatePlan}
              </button>
            </div>
          </div>
        ) : null}

        {/* SCENES */}
        {tab === "Scenes" ? (
          <div className="ugc-card">
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">{t.scenes}</div>
              <div className="ugc-cardsub">{t.workflow}</div>
            </div>

            {!hasBlueprint ? (
              <div className="ugc-muted-box">{t.noBlueprint}</div>
            ) : !scenesReadable ? (
              <div className="ugc-muted-box">{t.beatsNotReadable}</div>
            ) : (
              <div className="ugc-list">
                {scenes.map((s) => {
                  const job = sceneJobs[s.id] || null;
                  const hasImg = !!job?.imageUrl;

                  return (
                    <div className="ugc-scene" key={s.id}>
                      <div className="ugc-scene-top" style={{ justifyContent: "space-between" }}>
                        <div className="ugc-chiprow">
                          <span className="ugc-badge">{`S${s.index}`}</span>
                          <span className="ugc-scene-title">SCENE</span>
                          <span className="ugc-chip">{`${(s.index - 1) * s.seconds}s–${s.index * s.seconds}s`}</span>
                        </div>

                        <div className="ugc-chiprow" style={{ justifyContent: "flex-end" }}>
                          {s.camera ? <span className="ugc-chip">{s.camera}</span> : null}
                        </div>
                      </div>

                      <div className="ugc-row">
                        <div className="ugc-row-label">{t.onScreen}</div>
                        <div className="ugc-row-val">{s.on_screen || "—"}</div>
                      </div>

                      <div className="ugc-row">
                        <div className="ugc-row-label">{t.prompt}</div>
                        <div className="ugc-row-val" style={{ whiteSpace: "pre-wrap" }}>
                          {s.visual_prompt || "—"}
                        </div>
                      </div>

                      <div className="ugc-row">
                        <div className="ugc-row-label">{t.narration}</div>
                        <div className="ugc-row-val" style={{ whiteSpace: "pre-wrap" }}>
                          {s.narration || "—"}
                        </div>
                      </div>

                      <div className="ugc-row-actions" style={{ marginTop: 12 }}>
                        <button
                          className={`ugc-btn primary ${busySceneId === s.id ? "loading" : ""}`}
                          type="button"
                          onClick={() => generateImageForScene(s)}
                          disabled={busySceneId && busySceneId !== s.id}
                        >
                          {t.generateImage}
                        </button>

                        {job?.status === "error" ? (
                          <span className="ugc-muted" style={{ color: "rgba(239,68,68,0.9)" }}>
                            {job.error || t.imageFailed}
                          </span>
                        ) : job?.status === "loading" ? (
                          <span className="ugc-muted">{t.generating}</span>
                        ) : hasImg ? (
                          <>
                            <span className="ugc-muted">{t.imageReady}</span>
                            <button className="ugc-btn small" type="button" onClick={() => window.open(job.imageUrl, "_blank")}>
                              {t.openImage}
                            </button>
                            <button
                              className="ugc-btn small"
                              type="button"
                              onClick={() => downloadText(`${s.id}.txt`, job.imageUrl)}
                            >
                              {t.downloadImage}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="ugc-row-actions" style={{ marginTop: 14 }}>
              <button className="ugc-btn" onClick={openJson} type="button">
                {t.openJson}
              </button>
              <button className="ugc-btn" onClick={downloadJson} type="button">
                {t.downloadJson}
              </button>
            </div>
          </div>
        ) : null}

        {/* EXPORT */}
        {tab === "Export" ? (
          <div className="ugc-card">
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">{t.export}</div>
            </div>

            {!hasBlueprint ? (
              <div className="ugc-muted-box">{t.noBlueprint}</div>
            ) : (
              <div className="ugc-row-actions">
                <button className="ugc-btn" onClick={openJson} type="button">
                  {t.openJson}
                </button>
                <button className="ugc-btn" onClick={downloadJson} type="button">
                  {t.downloadJson}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ===== Status Dock (safe spacing + minimized keeps animated bar) ===== */}
      <div className={`ugc-status ${statusOpen ? "" : "collapsed"}`}>
        <div className="ugc-status-inner">
          <div className="ugc-status-head">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 8 }}>
              <div className="ugc-status-title">{t.status}</div>

              {loadingPlan ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span className="ugc-spinner" />
                  <span className="ugc-muted">
                    {t.generating} · {elapsed}s
                  </span>
                </div>
              ) : (
                <span className="ugc-muted">Ready — {(project.ai_brain || "bedrock").toUpperCase()}</span>
              )}
            </div>

            <button className="ugc-btn small" onClick={() => setStatusOpen((v) => !v)} type="button">
              {statusOpen ? t.minimize : t.show}
            </button>
          </div>

          {/* ✅ minimized state still shows slim animated progress strip when loading */}
          {!statusOpen && loadingPlan ? (
            <div style={{ marginTop: 10 }}>
              <div className="ugc-progress-track" style={{ height: 8 }}>
                <div
                  className="ugc-progress-bar"
                  style={{
                    width: `${clamp((elapsed / Math.max(1, est)) * 100, 8, 92)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {statusOpen ? (
            <>
              <div className="ugc-chiprow" style={{ marginTop: 10, gap: 10, rowGap: 10 }}>
                <span className="ugc-chip ok">Core ✓</span>
                <span className={`ugc-chip ${project.model_ref_url ? "ok" : ""}`}>Model {project.model_ref_url ? "✓" : "×"}</span>
                <span className={`ugc-chip ${project.product_ref_url ? "ok" : ""}`}>Product {project.product_ref_url ? "✓" : "×"}</span>
                <span className="ugc-chip">≈ {est}s</span>
                <span className="ugc-chip">Provider: {(project.ai_brain || "bedrock").toUpperCase()}</span>
              </div>

              <div className="ugc-progress" style={{ marginTop: 12 }}>
                <div className="ugc-progress-track">
                  <div
                    className="ugc-progress-bar"
                    style={{
                      width: loadingPlan ? `${clamp((elapsed / Math.max(1, est)) * 100, 6, 92)}%` : "0%",
                    }}
                  />
                </div>
                <div className="ugc-progress-meta" style={{ marginTop: 10 }}>
                  <span>{t.progress}</span>
                  {loadingPlan ? (
                    <button
                      className="ugc-btn small"
                      type="button"
                      onClick={() => {
                        try {
                          abortRef.current?.abort?.();
                        } catch {}
                      }}
                    >
                      {t.cancel}
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ===== Bottom Tabbar (Telegram-like) ===== */}
      <div className="ugc-tabbar">
        <div className="ugc-tabbar-inner">
          <button className={`ugc-tab ${tab === "Settings" ? "active" : ""}`} onClick={() => setTab("Settings")} type="button">
            {t.settings}
          </button>
          <button className={`ugc-tab ${tab === "Scenes" ? "active" : ""}`} onClick={() => setTab("Scenes")} type="button">
            {t.scenes}
          </button>
          <button className={`ugc-tab ${tab === "Export" ? "active" : ""}`} onClick={() => setTab("Export")} type="button">
            {t.export}
          </button>
        </div>
      </div>

      {/* credit */}
      <div className="ugc-credit">Created by @adryndian</div>

      {/* Toast */}
      {toast ? <div className={`ugc-toast ${toast.tone === "ok" ? "ok" : "bad"}`}>{toast.msg}</div> : null}
    </div>
  );
}
