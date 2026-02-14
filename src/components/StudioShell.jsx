// src/components/StudioShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Settings", "Scenes", "Export"];

const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/* =========================
   i18n minimal
   ========================= */
const copy = {
  id: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Bahasa",
    dark: "Dark",
    light: "Light",
    aiBrain: "AI Brain",
    provider: "Provider",
    coreInputs: "Core Inputs",
    brand: "Brand",
    productType: "Product type",
    material: "Material",
    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds/scene",
    assetsOptional: "Assets (optional)",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    autofillLink: "Auto-fill from Link (optional)",
    landingUrl: "Product / Landing page URL",
    autofillBtn: "Auto-fill from Link",
    analyzeImagesBtn: "Auto-fill from Images",
    status: "Status",
    readiness: "Readiness",
    estDuration: "Estimated duration",
    progress: "Progress",
    elapsed: "Elapsed",
    eta: "ETA",
    generate: "Generate Plan",
    generating: "Generating…",
    cancel: "Cancel",
    minimize: "Minimize",
    show: "Show",
    success: "Generate success ✓",
    blueprintEmpty: "Blueprint kosong / tidak terbaca.",
    beatsNotReadable: "Blueprint ada, tapi beats tidak terbaca.",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    createdBy: "Created by @adryndian",
    requiredMissing: "Field wajib belum lengkap.",
  },
  en: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Language",
    dark: "Dark",
    light: "Light",
    aiBrain: "AI Brain",
    provider: "Provider",
    coreInputs: "Core Inputs",
    brand: "Brand",
    productType: "Product type",
    material: "Material",
    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds/scene",
    assetsOptional: "Assets (optional)",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    autofillLink: "Auto-fill from Link (optional)",
    landingUrl: "Product / Landing page URL",
    autofillBtn: "Auto-fill from Link",
    analyzeImagesBtn: "Auto-fill from Images",
    status: "Status",
    readiness: "Readiness",
    estDuration: "Estimated duration",
    progress: "Progress",
    elapsed: "Elapsed",
    eta: "ETA",
    generate: "Generate Plan",
    generating: "Generating…",
    cancel: "Cancel",
    minimize: "Minimize",
    show: "Show",
    success: "Generate success ✓",
    blueprintEmpty: "Blueprint is empty / unreadable.",
    beatsNotReadable: "Blueprint exists, but beats not readable.",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    createdBy: "Created by @adryndian",
    requiredMissing: "Required fields are incomplete.",
  }
};

function normalizeBlueprint(respBlueprint) {
  // handle: { blueprint: {...} } OR { blueprint: { blueprint: {...} } }
  if (!respBlueprint) return null;
  if (respBlueprint.blueprint && typeof respBlueprint.blueprint === "object") return respBlueprint.blueprint;
  return respBlueprint;
}

function buildBeatsFromScenePlans(bp) {
  // If already has storyboard beats, return it.
  const beats =
    bp?.storyboard?.beats ||
    bp?.SEGMENT_3?.storyboard?.beats ||
    bp?.segments?.storyboard?.beats ||
    null;

  if (Array.isArray(beats) && beats.length) return beats;

  const scenePlans = Array.isArray(bp?.scene_plans) ? bp.scene_plans : [];
  if (!scenePlans.length) return [];

  const vo = Array.isArray(bp?.voiceover_scripts) ? bp.voiceover_scripts : [];

  return scenePlans.map((s) => {
    const v = vo.find((x) => Number(x.scene_number) === Number(s.scene_number));
    return {
      id: `S${s.scene_number}`,
      goal: s.visual_focus || `Scene ${s.scene_number}`,
      time_window: `${s.scene_number}`,
      action: `${s.model_action || ""}${s.setting ? `\nSetting: ${s.setting}` : ""}${s.camera_movement ? `\nCamera: ${s.camera_movement}` : ""}`.trim(),
      on_screen_text: Array.isArray(v?.onscreen_text)
        ? v.onscreen_text.map((t) => t.text).join(" | ")
        : "",
      voiceover: v?.audio || "",
      negative_prompt: [], // blueprint kamu belum punya, UI tetap aman
    };
  });
}

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return JSON.stringify({ error: "Failed to stringify" }, null, 2);
  }
}

function downloadJson(filename, obj) {
  const blob = new Blob([safeJsonStringify(obj)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function StudioShell() {
  const [tab, setTab] = useState("Settings");

  // global studio state
  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" });
  const [blueprint, setBlueprint] = useState(null);

  // ui
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [toast, setToast] = useState({ open: false, msg: "" });

  // status panel
  const [statusCollapsed, setStatusCollapsed] = useState(false);

  // theme + lang
  const [lang, setLang] = useState(() => localStorage.getItem("ugc_lang") || "id");
  const [theme, setTheme] = useState(() => localStorage.getItem("ugc_theme") || "dark");

  // loading timer/progress
  const abortRef = useRef(null);
  const tickRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const t = copy[lang] || copy.id;

  useEffect(() => {
    localStorage.setItem("ugc_lang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("ugc_theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // timer tick while loading
  useEffect(() => {
    if (!loadingPlan) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    const start = Date.now();
    setElapsedMs(0);
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 250);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [loadingPlan]);

  // auto close toast
  useEffect(() => {
    if (!toast.open) return;
    const id = setTimeout(() => setToast({ open: false, msg: "" }), 2400);
    return () => clearTimeout(id);
  }, [toast.open]);

  const ctx = {
    tab,
    setTab,
    projectDraft,
    setProjectDraft,
    blueprint,
    setBlueprint,
    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,
    statusCollapsed,
    setStatusCollapsed,
    lang,
    setLang,
    theme,
    setTheme,
    t,
    toast,
    setToast,
    elapsedMs,
    abortRef
  };

  const content = useMemo(() => {
    if (tab === "Scenes") return <ScenesTab />;
    if (tab === "Export") return <ExportTab />;
    return <SettingsTab />;
  }, [tab]);

  return (
    <StudioContext.Provider value={ctx}>
      <style>{css}</style>

      <div className="page">
        {/* top bar */}
        <div className="topbar">
          <div className="topbar-inner">
            <div className="title">{t.studio}</div>

            <div className="top-actions">
              <div className="pill">
                <span className="pill-label">{t.language}</span>
                <button className={`pill-btn ${lang === "id" ? "active" : ""}`} onClick={() => setLang("id")}>ID</button>
                <button className={`pill-btn ${lang === "en" ? "active" : ""}`} onClick={() => setLang("en")}>EN</button>
              </div>

              <button className="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? t.light : t.dark}
              </button>
            </div>
          </div>
        </div>

        {/* content */}
        <div className="content">{content}</div>

        {/* bottom tabs */}
        <div className="tabbar">
          <div className="tabbar-inner">
            {TABS.map((x) => (
              <button
                key={x}
                className={`tabbtn ${tab === x ? "active" : ""}`}
                onClick={() => setTab(x)}
                type="button"
              >
                {x === "Settings" ? t.settings : x === "Scenes" ? t.scenes : t.export}
              </button>
            ))}
          </div>
        </div>

        {/* credit fixed (static, not scrolling) */}
        <div className="credit">{t.createdBy}</div>

        {/* toast */}
        {toast.open ? (
          <div className="toast">
            <div className="toast-inner">{toast.msg}</div>
          </div>
        ) : null}
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   TABS
   ========================= */

function SettingsTab() {
  const {
    setTab,
    projectDraft,
    setProjectDraft,
    setBlueprint,
    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,
    setToast,
    elapsedMs,
    abortRef,
    t
  } = useStudio();

  const [p, setP] = useState(projectDraft);

  const [analyzingImages, setAnalyzingImages] = useState(false);
  const [analyzingLink, setAnalyzingLink] = useState(false);
  const [landingUrl, setLandingUrl] = useState("");

  // computed
  const totalDurationSec = Number(p.scene_count || 0) * Number(p.seconds_per_scene || 0);
  const etaSec = Math.max(8, totalDurationSec + 10); // rough UI ETA

  const readyCore =
    (p.brand || "").trim() &&
    (p.product_type || "").trim() &&
    (p.material || "").trim();

  // assets optional (per request)
  const canGeneratePlan = Boolean(readyCore && (p.platform || "").trim() && (p.aspect_ratio || "").trim());

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function cancelGenerate() {
    try {
      abortRef.current?.abort?.();
    } catch {}
  }

  async function generatePlanOnce() {
    if (!canGeneratePlan || loadingPlan) {
      if (!canGeneratePlan) setPlanError(t.requiredMissing);
      return;
    }

    setPlanError("");
    setLoadingPlan(true);
    setProjectDraft(p);

    const provider = (p.ai_brain || "bedrock").toLowerCase();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const timeoutMs = 120000; // 2 menit
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, project: p }),
        signal: ctrl.signal
      });

      const raw = await r.text();
      let json = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON response (${r.status}). Preview: ${String(raw).slice(0, 220)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Plan failed (${r.status})`);

      // normalize blueprint shape
      const bp = normalizeBlueprint(json?.blueprint);
      if (!bp) throw new Error(t.blueprintEmpty);

      setBlueprint(bp);
      setToast({ open: true, msg: t.success });

      // go to Scenes tab
      setTab("Scenes");
    } catch (e) {
      if (e?.name === "AbortError") {
        setPlanError(`Timeout after ${Math.round(timeoutMs / 1000)}s.`);
      } else {
        setPlanError(e?.message || String(e));
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setLoadingPlan(false);
    }
  }

  async function autoFillFromImages() {
    if (analyzingImages) return;
    if (!(p.model_ref_url || "").trim() && !(p.product_ref_url || "").trim()) return;

    setPlanError("");
    setAnalyzingImages(true);

    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_ref_url: p.model_ref_url || "",
          product_ref_url: p.product_ref_url || ""
        })
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON analyze response (${r.status}): ${String(raw).slice(0, 180)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Analyze failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || "")
      }));

      setToast({ open: true, msg: "Auto-fill ✓" });
    } catch (e) {
      setPlanError(e?.message || String(e));
    } finally {
      setAnalyzingImages(false);
    }
  }

  async function autoFillFromLink() {
    if (analyzingLink) return;
    if (!(landingUrl || "").trim()) return;

    setPlanError("");
    setAnalyzingLink(true);

    try {
      // kamu bisa buat endpoint ini sendiri /api/scrape (opsional)
      // sementara: reuse /api/analyze-link jika ada
      const r = await fetch("/api/analyze-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: landingUrl })
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON analyze-link response (${r.status}): ${String(raw).slice(0, 180)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Analyze-link failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || "")
      }));

      setToast({ open: true, msg: "Auto-fill ✓" });
    } catch (e) {
      // kalau endpoint belum ada, kasih error jelas
      setPlanError(e?.message || String(e));
    } finally {
      setAnalyzingLink(false);
    }
  }

  const progress = loadingPlan ? Math.min(0.92, elapsedMs / (etaSec * 1000)) : 0;

  return (
    <div className="stack">
      {/* Card: inputs */}
      <div className="card">
        <div className="card-title">{t.settings}</div>

        <Row>
          <Field label={t.aiBrain}>
            <select
              className="select"
              value={p.ai_brain || "bedrock"}
              onChange={(e) => update("ai_brain", e.target.value)}
            >
              <option value="bedrock">Bedrock</option>
              <option value="gemini">Gemini</option>
            </select>
          </Field>
        </Row>

        <Divider />

        <div className="card-sub">{t.autofillLink}</div>
        <Row>
          <Field label={t.landingUrl}>
            <input
              className="input"
              value={landingUrl}
              onChange={(e) => setLandingUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </Row>
        <Row>
          <button className="btn secondary" onClick={autoFillFromLink} disabled={analyzingLink || !(landingUrl || "").trim()}>
            {analyzingLink ? "…" : t.autofillBtn}
          </button>
        </Row>

        <Divider />

        <div className="card-sub">{t.formatTiming}</div>
        <Grid2>
          <Field label={t.platform}>
            <select className="select" value={p.platform} onChange={(e) => update("platform", e.target.value)}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram Reels</option>
              <option value="youtube">YouTube Shorts</option>
              <option value="facebook">Facebook Reels</option>
            </select>
          </Field>

          <Field label={t.aspectRatio}>
            <select className="select" value={p.aspect_ratio} onChange={(e) => update("aspect_ratio", e.target.value)}>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
            </select>
          </Field>

          <Field label={t.sceneCount}>
            <select
              className="select"
              value={String(p.scene_count)}
              onChange={(e) => update("scene_count", Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </Field>

          <Field label={t.secondsPerScene}>
            <select
              className="select"
              value={String(p.seconds_per_scene)}
              onChange={(e) => update("seconds_per_scene", Number(e.target.value))}
            >
              {[4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={String(n)}>{n}s</option>
              ))}
            </select>
          </Field>
        </Grid2>

        <Divider />

        <div className="card-sub">{t.coreInputs}</div>
        <Grid2>
          <Field label={`${t.brand} *`}>
            <input className="input" value={p.brand} onChange={(e) => update("brand", e.target.value)} />
          </Field>
          <Field label={`${t.productType} *`}>
            <input className="input" value={p.product_type} onChange={(e) => update("product_type", e.target.value)} />
          </Field>
          <Field label={`${t.material} *`}>
            <input className="input" value={p.material} onChange={(e) => update("material", e.target.value)} />
          </Field>
        </Grid2>

        <Divider />

        <div className="card-sub">{t.assetsOptional}</div>
        <Grid2>
          <ImageUploadField
            label={t.modelRef}
            kind="model"
            projectId={p.project_id || "local"}
            valueUrl={p.model_ref_url}
            onUrl={(url) => update("model_ref_url", url)}
            hideUrl={true}
            showPreview={true}
            optional={true}
          />
          <ImageUploadField
            label={t.productRef}
            kind="product"
            projectId={p.project_id || "local"}
            valueUrl={p.product_ref_url}
            onUrl={(url) => update("product_ref_url", url)}
            hideUrl={true}
            showPreview={true}
            optional={true}
          />
        </Grid2>

        <Row>
          <button
            className="btn secondary"
            onClick={autoFillFromImages}
            disabled={analyzingImages || (!String(p.model_ref_url || "").trim() && !String(p.product_ref_url || "").trim())}
          >
            {analyzingImages ? "…" : t.analyzeImagesBtn}
          </button>
        </Row>
      </div>

      {/* Card: status */}
      <StatusCard
        canGenerate={canGeneratePlan}
        readyCore={!!readyCore}
        hasModel={!!String(p.model_ref_url || "").trim()}
        hasProduct={!!String(p.product_ref_url || "").trim()}
        provider={(p.ai_brain || "bedrock").toUpperCase()}
        estDurationSec={totalDurationSec}
        loading={loadingPlan}
        progress={progress}
        elapsedMs={elapsedMs}
        etaSec={etaSec}
        onGenerate={generatePlanOnce}
        onCancel={cancelGenerate}
        error={planError}
      />
    </div>
  );
}

function ScenesTab() {
  const { blueprint, t } = useStudio();

  const beats = useMemo(() => {
    if (!blueprint) return [];
    const b = buildBeatsFromScenePlans(blueprint);
    return Array.isArray(b) ? b : [];
  }, [blueprint]);

  if (!blueprint) {
    return (
      <div className="card">
        <div className="card-title">{t.scenes}</div>
        <div className="muted">{t.blueprintEmpty}</div>
      </div>
    );
  }

  const hasBeats = beats.length > 0;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">{t.scenes}</div>

        {!hasBeats ? (
          <div className="empty">{t.beatsNotReadable}</div>
        ) : (
          <div className="scene-list">
            {beats.map((b, idx) => (
              <div key={b.id || idx} className="scene">
                <div className="scene-top">
                  <div className="badge">{b.id || `S${idx + 1}`}</div>
                  <div className="scene-goal">{b.goal || "SCENE"}</div>
                </div>

                <div className="scene-body">
                  <div className="miniLabel">Action</div>
                  <div className="miniBox">{b.action || "—"}</div>

                  <div className="miniLabel" style={{ marginTop: 10 }}>On-screen</div>
                  <div className="miniBox">{b.on_screen_text || "—"}</div>

                  {b.voiceover ? (
                    <>
                      <div className="miniLabel" style={{ marginTop: 10 }}>VO</div>
                      <div className="miniBox">{b.voiceover}</div>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn secondary" onClick={() => window.open("data:application/json," + encodeURIComponent(safeJsonStringify(blueprint)), "_blank")}>
            {t.openJson}
          </button>
          <button className="btn secondary" onClick={() => downloadJson("blueprint.json", blueprint)}>
            {t.downloadJson}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportTab() {
  const { blueprint, t } = useStudio();
  return (
    <div className="card">
      <div className="card-title">{t.export}</div>
      {!blueprint ? (
        <div className="muted">{t.blueprintEmpty}</div>
      ) : (
        <div className="row">
          <button className="btn secondary" onClick={() => downloadJson("blueprint.json", blueprint)}>
            {t.downloadJson}
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================
   Status card (minimize + solid bg + real loading)
   ========================= */

function StatusCard({
  canGenerate,
  readyCore,
  hasModel,
  hasProduct,
  provider,
  estDurationSec,
  loading,
  progress,
  elapsedMs,
  etaSec,
  onGenerate,
  onCancel,
  error
}) {
  const { statusCollapsed, setStatusCollapsed, t } = useStudio();

  const elapsedLabel = formatMs(elapsedMs);
  const etaLeft = loading ? Math.max(0, etaSec * 1000 - elapsedMs) : null;

  return (
    <div className={`statusWrap ${statusCollapsed ? "collapsed" : ""}`}>
      <div className="card statusCard">
        <div className="statusHead">
          <div>
            <div className="card-title">{t.status}</div>
            <div className="muted">{t.readiness}</div>
          </div>
          <button className="ghost" onClick={() => setStatusCollapsed((v) => !v)}>
            {statusCollapsed ? t.show : t.minimize}
          </button>
        </div>

        {!statusCollapsed ? (
          <>
            <div className="chips">
              <Chip ok={!!readyCore}>Core {readyCore ? "✓" : "×"}</Chip>
              <Chip ok={!!hasModel}>Model {hasModel ? "✓" : "×"}</Chip>
              <Chip ok={!!hasProduct}>Product {hasProduct ? "✓" : "×"}</Chip>
              <Chip>{t.estDuration}: {Math.max(0, Number(estDurationSec || 0))}s</Chip>
              <Chip>{t.provider}: {provider}</Chip>
            </div>

            <div className="muted" style={{ marginTop: 10 }}>{t.progress}</div>

            <div className="progress">
              <div className={`bar ${loading ? "anim" : ""}`} style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} />
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
              <Chip>{t.elapsed}: {elapsedLabel}</Chip>
              <div className="row" style={{ gap: 10 }}>
                {loading ? (
                  <>
                    <Chip>{t.eta}: {etaLeft !== null ? formatMs(etaLeft) : "-"}</Chip>
                    <button className="btn secondary" onClick={onCancel}>{t.cancel}</button>
                  </>
                ) : null}
              </div>
            </div>

            <button
              className={`btn primary ${loading ? "disabled" : ""}`}
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate || loading}
              title={!canGenerate ? t.requiredMissing : ""}
            >
              {loading ? (
                <span className="btnSpin">
                  <span className="spinner" /> {t.generating}
                </span>
              ) : (
                t.generate
              )}
            </button>

            {error ? <div className="error">{error}</div> : null}
          </>
        ) : (
          <div className="chips" style={{ marginTop: 10 }}>
            <Chip>{provider}</Chip>
            <Chip>{Math.max(0, Number(estDurationSec || 0))}s</Chip>
            {loading ? <Chip>{t.generating}</Chip> : <Chip>Ready</Chip>}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   UI atoms
   ========================= */

function Divider() {
  return <div className="divider" />;
}

function Row({ children }) {
  return <div className="row">{children}</div>;
}

function Grid2({ children }) {
  return <div className="grid2">{children}</div>;
}

function Field({ label, children }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function Chip({ children, ok }) {
  return (
    <span className={`chip ${ok === true ? "ok" : ok === false ? "bad" : ""}`}>
      {children}
    </span>
  );
}

function formatMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

/* =========================
   CSS (embedded, jadi gak perlu bingung taruh di mana)
   ========================= */

const css = `
:root{
  --bg: #0b0b0f;
  --card: rgba(20,20,24,0.92);
  --stroke: rgba(255,255,255,0.10);
  --text: rgba(255,255,255,0.92);
  --muted: rgba(255,255,255,0.60);
  --orange: #ff6a00;
  --orange2: #ff8a3d;
  --goodBg: rgba(34,197,94,0.16);
  --goodBd: rgba(34,197,94,0.28);
  --badBg: rgba(239,68,68,0.16);
  --badBd: rgba(239,68,68,0.28);
  --shadow: 0 18px 60px rgba(0,0,0,0.55);
}
:root[data-theme="light"]{
  --bg: #fff7ed;
  --card: rgba(255,255,255,0.95);
  --stroke: rgba(0,0,0,0.08);
  --text: rgba(0,0,0,0.88);
  --muted: rgba(0,0,0,0.55);
  --shadow: 0 18px 60px rgba(0,0,0,0.10);
}
*{ box-sizing:border-box; }
.page{
  min-height:100vh;
  background:
    radial-gradient(800px 500px at 20% 10%, rgba(255,106,0,0.20), transparent 60%),
    radial-gradient(900px 700px at 80% 40%, rgba(255,138,61,0.16), transparent 60%),
    var(--bg);
  color: var(--text);
  padding-bottom: 120px;
}
.topbar{
  position: sticky;
  top:0;
  z-index: 50;
  backdrop-filter: blur(14px);
  background: linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.02));
  border-bottom: 1px solid var(--stroke);
}
:root[data-theme="light"] .topbar{
  background: rgba(255,255,255,0.55);
}
.topbar-inner{
  max-width: 980px;
  margin: 0 auto;
  padding: 12px 14px;
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
}
.title{ font-weight: 900; font-size: 18px; letter-spacing: 0.2px; }
.top-actions{ display:flex; gap:10px; align-items:center; }
.pill{
  display:flex; align-items:center; gap:6px;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,0.06);
  padding: 6px;
  border-radius: 999px;
}
:root[data-theme="light"] .pill{ background: rgba(0,0,0,0.04); }
.pill-label{
  font-size: 12px;
  color: var(--muted);
  padding: 0 6px;
  font-weight: 800;
}
.pill-btn{
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  padding: 8px 10px;
  border-radius: 999px;
  font-weight: 900;
  cursor: pointer;
}
.pill-btn.active{
  border-color: var(--stroke);
  background: rgba(255,255,255,0.10);
}
:root[data-theme="light"] .pill-btn.active{ background: rgba(0,0,0,0.06); }
.ghost{
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,0.06);
  color: var(--text);
  padding: 10px 12px;
  border-radius: 14px;
  font-weight: 900;
  cursor: pointer;
}
:root[data-theme="light"] .ghost{ background: rgba(0,0,0,0.04); }

.content{
  max-width: 980px;
  margin: 0 auto;
  padding: 14px;
}

.stack{ display:grid; gap: 12px; }

.card{
  border: 1px solid var(--stroke);
  border-radius: 18px;
  background: var(--card);
  box-shadow: var(--shadow);
  padding: 14px;
}
.card-title{ font-weight: 900; font-size: 16px; }
.card-sub{ margin-top: 8px; color: var(--muted); font-size: 12px; font-weight: 700; }

.muted{ color: var(--muted); font-weight: 700; font-size: 12px; margin-top: 6px; }
.empty{
  margin-top: 12px;
  border: 1px dashed var(--stroke);
  border-radius: 16px;
  padding: 12px;
  color: var(--muted);
  font-weight: 800;
}

.divider{
  height: 1px;
  background: var(--stroke);
  margin: 12px 0;
}

.row{ display:flex; gap: 10px; align-items:center; flex-wrap: wrap; }
.grid2{
  display:grid;
  grid-template-columns: repeat(1, minmax(0,1fr));
  gap: 12px;
}
@media(min-width: 760px){
  .grid2{ grid-template-columns: repeat(2, minmax(0,1fr)); }
}

.field{ width: 100%; }
.label{ font-size: 12px; font-weight: 900; margin-bottom: 6px; color: var(--muted); }
.input, .select{
  width: 100%;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,0.06);
  color: var(--text);
  padding: 12px 12px;
  border-radius: 14px;
  outline: none;
  font-weight: 800;
}
:root[data-theme="light"] .input, :root[data-theme="light"] .select{
  background: rgba(0,0,0,0.03);
}

.btn{
  border-radius: 16px;
  padding: 12px 14px;
  font-weight: 900;
  cursor: pointer;
  border: 1px solid var(--stroke);
}
.btn.primary{
  width: 100%;
  margin-top: 12px;
  border: none;
  color: #111;
  background: linear-gradient(180deg, var(--orange), var(--orange2));
}
.btn.secondary{
  background: rgba(255,255,255,0.06);
  color: var(--text);
}
:root[data-theme="light"] .btn.secondary{ background: rgba(0,0,0,0.04); }
.btn.primary.disabled{
  opacity: 0.6;
  cursor: not-allowed;
}
.btnSpin{ display:inline-flex; align-items:center; gap:10px; justify-content:center; }

.chips{ display:flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
.chip{
  display:inline-flex;
  align-items:center;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,0.06);
  color: var(--text);
}
:root[data-theme="light"] .chip{ background: rgba(0,0,0,0.04); }
.chip.ok{ background: var(--goodBg); border-color: var(--goodBd); }
.chip.bad{ background: var(--badBg); border-color: var(--badBd); }

.progress{
  height: 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,0.04);
  overflow:hidden;
  margin-top: 8px;
}
.bar{
  height: 100%;
  background: linear-gradient(90deg, var(--orange), var(--orange2));
  border-radius: 999px;
}
.bar.anim{
  animation: pulseBar 1.2s ease-in-out infinite;
}
@keyframes pulseBar{
  0%{ filter: brightness(0.95); }
  50%{ filter: brightness(1.20); }
  100%{ filter: brightness(0.95); }
}

.spinner{
  width: 16px; height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(0,0,0,0.25);
  border-top-color: rgba(0,0,0,0.75);
  animation: spin 0.9s linear infinite;
}
:root[data-theme="dark"] .spinner{
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: rgba(255,255,255,0.85);
}
@keyframes spin { to { transform: rotate(360deg); } }

.error{
  margin-top: 12px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--badBd);
  background: var(--badBg);
  color: var(--text);
  font-weight: 900;
}

.scene-list{ display:grid; gap: 12px; margin-top: 12px; }
.scene{
  border: 1px solid var(--stroke);
  border-radius: 18px;
  background: rgba(255,255,255,0.04);
  padding: 12px;
}
:root[data-theme="light"] .scene{ background: rgba(0,0,0,0.03); }
.scene-top{ display:flex; align-items:center; gap: 10px; }
.badge{
  font-weight: 900;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,106,0,0.35);
  background: rgba(255,106,0,0.16);
}
.scene-goal{ font-weight: 900; }

.miniLabel{ font-size: 12px; font-weight: 900; color: var(--muted); }
.miniBox{
  margin-top: 6px;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,0.04);
  border-radius: 14px;
  padding: 10px;
  white-space: pre-wrap;
  font-weight: 800;
  font-size: 13px;
}
:root[data-theme="light"] .miniBox{ background: rgba(0,0,0,0.03); }

.tabbar{
  position: fixed;
  left: 0; right: 0; bottom: 0;
  padding: 12px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 60;
}
.tabbar-inner{
  max-width: 520px;
  margin: 0 auto;
  display:flex;
  gap: 10px;
  border: 1px solid var(--stroke);
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(16px);
  border-radius: 18px;
  padding: 10px;
}
:root[data-theme="light"] .tabbar-inner{ background: rgba(255,255,255,0.70); }

.tabbtn{
  flex:1;
  border: none;
  background: transparent;
  color: var(--text);
  padding: 12px 10px;
  border-radius: 14px;
  font-weight: 900;
  cursor: pointer;
}
.tabbtn.active{
  background: rgba(255,255,255,0.10);
  border: 1px solid var(--stroke);
}
:root[data-theme="light"] .tabbtn.active{ background: rgba(0,0,0,0.06); }

.credit{
  position: fixed;
  left: 0; right: 0;
  bottom: calc(74px + env(safe-area-inset-bottom));
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  font-weight: 900;
  z-index: 55;
  pointer-events: none;
}

.toast{
  position: fixed;
  left: 0; right: 0;
  top: 72px;
  display:flex;
  justify-content:center;
  z-index: 80;
}
.toast-inner{
  border: 1px solid var(--stroke);
  background: rgba(0,0,0,0.55);
  color: var(--text);
  padding: 10px 12px;
  border-radius: 999px;
  font-weight: 900;
  backdrop-filter: blur(14px);
}
:root[data-theme="light"] .toast-inner{
  background: rgba(255,255,255,0.85);
  color: rgba(0,0,0,0.85);
}

.statusWrap{
  position: sticky;
  bottom: calc(78px + env(safe-area-inset-bottom));
  z-index: 40;
}
.statusCard{
  /* FIX transparansi: pakai solid card var(--card) */
}
.statusHead{
  display:flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.statusWrap.collapsed .statusCard{
  padding-bottom: 12px;
}
`;

/* =========================
   exported helper for handler
   ========================= */
function normalizeBlueprintLocal(x) {
  return normalizeBlueprint(x);
}
