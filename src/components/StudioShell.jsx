// StudioShell.jsx
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
 * ✅ Blueprint terbaru kamu:
 * blueprint.scenes[].visual_direction (utama)
 * blueprint.scenes[].voiceover (string)
 * blueprint.scenes[].camera_movement
 * blueprint.scenes[].onscreen_text (string)
 * (fallback tetap support visual_prompt, voiceover.text, camera_angle)
 */
function extractScenes(blueprint, defaultSecondsPerScene = 8) {
  if (!blueprint) return [];

  let bp = blueprint;
  try {
    if (typeof bp === "string") bp = safeJsonParseLoose(bp);
  } catch {}

  if (bp?.blueprint) bp = bp.blueprint;

  const arr = bp?.scenes;
  if (!Array.isArray(arr) || !arr.length) return [];

  let cursor = 0;
  return arr.map((s, idx) => {
    const n = s?.scene_number ?? idx + 1;
    const dur = Number(s?.duration_seconds ?? defaultSecondsPerScene ?? 8);
    const start = cursor;
    const end = cursor + dur;
    cursor = end;

    const prompt =
      s?.visual_direction ||
      s?.visual_prompt ||
      s?.visualPrompt ||
      s?.shot_description ||
      s?.description ||
      "";

    const vo =
      (typeof s?.voiceover === "string" ? s.voiceover : s?.voiceover?.text) || "";

    const onScreen =
      (typeof s?.onscreen_text === "string" ? s.onscreen_text : s?.onscreen_text?.primary) ||
      s?.on_screen_text ||
      "";

    const camera =
      s?.camera_movement ||
      s?.camera_angle ||
      s?.camera ||
      "";

    return {
      id: `S${n}`,
      scene_number: n,
      time_window: `${start}s–${end}s`,
      prompt,
      vo_text: vo,
      on_screen_text: onScreen,
      camera,
      motion: s?.motion || "",
      raw: s,
    };
  });
}

function canGeneratePlan(p) {
  // kamu bisa longgarin aturan ini kalau backend plan tidak wajib ref images
  const required = ["brand", "product_type", "material", "platform", "aspect_ratio", "scene_count", "seconds_per_scene"];
  for (const k of required) {
    if (p[k] === undefined || p[k] === null || String(p[k]).trim() === "") return false;
  }
  // optional: kalau plan kamu butuh 2 ref image, hidupkan lagi
  if (!String(p.model_ref_url || "").trim() || !String(p.product_ref_url || "").trim()) return false;
  return true;
}

function buildImageBrief(scene, project) {
  const parts = [];
  if (scene?.prompt) parts.push(scene.prompt.trim());
  if (scene?.camera) parts.push(`Camera: ${scene.camera}.`);
  if (scene?.motion) parts.push(`Motion: ${scene.motion}.`);
  if (scene?.on_screen_text) parts.push(`On-screen text: "${scene.on_screen_text}".`);

  // anchor UGC style
  parts.push(
    "Style: photorealistic, clean commercial look, natural lighting, handheld phone camera vibe, sharp focus, high detail, realistic textures."
  );

  if (project?.brand || project?.product_type) {
    parts.push(`Product context: ${project?.brand || ""} ${project?.product_type || ""}.`);
  }

  return parts.filter(Boolean).join("\n");
}

/**
 * ✅ /api/jobs POST shape (sesuai shortcut kamu):
 * { type:"image", brief:"...", settings:{ aspect_ratio:"9:16" } }
 * ✅ Response sukses (sesuai Network kamu):
 * { id:"...", status:"done", imageUrl:"https://..." }
 */
async function createImageJob({ scene, project }) {
  const payload = {
    type: "image",
    brief: buildImageBrief(scene, project),
    settings: { aspect_ratio: project?.aspect_ratio || "9:16" },
  };

  const r = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

  return json; // { id, status, imageUrl }
}

export default function StudioShell({ onLogout }) {
  const [tab, setTab] = useState("Scenes");

  const [lang, setLang] = useState(() => localStorage.getItem(LS_LANG) || "id");
  const [theme, setTheme] = useState(() => localStorage.getItem(LS_THEME) || "dark");
  const t = i18n[lang] || i18n.id;

  // project draft (simple + kompatibel)
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
    product_page_url: "",
    // assets
    project_id: "local",
    model_ref_url: "",
    product_ref_url: "",
  }));

  const [blueprint, setBlueprint] = useState(null);

  // plan status
  const [statusOpen, setStatusOpen] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef(null);

  // per-scene image state
  const [sceneGen, setSceneGen] = useState({}); // {S1:{status, jobId, imageUrl, error}}

  // toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  function showToast(msg, tone = "ok") {
    setToast({ msg, tone, ts: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    localStorage.setItem(LS_LANG, lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(LS_THEME, theme);
    document.documentElement.dataset.theme = theme; // global.css kamu pakai ini
  }, [theme]);

  useEffect(() => {
    if (!loadingPlan) return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [loadingPlan]);

  const scenes = useMemo(() => extractScenes(blueprint, project.seconds_per_scene || 8), [blueprint, project.seconds_per_scene]);

  const est = Math.max(0, Number(project.scene_count || 0) * Number(project.seconds_per_scene || 0));

  async function onGenerateImage(scene) {
    const key = scene?.id;
    if (!key) return;

    setSceneGen((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), status: "generating", error: "" },
    }));

    try {
      const job = await createImageJob({ scene, project });
      const img =
        job.imageUrl || job.image_url || job.imageURL || "";

      setSceneGen((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          status: job.status || "done",
          jobId: job.id,
          imageUrl: img,
          error: "",
        },
      }));

      if (img) showToast(`${key}: ${t.imageReady}`, "ok");
      else showToast(`${key}: done but no image URL`, "bad");
    } catch (e) {
      setSceneGen((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), status: "failed", error: e?.message || String(e) },
      }));
      showToast(`${key}: ${t.imageFailed}`, "bad");
    }
  }

  async function onGeneratePlan() {
    if (!canGeneratePlan(project) || loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: (project.ai_brain || "bedrock").toLowerCase(), project }),
        signal: ctrl.signal,
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON /api/plan (${r.status}). Preview: ${String(raw).slice(0, 200)}`);
      }

      if (!r.ok) throw new Error(json?.error || `Plan failed (${r.status})`);
      if (!json?.blueprint) throw new Error("Plan OK tapi blueprint kosong.");

      setBlueprint(json.blueprint);
      setTab("Scenes");
      showToast("Plan generated ✓", "ok");
    } catch (e) {
      if (e?.name === "AbortError") setPlanError("Canceled");
      else setPlanError(e?.message || String(e));
      showToast(t.imageFailed, "bad");
    } finally {
      setLoadingPlan(false);
      abortRef.current = null;
    }
  }

  function openJson() {
    const w = window.open("", "_blank");
    if (!w) return;
    const safe = (x) => String(x).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    w.document.write(`<pre style="white-space:pre-wrap; font-family: ui-monospace, Menlo, monospace; padding:16px;">${safe(
      JSON.stringify(blueprint, null, 2)
    )}</pre>`);
    w.document.close();
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blueprint.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ugc-page">
      {/* Topbar */}
      <div className="ugc-topbar">
        <div className="ugc-topbar-inner">
          <div className="ugc-title">{t.studio}</div>

          <div className="ugc-top-actions">
            <div className="ugc-pill">
              <div className="ugc-pill-label">{t.language}</div>
              <button className={`ugc-pill-btn ${lang === "id" ? "active" : ""}`} onClick={() => setLang("id")}>
                ID
              </button>
              <button className={`ugc-pill-btn ${lang === "en" ? "active" : ""}`} onClick={() => setLang("en")}>
                EN
              </button>
            </div>

            <button className="ugc-pill-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? t.light : t.dark}
            </button>

            {typeof onLogout === "function" ? (
              <button className="ugc-pill-btn" onClick={onLogout}>
                {t.logout}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ugc-container">
        <div className="ugc-chiprow" style={{ marginBottom: 12 }}>
          <button className={`ugc-tab ${tab === "Settings" ? "active" : ""}`} onClick={() => setTab("Settings")}>
            {t.settings}
          </button>
          <button className={`ugc-tab ${tab === "Scenes" ? "active" : ""}`} onClick={() => setTab("Scenes")}>
            {t.scenes}
          </button>
          <button className={`ugc-tab ${tab === "Export" ? "active" : ""}`} onClick={() => setTab("Export")}>
            {t.export}
          </button>
        </div>

        {/* SETTINGS */}
        {tab === "Settings" ? (
          <div className="ugc-card">
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">{t.settings}</div>
            </div>

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">{t.aiBrain}</div>
                <select className="ugc-select" value={project.ai_brain} onChange={(e) => setProject((p) => ({ ...p, ai_brain: e.target.value }))}>
                  <option value="bedrock">Bedrock</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>

              <div>
                <div className="ugc-label">{t.productUrl}</div>
                <input
                  className="ugc-input"
                  value={project.product_page_url}
                  onChange={(e) => setProject((p) => ({ ...p, product_page_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">{t.platform}</div>
                <select className="ugc-select" value={project.platform} onChange={(e) => setProject((p) => ({ ...p, platform: e.target.value }))}>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram Reels</option>
                  <option value="youtube">YouTube Shorts</option>
                  <option value="facebook">Facebook Reels</option>
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
            </div>

            <div style={{ height: 10 }} />

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">{t.sceneCount}</div>
                <select
                  className="ugc-select"
                  value={String(project.scene_count)}
                  onChange={(e) => setProject((p) => ({ ...p, scene_count: Number(e.target.value) }))}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="ugc-label">{t.secondsPerScene}</div>
                <select
                  className="ugc-select"
                  value={String(project.seconds_per_scene)}
                  onChange={(e) => setProject((p) => ({ ...p, seconds_per_scene: Number(e.target.value) }))}
                >
                  {[4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}s
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">{t.brand}</div>
                <input className="ugc-input" value={project.brand} onChange={(e) => setProject((p) => ({ ...p, brand: e.target.value }))} />
              </div>
              <div>
                <div className="ugc-label">{t.productType}</div>
                <input
                  className="ugc-input"
                  value={project.product_type}
                  onChange={(e) => setProject((p) => ({ ...p, product_type: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">{t.material}</div>
                <input className="ugc-input" value={project.material} onChange={(e) => setProject((p) => ({ ...p, material: e.target.value }))} />
              </div>
              <div>
                <div className="ugc-label">{t.tone}</div>
                <input className="ugc-input" value={project.tone} onChange={(e) => setProject((p) => ({ ...p, tone: e.target.value }))} />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="ugc-grid2">
              <div>
                <div className="ugc-label">{t.targetAudience}</div>
                <input
                  className="ugc-input"
                  value={project.target_audience}
                  onChange={(e) => setProject((p) => ({ ...p, target_audience: e.target.value }))}
                />
              </div>
              <div />
            </div>

            <div style={{ height: 14 }} />

            <div className="ugc-sectiontitle">{t.assets}</div>

            <div className="ugc-grid2">
              <ImageUploadField
                label={t.modelRef}
                kind="model"
                projectId={project.project_id}
                valueUrl={project.model_ref_url}
                onUrl={(url) => setProject((p) => ({ ...p, model_ref_url: url }))}
                showPreview
                optional
              />
              <ImageUploadField
                label={t.productRef}
                kind="product"
                projectId={project.project_id}
                valueUrl={project.product_ref_url}
                onUrl={(url) => setProject((p) => ({ ...p, product_ref_url: url }))}
                showPreview
                optional
              />
            </div>

            {planError ? <div className="ugc-error">{planError}</div> : null}

            <div className="ugc-generate" style={{ justifyContent: "flex-end" }}>
              <button className="ugc-btn" onClick={() => showToast("Draft saved ✓", "ok")}>
                {t.saveDraft}
              </button>

              <button
                className="ugc-btn primary"
                disabled={!canGeneratePlan(project) || loadingPlan}
                onClick={onGeneratePlan}
              >
                {loadingPlan ? t.generating : t.generatePlan}
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

            {!blueprint ? (
              <div className="ugc-muted-box">{t.noBlueprint}</div>
            ) : scenes.length === 0 ? (
              <>
                <div className="ugc-muted-box">{t.beatsNotReadable}</div>
                <div className="ugc-row-actions" style={{ marginTop: 10 }}>
                  <button className="ugc-btn" onClick={openJson}>
                    {t.openJson}
                  </button>
                  <button className="ugc-btn" onClick={downloadJson}>
                    {t.downloadJson}
                  </button>
                </div>
              </>
            ) : (
              <div className="ugc-list">
                {scenes.map((s) => {
                  const st = sceneGen[s.id] || {};
                  const generating = st.status === "generating";
                  const img = st.imageUrl;

                  return (
                    <div key={s.id} className="ugc-scene">
                      <div className="ugc-scene-top">
                        <span className="ugc-badge">{s.id}</span>
                        <div className="ugc-scene-title">SCENE</div>
                        <span className="ugc-chip">{s.time_window}</span>
                        {s.camera ? <span className="ugc-chip">{s.camera}</span> : null}
                      </div>

                      {s.prompt ? (
                        <div className="ugc-row">
                          <div className="ugc-row-label">{t.prompt}</div>
                          <div className="ugc-row-val">{s.prompt}</div>
                        </div>
                      ) : null}

                      {s.vo_text ? (
                        <div className="ugc-row">
                          <div className="ugc-row-label">{t.narration}</div>
                          <div className="ugc-row-val">{s.vo_text}</div>
                        </div>
                      ) : null}

                      {s.on_screen_text ? (
                        <div className="ugc-row">
                          <div className="ugc-row-label">{t.onScreen}</div>
                          <div className="ugc-row-val">{s.on_screen_text}</div>
                        </div>
                      ) : null}

                      <div className="ugc-row-actions" style={{ marginTop: 10 }}>
                        <button className={`ugc-btn primary ${generating ? "loading" : ""}`} disabled={generating} onClick={() => onGenerateImage(s)}>
                          {generating ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                              <span className="ugc-spinner" />
                              {t.generating}
                            </span>
                          ) : (
                            t.generateImage
                          )}
                        </button>

                        {st.error ? <span className="ugc-chip bad">{st.error}</span> : null}
                        {st.jobId ? <span className="ugc-chip">job: {st.jobId}</span> : null}
                      </div>

                      {img ? (
                        <div className="ugc-row" style={{ marginTop: 12 }}>
                          <div className="ugc-row-label">{t.imageReady}</div>
                          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--stroke)" }}>
                            <img src={img} alt={`${s.id}`} style={{ width: "100%", display: "block" }} />
                          </div>
                          <div className="ugc-row-actions" style={{ marginTop: 10 }}>
                            <a className="ugc-btn" href={img} target="_blank" rel="noreferrer">
                              {t.openImage}
                            </a>
                            <a className="ugc-btn" href={img} download={`${s.id}.png`}>
                              {t.downloadImage}
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <div className="ugc-row-actions" style={{ marginTop: 6 }}>
                  <button className="ugc-btn" onClick={openJson}>
                    {t.openJson}
                  </button>
                  <button className="ugc-btn" onClick={downloadJson}>
                    {t.downloadJson}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* EXPORT */}
        {tab === "Export" ? (
          <div className="ugc-card">
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">{t.export}</div>
            </div>

            {!blueprint ? (
              <div className="ugc-muted-box">{t.noBlueprint}</div>
            ) : (
              <div className="ugc-row-actions">
                <button className="ugc-btn" onClick={openJson}>
                  {t.openJson}
                </button>
                <button className="ugc-btn" onClick={downloadJson}>
                  {t.downloadJson}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Status Dock (uses global.css .ugc-status) */}
      <div className={`ugc-status ${statusOpen ? "" : "collapsed"}`}>
        <div className="ugc-status-inner">
          <div className="ugc-status-head">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="ugc-status-title">{t.status}</div>
              {/* ✅ spinner tetap muncul walau minimized */}
              {loadingPlan ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span className="ugc-spinner" />
                  <span className="ugc-muted">{t.generating} · {elapsed}s</span>
                </div>
              ) : null}
            </div>

            <button className="ugc-btn small" onClick={() => setStatusOpen((v) => !v)}>
              {statusOpen ? t.minimize : t.show}
            </button>
          </div>

          {statusOpen ? (
            <>
              <div className="ugc-chiprow" style={{ marginTop: 6 }}>
                <span className={`ugc-chip ok`}>Core ✓</span>
                <span className={`ugc-chip ${project.model_ref_url ? "ok" : ""}`}>Model {project.model_ref_url ? "✓" : "×"}</span>
                <span className={`ugc-chip ${project.product_ref_url ? "ok" : ""}`}>Product {project.product_ref_url ? "✓" : "×"}</span>
                <span className="ugc-chip">≈ {est}s</span>
                <span className="ugc-chip">Provider: {(project.ai_brain || "bedrock").toUpperCase()}</span>
              </div>

              <div className="ugc-progress">
                <div className="ugc-progress-track">
                  <div
                    className="ugc-progress-bar"
                    style={{
                      width: loadingPlan ? `${clamp((elapsed / Math.max(1, est)) * 100, 6, 92)}%` : "0%",
                    }}
                  />
                </div>
                <div className="ugc-progress-meta">
                  <span>{t.progress}</span>
                  {loadingPlan ? (
                    <button
                      className="ugc-btn small"
                      onClick={() => {
                        try { abortRef.current?.abort?.(); } catch {}
                      }}
                    >
                      {t.cancel}
                    </button>
                  ) : <span />}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Toast */}
      {toast ? (
        <div className={`ugc-toast ${toast.tone === "ok" ? "ok" : "bad"}`}>
          {toast.msg}
        </div>
      ) : null}

      {/* Credit */}
      <div className="ugc-credit">Created by @adryndian</div>
    </div>
  );
}
