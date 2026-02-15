// StudioShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Settings", "Scenes", "Export"];

const LS_THEME = "ugc_theme"; // "dark" | "light"
const LS_LANG = "ugc_lang"; // "id" | "en"

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
    provider: "AI Brain",
    productUrl: "Product page URL (optional)",
    autofillBtn: "Auto-fill from Link",
    analyzing: "Analyzing…",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds / scene",
    brand: "Brand",
    productType: "Product type",
    material: "Material",
    tone: "Tone (optional)",
    targetAudience: "Target audience (optional)",
    assets: "Assets (optional)",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    generate: "Generate Plan",
    generating: "Generating…",
    cancel: "Cancel",
    status: "Status",
    show: "Show",
    minimize: "Minimize",
    success: "Generate sukses ✓",
    failed: "Generate gagal",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    noBlueprint: "Belum ada blueprint. Generate dulu di Settings.",
    beatsNotReadable: "Blueprint ada, tapi scenes/beats tidak terbaca.",
    workflow: "plan → image → approve → video → audio",
    createdBy: "Created by",
    // scene ui
    prompt: "Prompt",
    naration: "Narasi (VO)",
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
    provider: "AI Brain",
    productUrl: "Product page URL (optional)",
    autofillBtn: "Auto-fill from Link",
    analyzing: "Analyzing…",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds / scene",
    brand: "Brand",
    productType: "Product type",
    material: "Material",
    tone: "Tone (optional)",
    targetAudience: "Target audience (optional)",
    assets: "Assets (optional)",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    generate: "Generate Plan",
    generating: "Generating…",
    cancel: "Cancel",
    status: "Status",
    show: "Show",
    minimize: "Minimize",
    success: "Generate success ✓",
    failed: "Generate failed",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    noBlueprint: "No blueprint yet. Generate it in Settings.",
    beatsNotReadable: "Blueprint exists, but scenes/beats not readable.",
    workflow: "plan → image → approve → video → audio",
    createdBy: "Created by",
    // scene ui
    prompt: "Prompt",
    naration: "Narration (VO)",
    onScreen: "On-screen",
    generateImage: "Generate Image",
    imageReady: "Image ready ✓",
    imageFailed: "Image failed",
    openImage: "Open",
    downloadImage: "Download",
  },
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function safeJsonParseLoose(content) {
  try {
    return JSON.parse(content);
  } catch {
    const s = String(content || "");
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
    throw new Error("Invalid JSON");
  }
}

/**
 * ✅ Supports your current blueprint schema:
 * json.blueprint.scenes[] with visual_prompt + voiceover.text + onscreen_text + duration_seconds
 */
function extractScenes(blueprint, defaultSecondsPerScene = 8) {
  if (!blueprint) return [];

  let bp = blueprint;
  try {
    if (typeof bp === "string") bp = safeJsonParseLoose(bp);
  } catch {}

  if (bp?.blueprint) bp = bp.blueprint;

  const directScenes = bp?.scenes;
  if (Array.isArray(directScenes) && directScenes.length) {
    let cursor = 0;
    return directScenes.map((s, idx) => {
      const n = s?.scene_number ?? idx + 1;
      const dur = Number(s?.duration_seconds ?? defaultSecondsPerScene ?? 8);
      const start = cursor;
      const end = cursor + dur;
      cursor = end;

      const onScreen =
        s?.onscreen_text?.primary ||
        s?.onscreen_text?.secondary ||
        s?.on_screen_text ||
        s?.text_overlay?.primary ||
        s?.text_overlay?.secondary ||
        "";

      return {
        id: `S${n}`,
        scene_number: n,
        time_window: `${start}s–${end}s`,
        camera: s?.camera_angle || s?.camera || "",
        motion: s?.motion || "",
        prompt: s?.visual_prompt || "", // ✅ your #1
        action: s?.shot_description || s?.description || "",
        on_screen_text: onScreen,
        vo_text: s?.voiceover?.text || "",
        raw: s,
      };
    });
  }

  // fallback (optional)
  return [];
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function canGeneratePlan(p) {
  const required = ["brand", "product_type", "material", "platform", "aspect_ratio", "scene_count", "seconds_per_scene"];
  for (const k of required) {
    if (p[k] === undefined || p[k] === null || String(p[k]).trim() === "") return false;
  }
  // backend kamu sekarang memang butuh dua URL ini (sesuai flow kamu sebelumnya)
  if (!String(p.model_ref_url || "").trim() || !String(p.product_ref_url || "").trim()) return false;
  return true;
}

async function generatePlan({
  projectDraft,
  setProjectDraft,
  setBlueprint,
  setTab,
  setLoadingPlan,
  setPlanError,
  abortRef,
  showToast,
  t,
}) {
  if (!canGeneratePlan(projectDraft)) return;

  setPlanError("");
  setLoadingPlan(true);
  setProjectDraft(projectDraft);

  const provider = (projectDraft.ai_brain || "bedrock").toLowerCase();

  const ctrl = new AbortController();
  abortRef.current = ctrl;

  try {
    const r = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, project: projectDraft }),
      signal: ctrl.signal,
    });

    const raw = await r.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(`Non-JSON response (${r.status}). Preview: ${String(raw).slice(0, 200)}`);
    }

    if (!r.ok || !json?.ok) throw new Error(json?.error || `${t.failed} (${r.status})`);
    if (!json?.blueprint) throw new Error("Plan OK tapi blueprint kosong.");

    setBlueprint(json.blueprint);
    setTab("Scenes");
    showToast(t.success, "ok");
  } catch (e) {
    if (e?.name === "AbortError") {
      setPlanError("Canceled.");
    } else {
      setPlanError(e?.message || String(e));
      showToast(t.failed, "bad");
    }
  } finally {
    setLoadingPlan(false);
    abortRef.current = null;
  }
}

/** Build brief for /api/jobs based on scene */
function buildImageBrief(scene, projectDraft) {
  const parts = [];

  // Primary prompt
  if (scene?.prompt) parts.push(scene.prompt.trim());

  // Add camera context if exists
  const cameraBits = [];
  if (scene?.camera) cameraBits.push(`Camera angle: ${scene.camera}`);
  if (scene?.motion) cameraBits.push(`Motion: ${scene.motion}`);
  if (cameraBits.length) parts.push(cameraBits.join(". ") + ".");

  // On-screen can help composition
  if (scene?.on_screen_text) parts.push(`On-screen text: "${scene.on_screen_text}".`);

  // Global style anchor
  parts.push(
    `Style: photorealistic, clean commercial look, natural lighting, handheld phone camera vibe, sharp focus, high detail, realistic textures.`
  );

  // optional product context from project
  if (projectDraft?.brand || projectDraft?.product_type) {
    parts.push(
      `Product context: ${projectDraft?.brand || ""} ${projectDraft?.product_type || ""}.`
    );
  }

  return parts.filter(Boolean).join("\n");
}

/** Create job (image) */
async function createImageJob({ scene, projectDraft }) {
  const brief = buildImageBrief(scene, projectDraft);

  const payload = {
    type: "image",
    brief,
    settings: {
      aspect_ratio: projectDraft?.aspect_ratio || "9:16",
    },
  };

  const r = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await r.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`Non-JSON jobs response (${r.status}). Preview: ${String(raw).slice(0, 200)}`);
  }

  if (!r.ok || !json?.ok) throw new Error(json?.error || `Jobs failed (${r.status})`);
  if (!json?.job) throw new Error("Jobs OK tapi job kosong.");

  return json.job; // { id, status, image_url, ... }
}

/* =========================
   MAIN
   ========================= */

export default function StudioShell({ onLogout }) {
  const [tab, setTab] = useState("Settings");

  const [lang, setLang] = useState(() => localStorage.getItem(LS_LANG) || "id");
  const [theme, setTheme] = useState(() => localStorage.getItem(LS_THEME) || "dark");

  const t = i18n[lang] || i18n.id;

  const [projectDraft, setProjectDraft] = useState({
    ...DEFAULT_PROJECT,
    ai_brain: "bedrock",
    platform: DEFAULT_PROJECT?.platform || "tiktok",
    aspect_ratio: DEFAULT_PROJECT?.aspect_ratio || "9:16",
    scene_count: DEFAULT_PROJECT?.scene_count || 6,
    seconds_per_scene: DEFAULT_PROJECT?.seconds_per_scene || 8,
    product_page_url: "",
    tone: DEFAULT_PROJECT?.tone || "",
    target_audience: DEFAULT_PROJECT?.target_audience || "",
    model_ref_url: DEFAULT_PROJECT?.model_ref_url || "",
    product_ref_url: DEFAULT_PROJECT?.product_ref_url || "",
  });

  const [blueprint, setBlueprint] = useState(null);

  // Plan status
  const [statusOpen, setStatusOpen] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef(null);

  // Per-scene generation state (image only)
  // key: scene.id (S1..)
  const [sceneGen, setSceneGen] = useState({}); // { S1: { status, job_id, image_url, error } }

  // toast
  const [toast, setToast] = useState(null);
  function showToast(msg, tone = "ok") {
    setToast({ msg, tone, ts: Date.now() });
    setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    localStorage.setItem(LS_LANG, lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(LS_THEME, theme);
    document.documentElement.dataset.theme = theme; // IMPORTANT for your global.css
  }, [theme]);

  useEffect(() => {
    if (!loadingPlan) return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      setElapsed(s);
    }, 250);
    return () => clearInterval(id);
  }, [loadingPlan]);

  const scenes = useMemo(
    () => extractScenes(blueprint, projectDraft?.seconds_per_scene || 8),
    [blueprint, projectDraft]
  );

  async function handleGenerateImage(scene) {
    const key = scene?.id;
    if (!key) return;

    // lock state
    setSceneGen((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), status: "generating", error: "" },
    }));

    try {
      const job = await createImageJob({ scene, projectDraft });

      // image job returns done + image_url (based on your backend)
      setSceneGen((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          status: job.status || "done",
          job_id: job.id,
          image_url: job.image_url || "",
          error: "",
        },
      }));

      showToast(`${key}: ${t.imageReady}`, "ok");
    } catch (e) {
      setSceneGen((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), status: "failed", error: e?.message || String(e) },
      }));
      showToast(`${key}: ${t.imageFailed}`, "bad");
    }
  }

  function openJson() {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `
      <pre style="white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; padding:16px;">
${escapeHtml(JSON.stringify(blueprint, null, 2))}
      </pre>`;
    w.document.write(html);
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

  const est = Math.max(0, Number(projectDraft?.scene_count || 0) * Number(projectDraft?.seconds_per_scene || 0));

  return (
    <div style={styles.page}>
      {/* Top bar (single source of truth) */}
      <div style={styles.topBar}>
        <div style={styles.topBarInner}>
          <div style={styles.title}>{t.studio}</div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <LangToggle lang={lang} setLang={setLang} t={t} />
            <ThemeToggle theme={theme} setTheme={setTheme} />
            {typeof onLogout === "function" ? (
              <button type="button" style={styles.ghostBtn} onClick={onLogout}>
                {t.logout}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div style={styles.container}>
        <div style={styles.tabsTop}>
          {TABS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setTab(x)}
              style={{ ...styles.tabPill, ...(tab === x ? styles.tabPillActive : {}) }}
            >
              {t[x.toLowerCase()] || x}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          {tab === "Settings" ? (
            <SettingsTab
              t={t}
              lang={lang}
              projectDraft={projectDraft}
              setProjectDraft={setProjectDraft}
              setBlueprint={setBlueprint}
              setTab={setTab}
              loadingPlan={loadingPlan}
              setLoadingPlan={setLoadingPlan}
              planError={planError}
              setPlanError={setPlanError}
              abortRef={abortRef}
              showToast={showToast}
            />
          ) : null}

          {tab === "Scenes" ? (
            <ScenesTab
              t={t}
              blueprint={blueprint}
              scenes={scenes}
              onOpenJson={openJson}
              onDownloadJson={downloadJson}
              projectDraft={projectDraft}
              sceneGen={sceneGen}
              onGenerateImage={handleGenerateImage}
            />
          ) : null}

          {tab === "Export" ? (
            <ExportTab t={t} blueprint={blueprint} onOpenJson={openJson} onDownloadJson={downloadJson} />
          ) : null}
        </div>
      </div>

      {/* Status Dock */}
      <div style={styles.statusWrap}>
        <div style={{ ...styles.statusCard, ...(statusOpen ? {} : styles.statusCardCollapsed) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>{t.status}</div>

              {/* ✅ spinner always visible even when minimized */}
              {loadingPlan ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: 0.85 }}>
                  <span style={styles.spinner} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)" }}>
                    {t.generating} · {elapsed}s
                  </span>
                </div>
              ) : null}
            </div>

            <button type="button" style={styles.ghostBtn} onClick={() => setStatusOpen((v) => !v)}>
              {statusOpen ? t.minimize : t.show}
            </button>
          </div>

          {statusOpen ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <Pill ok={!!String(projectDraft?.brand || "").trim()} label="Core" />
                <Pill ok={!!String(projectDraft?.model_ref_url || "").trim()} label="Model" />
                <Pill ok={!!String(projectDraft?.product_ref_url || "").trim()} label="Product" />
                <span style={styles.miniPill}>≈ {est}s</span>
                <span style={styles.miniPill}>Provider: {(projectDraft.ai_brain || "bedrock").toUpperCase()}</span>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Progress</div>
                  {loadingPlan ? (
                    <button
                      type="button"
                      style={styles.secondaryBtn}
                      onClick={() => {
                        try {
                          abortRef.current?.abort?.();
                        } catch {}
                      }}
                    >
                      {t.cancel}
                    </button>
                  ) : null}
                </div>

                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: loadingPlan ? `${clamp((elapsed / Math.max(1, est)) * 100, 6, 92)}%` : "0%",
                      opacity: loadingPlan ? 1 : 0,
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                style={{
                  ...styles.primaryBtn,
                  marginTop: 10,
                  opacity: canGeneratePlan(projectDraft) && !loadingPlan ? 1 : 0.55,
                  cursor: canGeneratePlan(projectDraft) && !loadingPlan ? "pointer" : "not-allowed",
                }}
                disabled={!canGeneratePlan(projectDraft) || loadingPlan}
                onClick={() =>
                  generatePlan({
                    projectDraft,
                    setProjectDraft,
                    setBlueprint,
                    setTab,
                    setLoadingPlan,
                    setPlanError,
                    abortRef,
                    showToast,
                    t,
                  })
                }
              >
                {loadingPlan ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <span style={styles.spinner} />
                    {t.generating}
                  </span>
                ) : (
                  t.generate
                )}
              </button>

              {planError ? <div style={styles.errorBox}>{planError}</div> : null}
            </>
          ) : null}
        </div>
      </div>

      {/* Credit bar */}
      <div style={styles.creditBar}>
        <span style={{ opacity: 0.75 }}>
          {t.createdBy} <b>@adryndian</b>
        </span>
      </div>

      {/* Toast */}
      {toast ? (
        <div style={styles.toastWrap}>
          <div
            style={{
              ...styles.toast,
              borderColor: toast.tone === "ok" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
              background: toast.tone === "ok" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 12 }}>{toast.msg}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   Tabs
   ========================= */

function SettingsTab({
  t,
  lang,
  projectDraft,
  setProjectDraft,
  setBlueprint,
  setTab,
  loadingPlan,
  setLoadingPlan,
  planError,
  setPlanError,
  abortRef,
  showToast,
}) {
  const [p, setP] = useState(projectDraft);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoInfo, setAutoInfo] = useState("");

  useEffect(() => setP(projectDraft), [projectDraft]);

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  async function autoFillFromLink() {
    if (analyzing) return;
    const url = (p.product_page_url || "").trim();
    if (!url) return;

    setAnalyzing(true);
    setAutoInfo("");
    setPlanError("");

    try {
      const r = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, lang: lang || "id" }),
      });

      const raw = await r.text();
      const json = raw ? safeJsonParseLoose(raw) : null;

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Scrape failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : f.brand || "",
        product_type: prev.product_type?.trim() ? prev.product_type : f.product_type || "",
        material: prev.material?.trim() ? prev.material : f.material || "",
        tone: prev.tone?.trim() ? prev.tone : f.tone || "",
        target_audience: prev.target_audience?.trim() ? prev.target_audience : f.target_audience || "",
      }));

      setAutoInfo("✓");
    } catch (e) {
      setPlanError(e?.message || String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  const compactGap = 10;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{t.settings}</div>
      </div>

      <div style={{ display: "grid", gap: compactGap }}>
        <Field label={t.provider}>
          <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
            <option value="bedrock">Bedrock</option>
            <option value="gemini">Gemini</option>
          </Select>
        </Field>

        <div style={styles.inlineRow}>
          <div style={{ flex: 1 }}>
            <Field label={t.productUrl}>
              <Input value={p.product_page_url || ""} onChange={(e) => update("product_page_url", e.target.value)} placeholder="https://..." />
            </Field>
          </div>
          <button type="button" onClick={autoFillFromLink} disabled={analyzing || !(p.product_page_url || "").trim()} style={styles.secondaryBtn}>
            {analyzing ? t.analyzing : t.autofillBtn} {autoInfo ? autoInfo : ""}
          </button>
        </div>

        <div style={styles.grid3}>
          <Field label={t.platform}>
            <Select value={p.platform || "tiktok"} onChange={(e) => update("platform", e.target.value)}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram Reels</option>
              <option value="facebook">Facebook Reels</option>
              <option value="youtube">YouTube Shorts</option>
            </Select>
          </Field>

          <Field label={t.aspectRatio}>
            <Select value={p.aspect_ratio || "9:16"} onChange={(e) => update("aspect_ratio", e.target.value)}>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
            </Select>
          </Field>

          <Field label={t.sceneCount}>
            <Select value={String(p.scene_count || 6)} onChange={(e) => update("scene_count", Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div style={styles.grid3}>
          <Field label={t.secondsPerScene}>
            <Select value={String(p.seconds_per_scene || 8)} onChange={(e) => update("seconds_per_scene", Number(e.target.value))}>
              {[4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={String(n)}>
                  {n}s
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t.brand + " *"}>
            <Input value={p.brand || ""} onChange={(e) => update("brand", e.target.value)} placeholder="Brand" />
          </Field>

          <Field label={t.productType + " *"}>
            <Input value={p.product_type || ""} onChange={(e) => update("product_type", e.target.value)} placeholder="e.g. hoodie" />
          </Field>
        </div>

        <div style={styles.grid3}>
          <Field label={t.material + " *"}>
            <Input value={p.material || ""} onChange={(e) => update("material", e.target.value)} placeholder="e.g. cotton" />
          </Field>

          <Field label={t.tone}>
            <Input value={p.tone || ""} onChange={(e) => update("tone", e.target.value)} placeholder="natural gen-z" />
          </Field>

          <Field label={t.targetAudience}>
            <Input value={p.target_audience || ""} onChange={(e) => update("target_audience", e.target.value)} placeholder="e.g. students" />
          </Field>
        </div>

        <div style={{ marginTop: 4 }}>
          <div style={styles.sectionTitle}>{t.assets}</div>
          <div style={styles.grid2}>
            <ImageUploadField
              label={t.modelRef}
              kind="model"
              projectId={p.project_id || "local"}
              valueUrl={p.model_ref_url || ""}
              onUrl={(url) => update("model_ref_url", url)}
              showPreview
              hideUrl
              optional
            />
            <ImageUploadField
              label={t.productRef}
              kind="product"
              projectId={p.project_id || "local"}
              valueUrl={p.product_ref_url || ""}
              onUrl={(url) => update("product_ref_url", url)}
              showPreview
              hideUrl
              optional
            />
          </div>
        </div>

        {planError ? <div style={styles.errorBox}>{planError}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() => {
              setProjectDraft(p);
              setBlueprint(null);
              setTab("Settings");
              showToast("Draft saved", "ok");
            }}
          >
            Save Draft
          </button>

          <button
            type="button"
            style={{ ...styles.primaryBtn, opacity: canGeneratePlan(p) && !loadingPlan ? 1 : 0.55 }}
            disabled={!canGeneratePlan(p) || loadingPlan}
            onClick={() =>
              generatePlan({
                projectDraft: p,
                setProjectDraft,
                setBlueprint,
                setTab,
                setLoadingPlan,
                setPlanError,
                abortRef,
                showToast,
                t,
              })
            }
          >
            {loadingPlan ? t.generating : t.generate}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScenesTab({ t, blueprint, scenes, onOpenJson, onDownloadJson, projectDraft, sceneGen, onGenerateImage }) {
  if (!blueprint) {
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>{t.scenes}</div>
          <div style={styles.cardSub}>{t.workflow}</div>
        </div>
        <div style={styles.placeholder}>{t.noBlueprint}</div>
      </div>
    );
  }

  if (!scenes.length) {
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>{t.scenes}</div>
          <div style={styles.cardSub}>{t.workflow}</div>
        </div>

        <div style={styles.placeholder}>{t.beatsNotReadable}</div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" style={styles.secondaryBtn} onClick={onOpenJson}>
            {t.openJson}
          </button>
          <button type="button" style={styles.secondaryBtn} onClick={onDownloadJson}>
            {t.downloadJson}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{t.scenes}</div>
        <div style={styles.cardSub}>{t.workflow}</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {scenes.map((s, idx) => {
          const st = sceneGen?.[s.id] || {};
          const isGenerating = st.status === "generating";
          const hasImg = !!st.image_url;

          return (
            <div key={s.id || idx} style={styles.sceneCard}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={styles.badge}>{s.id}</span>
                  <span style={{ fontWeight: 900, fontSize: 13 }}>SCENE</span>
                  <span style={styles.miniPill}>{s.time_window}</span>
                </div>
                {s.camera ? <span style={styles.miniPill}>{s.camera}</span> : null}
              </div>

              {/* PROMPT */}
              {s.prompt ? (
                <div style={{ marginTop: 8 }}>
                  <div style={styles.miniLabel}>{t.prompt}</div>
                  <div style={styles.miniBox}>{s.prompt}</div>
                </div>
              ) : null}

              {/* VO */}
              {s.vo_text ? (
                <div style={{ marginTop: 8 }}>
                  <div style={styles.miniLabel}>{t.naration}</div>
                  <div style={styles.miniBox}>{s.vo_text}</div>
                </div>
              ) : null}

              {/* On-screen */}
              {s.on_screen_text ? (
                <div style={{ marginTop: 8 }}>
                  <div style={styles.miniLabel}>{t.onScreen}</div>
                  <div style={styles.miniBox}>{s.on_screen_text}</div>
                </div>
              ) : null}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  style={{
                    ...styles.primaryBtn,
                    opacity: isGenerating ? 0.7 : 1,
                    cursor: isGenerating ? "not-allowed" : "pointer",
                  }}
                  disabled={isGenerating}
                  onClick={() => onGenerateImage(s)}
                >
                  {isGenerating ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <span style={styles.spinner} />
                      {t.generating}
                    </span>
                  ) : (
                    t.generateImage
                  )}
                </button>

                {st.error ? <span style={{ ...styles.miniPill, borderColor: "rgba(239,68,68,0.35)" }}>{st.error}</span> : null}
                {st.job_id ? <span style={styles.miniPill}>job: {st.job_id}</span> : null}
              </div>

              {/* Image preview */}
              {hasImg ? (
                <div style={{ marginTop: 10 }}>
                  <div style={styles.miniLabel}>{t.imageReady}</div>
                  <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
                    <img src={st.image_url} alt={`${s.id} image`} style={{ width: "100%", display: "block" }} />
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <a href={st.image_url} target="_blank" rel="noreferrer" style={{ ...styles.secondaryBtn, textDecoration: "none" }}>
                      {t.openImage}
                    </a>
                    <a href={st.image_url} download={`${s.id}.png`} style={{ ...styles.secondaryBtn, textDecoration: "none" }}>
                      {t.downloadImage}
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" style={styles.secondaryBtn} onClick={onOpenJson}>
          {t.openJson}
        </button>
        <button type="button" style={styles.secondaryBtn} onClick={onDownloadJson}>
          {t.downloadJson}
        </button>
      </div>
    </div>
  );
}

function ExportTab({ t, blueprint, onOpenJson, onDownloadJson }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{t.export}</div>
      </div>

      {!blueprint ? (
        <div style={styles.placeholder}>{t.noBlueprint}</div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={styles.secondaryBtn} onClick={onOpenJson}>
            {t.openJson}
          </button>
          <button type="button" style={styles.secondaryBtn} onClick={onDownloadJson}>
            {t.downloadJson}
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================
   Small UI components
   ========================= */

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={styles.label}>{label}</div>
      {children}
    </div>
  );
}
function Input(props) {
  return <input {...props} style={styles.input} />;
}
function Select(props) {
  return <select {...props} style={styles.select} />;
}

function Pill({ ok, label }) {
  return (
    <span
      style={{
        ...styles.pill,
        background: ok ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
        borderColor: ok ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)",
      }}
    >
      {label} {ok ? "✓" : "×"}
    </span>
  );
}

function LangToggle({ lang, setLang, t }) {
  return (
    <div style={styles.toggleGroup}>
      <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>{t.language}</span>
      <div style={styles.togglePills}>
        <button type="button" onClick={() => setLang("id")} style={{ ...styles.togglePill, ...(lang === "id" ? styles.togglePillActive : {}) }}>
          ID
        </button>
        <button type="button" onClick={() => setLang("en")} style={{ ...styles.togglePill, ...(lang === "en" ? styles.togglePillActive : {}) }}>
          EN
        </button>
      </div>
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" style={styles.ghostBtn} onClick={() => setTheme(next)}>
      {next === "dark" ? "Dark" : "Light"}
    </button>
  );
}

/* =========================
   Styles (compact)
   ========================= */

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(900px 500px at 20% 0%, rgba(249,115,22,0.18) 0%, rgba(0,0,0,0) 55%), var(--bg)",
    paddingBottom: 96,
    color: "var(--text)",
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    backdropFilter: "blur(14px)",
    background: "var(--topbar)",
    borderBottom: "1px solid var(--border)",
  },
  topBarInner: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontWeight: 900, fontSize: 15, letterSpacing: 0.2 },
  container: { maxWidth: 980, margin: "0 auto", padding: 12 },

  tabsTop: { display: "flex", gap: 8, flexWrap: "wrap" },
  tabPill: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--panel)",
    color: "var(--text)",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  },
  tabPillActive: {
    borderColor: "rgba(249,115,22,0.35)",
    background: "rgba(249,115,22,0.14)",
  },

  card: {
    borderRadius: 16,
    background: "linear-gradient(180deg, var(--panel2), var(--panel))",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow)",
    padding: 12,
  },
  cardHeader: { paddingBottom: 8, borderBottom: "1px solid var(--border)", marginBottom: 10 },
  cardTitle: { fontWeight: 900, fontSize: 14 },
  cardSub: { marginTop: 4, fontSize: 12, color: "var(--muted)", fontWeight: 700 },

  placeholder: {
    padding: 10,
    borderRadius: 14,
    border: "1px dashed var(--border)",
    color: "var(--muted)",
    background: "var(--soft)",
    fontWeight: 800,
    fontSize: 12,
  },

  grid3: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  inlineRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" },

  sectionTitle: { fontWeight: 900, fontSize: 12, opacity: 0.9, marginBottom: 8 },
  label: { fontSize: 11.5, fontWeight: 900, color: "var(--muted)" },

  input: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--field)",
    color: "var(--text)",
    outline: "none",
    fontWeight: 800,
    fontSize: 13,
  },
  select: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--field)",
    color: "var(--text)",
    outline: "none",
    fontWeight: 900,
    fontSize: 13,
  },

  primaryBtn: {
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(249,115,22,0.35)",
    background: "rgba(249,115,22,0.95)",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
  },
  secondaryBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--btn)",
    color: "var(--text)",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  },
  ghostBtn: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--btn)",
    color: "var(--text)",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  },

  sceneCard: { borderRadius: 14, padding: 10, border: "1px solid var(--border)", background: "var(--panel)" },
  badge: {
    fontWeight: 900,
    fontSize: 11.5,
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(249,115,22,0.14)",
    border: "1px solid rgba(249,115,22,0.25)",
  },
  miniPill: {
    fontSize: 11.5,
    fontWeight: 900,
    padding: "6px 9px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--btn)",
  },
  miniLabel: { fontSize: 11.5, fontWeight: 900, color: "var(--muted)", marginBottom: 6 },
  miniBox: {
    borderRadius: 12,
    padding: 9,
    background: "var(--soft2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontWeight: 750,
    fontSize: 12.5,
    whiteSpace: "pre-wrap",
  },

  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.22)",
    color: "var(--text)",
    fontWeight: 900,
    fontSize: 12,
  },

  toggleGroup: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--btn)",
  },
  togglePills: { display: "flex", gap: 6 },
  togglePill: {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontWeight: 900,
    fontSize: 12,
  },
  togglePillActive: { background: "var(--btn2)", borderColor: "rgba(249,115,22,0.30)" },

  // Status
  statusWrap: { position: "fixed", left: 0, right: 0, bottom: 34, zIndex: 60, pointerEvents: "none" },
  statusCard: {
    pointerEvents: "auto",
    maxWidth: 980,
    margin: "0 auto",
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "var(--drawer)",
    boxShadow: "var(--shadow)",
    padding: 12,
    marginLeft: 12,
    marginRight: 12,
  },
  statusCardCollapsed: { paddingBottom: 10 },
  pill: { fontSize: 11.5, fontWeight: 900, padding: "7px 10px", borderRadius: 999, border: "1px solid var(--border)" },

  progressBar: {
    height: 10,
    borderRadius: 999,
    background: "var(--progressTrack)",
    border: "1px solid var(--border)",
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: { height: "100%", background: "rgba(249,115,22,0.95)", borderRadius: 999, transition: "width 250ms ease" },

  spinner: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "2px solid rgba(249,115,22,0.28)",
    borderTopColor: "var(--orange)",
    animation: "ugc-spin 0.8s linear infinite",
  },

  creditBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderTop: "1px solid var(--border)",
    background: "var(--footer)",
    backdropFilter: "blur(10px)",
    zIndex: 55,
    fontSize: 12,
    fontWeight: 800,
    color: "var(--text)",
  },

  toastWrap: {
    position: "fixed",
    left: 0,
    right: 0,
    top: 60,
    zIndex: 80,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  },
  toast: {
    pointerEvents: "none",
    borderRadius: 999,
    border: "1px solid var(--border)",
    padding: "10px 12px",
    background: "var(--btn2)",
    backdropFilter: "blur(10px)",
    color: "var(--text)",
  },
};
