// src/components/StudioShell.jsx
import React, { useMemo, useState, useEffect } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import Toast from "./src/components/Toast.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

/* =========================
   Tabs
   ========================= */
const TABS = ["Scenes", "Settings", "Export"];

/* =========================
   i18n (simple)
   ========================= */
const STR = {
  id: {
    studio: "Studio",
    scenes: "Scenes",
    settings: "Settings",
    export: "Export",
    language: "Bahasa",
    createdBy: "Created by",
    goSettings: "Go to Settings",
    noBlueprint: "Belum ada blueprint. Buka Settings → isi data → Generate Plan.",
    beatsMissing: "Blueprint ada, tapi beats tidak terbaca.",
    workflow: "Per-scene workflow: plan → image → approve → video → audio",
    generateImage: "Generate Image",
    editPrompt: "Edit Prompt",

    // Settings
    twoCardTitleLeft: "Settings",
    twoCardTitleRight: "Status",
    formatTiming: "Format & Timing",
    aiBrain: "AI Brain",
    coreInputs: "Core Inputs",
    assets: "Assets",
    autoFill: "Auto-fill from Images",
    analyzing: "Analyzing…",
    generating: "Generating…",
    generatePlan: "Generate Plan (once)",
    provider: "Provider",
    bedrock: "Bedrock (DeepSeek + Claude)",
    gemini: "Gemini (single-pass)",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count (max 10)",
    secondsPerScene: "Seconds per scene",
    projectName: "Project name (optional)",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    modelRef: "Model reference *",
    productRef: "Product reference *",
    estimatedDuration: "Estimated duration",
    progress: "Progress",
    eta: "ETA",
    ok: "OK",
    geminiQuotaTitle: "Gemini quota hit",
    geminiQuotaMsg: "Auto fallback ke BEDROCK…",
    planGenerated: "Plan generated",
    generateFailed: "Generate failed",
    missingAnalyze: "Endpoint /api/analyze belum ada atau error.",
    statusHint: "Tips: Bedrock biasanya paling stabil. Gemini sering quota free-tier limit 0.",
  },
  en: {
    studio: "Studio",
    scenes: "Scenes",
    settings: "Settings",
    export: "Export",
    language: "Language",
    createdBy: "Created by",
    goSettings: "Go to Settings",
    noBlueprint: "No blueprint yet. Go to Settings → fill inputs → Generate Plan.",
    beatsMissing: "Blueprint exists, but beats can't be read.",
    workflow: "Per-scene workflow: plan → image → approve → video → audio",
    generateImage: "Generate Image",
    editPrompt: "Edit Prompt",

    // Settings
    twoCardTitleLeft: "Settings",
    twoCardTitleRight: "Status",
    formatTiming: "Format & Timing",
    aiBrain: "AI Brain",
    coreInputs: "Core Inputs",
    assets: "Assets",
    autoFill: "Auto-fill from Images",
    analyzing: "Analyzing…",
    generating: "Generating…",
    generatePlan: "Generate Plan (once)",
    provider: "Provider",
    bedrock: "Bedrock (DeepSeek + Claude)",
    gemini: "Gemini (single-pass)",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count (max 10)",
    secondsPerScene: "Seconds per scene",
    projectName: "Project name (optional)",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    modelRef: "Model reference *",
    productRef: "Product reference *",
    estimatedDuration: "Estimated duration",
    progress: "Progress",
    eta: "ETA",
    ok: "OK",
    geminiQuotaTitle: "Gemini quota hit",
    geminiQuotaMsg: "Auto fallback to BEDROCK…",
    planGenerated: "Plan generated",
    generateFailed: "Generate failed",
    missingAnalyze: "/api/analyze endpoint missing or error.",
    statusHint: "Tip: Bedrock is usually the most stable. Gemini often hits free-tier quota limit 0.",
  }
};

function useText(lang) {
  return STR[lang] || STR.id;
}

/* =========================
   Toast (inline)
   ========================= */
function Toast({ toast, onClose, t }) {
  if (!toast) return null;
  const type = toast.type || "info";

  const bg =
    type === "success"
      ? "rgba(34,197,94,0.12)"
      : type === "error"
      ? "rgba(239,68,68,0.12)"
      : "rgba(59,130,246,0.10)";

  const border =
    type === "success"
      ? "rgba(34,197,94,0.18)"
      : type === "error"
      ? "rgba(239,68,68,0.18)"
      : "rgba(59,130,246,0.16)";

  const color =
    type === "success"
      ? "#166534"
      : type === "error"
      ? "#b91c1c"
      : "#1e3a8a";

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(120px + env(safe-area-inset-bottom))",
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none"
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: "100%",
          maxWidth: 520,
          borderRadius: 16,
          padding: 12,
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: "blur(14px)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          justifyContent: "space-between"
        }}
      >
        <div style={{ color, fontWeight: 900, fontSize: 13, lineHeight: 1.35 }}>
          <div style={{ fontWeight: 1000 }}>{toast.title || "Info"}</div>
          {toast.message ? <div style={{ fontWeight: 700, marginTop: 4 }}>{toast.message}</div> : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid rgba(0,0,0,0.10)",
            background: "rgba(255,255,255,0.7)",
            borderRadius: 12,
            padding: "6px 10px",
            fontWeight: 900,
            cursor: "pointer"
          }}
        >
          {t.ok}
        </button>
      </div>
    </div>
  );
}

/* =========================
   Studio context
   ========================= */
const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/* =========================
   Main component
   ========================= */
export default function StudioShell() {
  const [tab, setTab] = useState("Settings");

  // language
  const [lang, setLang] = useState("id");
  const t = useText(lang);

  // global studio state
  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" });
  const [blueprint, setBlueprint] = useState(null);

  // plan states
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

  // progress UI
  const [progress, setProgress] = useState(0);
  const [etaSec, setEtaSec] = useState(0);
  const [leftSec, setLeftSec] = useState(0);

  // analyze UI
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisInfo, setAnalysisInfo] = useState("");

  // toast
  const [toast, setToast] = useState(null);
  function showToast(payload) {
    setToast(payload);
    setTimeout(() => setToast(null), 3500);
  }

  // ETA countdown
  useEffect(() => {
    if (!loadingPlan || !leftSec) return;
    const id = setInterval(() => setLeftSec((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [loadingPlan, leftSec]);

  const ctx = {
    tab,
    setTab,
    lang,
    setLang,
    projectDraft,
    setProjectDraft,
    blueprint,
    setBlueprint,
    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,

    progress,
    setProgress,
    etaSec,
    setEtaSec,
    leftSec,
    setLeftSec,

    analyzing,
    setAnalyzing,
    analysisInfo,
    setAnalysisInfo,

    showToast
  };

  const content = useMemo(() => {
    if (tab === "Scenes") return <ScenesTab />;
    if (tab === "Settings") return <SettingsTab />;
    return <ExportTab />;
  }, [tab]);

  return (
    <StudioContext.Provider value={ctx}>
      <div style={styles.page}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <div style={styles.topBarInner}>
            <div style={styles.title}>{t.studio}</div>

            {/* Language in top-right */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.6)" }}>{t.language}</div>
              <div style={styles.langWrap}>
                <button
                  type="button"
                  onClick={() => setLang("id")}
                  style={{ ...styles.langBtn, ...(lang === "id" ? styles.langBtnActive : {}) }}
                >
                  ID
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  style={{ ...styles.langBtn, ...(lang === "en" ? styles.langBtnActive : {}) }}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={styles.content}>{content}</div>

        {/* Bottom tabs */}
        <div style={styles.tabBar}>
          <div style={styles.tabBarInner}>
            {TABS.map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                style={{ ...styles.tabBtn, ...(tab === tb ? styles.tabBtnActive : {}) }}
                type="button"
              >
                {tb === "Settings" ? t.settings : tb === "Scenes" ? t.scenes : t.export}
              </button>
            ))}
          </div>
        </div>

        {/* credit floating above tabs */}
        <div style={styles.credit}>
          <a
            href="https://x.com/adryndian"
            target="_blank"
            rel="noreferrer"
            style={styles.creditLink}
          >
            {t.createdBy} @adryndian
          </a>
        </div>

        {/* toast */}
        <Toast toast={toast} onClose={() => setToast(null)} t={t} />
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   Scenes tab
   ========================= */
function ScenesTab() {
  const { blueprint, setTab, lang } = useStudio();
  const t = useText(lang);

  const beats =
    blueprint?.storyboard?.beats ||
    blueprint?.SEGMENT_3?.storyboard?.beats ||
    blueprint?.segments?.storyboard?.beats ||
    [];

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{t.scenes}</div>
        <div style={styles.cardSub}>{t.workflow}</div>
      </div>

      {!blueprint ? (
        <div style={styles.placeholder}>
          {t.noBlueprint}
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => setTab("Settings")} style={styles.secondaryBtn}>
              {t.goSettings}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {beats.length === 0 ? (
            <div style={styles.placeholder}>{t.beatsMissing}</div>
          ) : (
            beats.map((b, idx) => (
              <div key={b.id || idx} style={styles.sceneCard}>
                <div style={styles.sceneTop}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={styles.sceneBadge}>{b.id || `S${idx + 1}`}</div>
                    <div style={{ fontWeight: 900 }}>{b.goal || "SCENE"}</div>
                    <Chip>{b.time_window || "—"}</Chip>
                  </div>
                  <Chip>Draft</Chip>
                </div>

                <div style={styles.sceneGrid}>
                  <div>
                    <div style={styles.miniLabel}>Action</div>
                    <div style={styles.miniBox}>{b.action || "—"}</div>
                  </div>
                  <div>
                    <div style={styles.miniLabel}>On-screen</div>
                    <div style={styles.miniBox}>{b.on_screen_text || "—"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={styles.miniLabel}>Negative</div>
                  <div style={styles.miniBox}>
                    {(b.negative_prompt || []).slice(0, 8).join(", ") || "—"}
                    {(b.negative_prompt || []).length > 8 ? "…" : ""}
                  </div>
                </div>

                <div style={styles.stepperRow}>
                  <Step label="Plan" active />
                  <Step label="Image" />
                  <Step label="Approve" />
                  <Step label="Video" />
                  <Step label="Audio" />
                </div>

                <div style={styles.sceneActions}>
                  <button type="button" style={styles.primaryBtn} onClick={() => alert("Next: Generate Image per scene")}>
                    {t.generateImage}
                  </button>
                  <button type="button" style={styles.secondaryBtn} onClick={() => alert("Next: Edit prompt per scene")}>
                    {t.editPrompt}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   Settings tab (2-card layout)
   ========================= */
function SettingsTab() {
  const {
    lang,
    projectDraft,
    setProjectDraft,
    setBlueprint,
    setTab,

    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,

    progress,
    setProgress,
    etaSec,
    setEtaSec,
    leftSec,
    setLeftSec,

    analyzing,
    setAnalyzing,
    analysisInfo,
    setAnalysisInfo,

    showToast
  } = useStudio();

  const t = useText(lang);

  const [p, setP] = useState(projectDraft);

  // keep global draft synced
  useEffect(() => {
    setProjectDraft(p);
  }, [p, setProjectDraft]);

  const totalDuration = Number(p.scene_count || 0) * Number(p.seconds_per_scene || 0);

  const canGeneratePlan =
    (p.brand || "").trim() &&
    (p.product_type || "").trim() &&
    (p.material || "").trim() &&
    (p.model_ref_url || "").trim() &&
    (p.product_ref_url || "").trim();

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function isGeminiQuotaError(msg) {
    const m = String(msg || "").toLowerCase();
    return (
      m.includes("resource_exhausted") ||
      m.includes("quota") ||
      m.includes("exceeded your current quota") ||
      m.includes("free_tier") ||
      m.includes("429")
    );
  }

  async function runPlan(provider) {
    const ctrl = new AbortController();

    // ETA heuristic: base 60 + scenes*6 (cap 150)
    const estimated = Math.min(150, 60 + Number(p.scene_count || 6) * 6);
    const timeoutMs = estimated * 1000 + 15000;

    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const t0 = Date.now();

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
      if (!json?.blueprint) throw new Error("Plan OK tapi blueprint kosong. Cek /api/plan response.");

      return { blueprint: json.blueprint, latencyMs: Date.now() - t0 };
    } finally {
      clearTimeout(timer);
    }
  }

  async function generatePlanOnce() {
    if (!canGeneratePlan || loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);

    const provider0 = (p.ai_brain || "bedrock").toLowerCase();

    // ETA & progress init
    const estimated = Math.min(150, 60 + Number(p.scene_count || 6) * 6);
    setEtaSec(estimated);
    setLeftSec(estimated);
    setProgress(2);

    showToast({
      type: "info",
      title: t.generating,
      message: `${t.provider}: ${provider0.toUpperCase()} • ${t.eta}: ~${estimated}s`
    });

    // fake progress tick
    const pv = setInterval(() => setProgress((x) => (x < 92 ? x + 1 : x)), 900);

    try {
      let result;
      let finalProviderLabel = provider0.toUpperCase();

      try {
        result = await runPlan(provider0);
      } catch (e) {
        const msg = e?.message || String(e);

        // Gemini quota -> fallback to bedrock once
        if (provider0 === "gemini" && isGeminiQuotaError(msg)) {
          showToast({
            type: "info",
            title: t.geminiQuotaTitle,
            message: t.geminiQuotaMsg
          });

          result = await runPlan("bedrock");
          finalProviderLabel = "BEDROCK (fallback)";
        } else {
          throw e;
        }
      }

      setProgress(100);
      setBlueprint(result.blueprint);
      setTab("Scenes");

      showToast({
        type: "success",
        title: t.planGenerated,
        message: `Latency: ${Math.round(result.latencyMs / 1000)}s • Provider: ${finalProviderLabel}`
      });
    } catch (e) {
      const msg =
        e?.name === "AbortError"
          ? `Timeout. Server mungkin hang / route tidak kepanggil.`
          : (e?.message || String(e));

      setPlanError(msg);

      showToast({
        type: "error",
        title: t.generateFailed,
        message: msg.slice(0, 160)
      });
    } finally {
      clearInterval(pv);
      setLoadingPlan(false);
      setTimeout(() => setProgress(0), 400);
      setTimeout(() => setLeftSec(0), 400);
    }
  }

  async function autoFillFromImages() {
    if (analyzing) return;
    if (!(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim()) return;

    setPlanError("");
    setAnalysisInfo("");
    setAnalyzing(true);

    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_ref_url: p.model_ref_url,
          product_ref_url: p.product_ref_url
        })
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON analyze response (${r.status}): ${String(raw).slice(0, 180)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `${t.missingAnalyze} (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || "")
      }));

      setAnalysisInfo("Auto-fill ✓");
      showToast({ type: "success", title: "Auto-fill", message: "Fields updated." });
    } catch (e) {
      setPlanError(e?.message || String(e));
      showToast({ type: "error", title: "Auto-fill", message: (e?.message || String(e)).slice(0, 140) });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* 2-card responsive layout */}
      <div style={styles.grid2}>
        {/* Left card: settings */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>{t.twoCardTitleLeft}</div>
            <div style={styles.cardSub}>{t.statusHint}</div>
          </div>

          {/* AI Brain */}
          <Section title={t.aiBrain} sub={`${t.provider}: ${t.bedrock} / ${t.gemini}`}>
            <Grid2>
              <Field label={t.aiBrain}>
                <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
                  <option value="bedrock">{t.bedrock}</option>
                  <option value="gemini">{t.gemini}</option>
                </Select>
              </Field>
            </Grid2>
          </Section>

          {/* Format & Timing */}
          <Section title={t.formatTiming} sub=" ">
            <Grid2>
              <Field label={t.platform}>
                <Select value={p.platform} onChange={(e) => update("platform", e.target.value)}>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram Reels</option>
                  <option value="facebook">Facebook Reels</option>
                  <option value="youtube">YouTube Shorts</option>
                </Select>
              </Field>

              <Field label={t.aspectRatio}>
                <Select value={p.aspect_ratio} onChange={(e) => update("aspect_ratio", e.target.value)}>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                  <option value="16:9">16:9</option>
                </Select>
              </Field>

              <Field label={t.sceneCount}>
                <Select value={String(p.scene_count)} onChange={(e) => update("scene_count", Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </Select>
              </Field>

              <Field label={t.secondsPerScene}>
                <Select value={String(p.seconds_per_scene)} onChange={(e) => update("seconds_per_scene", Number(e.target.value))}>
                  {[4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={String(n)}>{n}s</option>
                  ))}
                </Select>
              </Field>
            </Grid2>

            <MiniRow>
              <Chip>{t.estimatedDuration}: {totalDuration}s</Chip>
            </MiniRow>
          </Section>

          {/* Core */}
          <Section title={t.coreInputs} sub=" ">
            <Grid2>
              <Field label={t.projectName}>
                <Input value={p.project_name || ""} onChange={(e) => update("project_name", e.target.value)} placeholder="UGC Project — Feb 2026" />
              </Field>

              <Field label={t.brand}>
                <Input value={p.brand || ""} onChange={(e) => update("brand", e.target.value)} placeholder="Brand" />
              </Field>

              <Field label={t.productType}>
                <Input value={p.product_type || ""} onChange={(e) => update("product_type", e.target.value)} placeholder="sunscreen / hoodie / coffee" />
              </Field>

              <Field label={t.material}>
                <Input value={p.material || ""} onChange={(e) => update("material", e.target.value)} placeholder="cotton / gel / stainless" />
              </Field>
            </Grid2>
          </Section>

          {/* Assets */}
          <Section title={t.assets} sub="Upload → URL otomatis → (optional) auto-fill.">
            <Grid2>
              <ImageUploadField
                label={t.modelRef}
                kind="model"
                projectId={p.project_id || "local"}
                valueUrl={p.model_ref_url}
                onUrl={(url) => update("model_ref_url", url)}
              />
              <ImageUploadField
                label={t.productRef}
                kind="product"
                projectId={p.project_id || "local"}
                valueUrl={p.product_ref_url}
                onUrl={(url) => update("product_ref_url", url)}
              />
            </Grid2>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                disabled={analyzing || !(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim()}
                onClick={autoFillFromImages}
                style={{ ...styles.secondaryBtn, opacity: analyzing ? 0.6 : 1 }}
              >
                {analyzing ? t.analyzing : t.autoFill}
              </button>

              {analysisInfo ? <Chip>{analysisInfo}</Chip> : null}
            </div>
          </Section>
        </div>

        {/* Right card: status */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>{t.twoCardTitleRight}</div>
            <div style={styles.cardSub}>
              {t.provider}: {(p.ai_brain || "bedrock").toUpperCase()}
            </div>
          </div>

          {/* Status box */}
          <div style={styles.statusBox}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <Chip>{(p.brand || "").trim() ? "Core ✓" : "Core ✗"}</Chip>
              <Chip>{(p.model_ref_url || "").trim() ? "Model ✓" : "Model ✗"}</Chip>
              <Chip>{(p.product_ref_url || "").trim() ? "Product ✓" : "Product ✗"}</Chip>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div>
                <div style={styles.miniLabel}>{t.progress}</div>
                <div style={styles.progressOuter}>
                  <div style={{ ...styles.progressInner, width: `${Math.max(0, Math.min(100, progress))}%` }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Chip>{t.eta}: {loadingPlan ? `${leftSec}s` : "-"}</Chip>
                <Chip>{t.estimatedDuration}: {totalDuration}s</Chip>
              </div>

              <button
                type="button"
                style={{
                  ...styles.primaryBtn,
                  opacity: canGeneratePlan && !loadingPlan ? 1 : 0.5,
                  cursor: canGeneratePlan && !loadingPlan ? "pointer" : "not-allowed",
                  width: "100%"
                }}
                disabled={!canGeneratePlan || loadingPlan}
                onClick={generatePlanOnce}
              >
                {loadingPlan ? t.generating : t.generatePlan}
              </button>
            </div>
          </div>

          {/* Error */}
          {planError ? <div style={styles.errorBox}>{planError}</div> : null}

          {/* Loading overlay */}
          {loadingPlan ? (
            <div style={styles.loadingOverlay}>
              <div style={styles.loadingCard}>
                <div style={{ fontWeight: 1000, fontSize: 14 }}>{t.generating}</div>
                <div style={{ marginTop: 6, fontWeight: 800, color: "rgba(17,24,39,0.7)" }}>
                  {t.provider}: {(p.ai_brain || "bedrock").toUpperCase()} • {t.eta}: ~{etaSec}s
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={styles.progressOuter}>
                    <div style={{ ...styles.progressInner, width: `${Math.max(0, Math.min(100, progress))}%` }} />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.65)" }}>
                    {t.progress}: {progress}%
                    {"  "}•{"  "}
                    {t.eta}: {leftSec}s
                  </div>
                </div>

                <div style={styles.spinnerRow}>
                  <div style={styles.spinner} />
                  <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.6)" }}>
                    Waiting for server response…
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Export tab
   ========================= */
function ExportTab() {
  const { blueprint, lang } = useStudio();
  const t = useText(lang);

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{t.export}</div>
        <div style={styles.cardSub}>Download blueprint + assets per scene</div>
      </div>
      {!blueprint ? (
        <div style={styles.placeholder}>{t.noBlueprint}</div>
      ) : (
        <div style={styles.placeholder}>
          Next step: tombol download JSON blueprint + per-scene downloads.
        </div>
      )}
    </div>
  );
}

/* =========================
   UI atoms
   ========================= */
function Section({ title, sub, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 1000, color: "#111827", marginBottom: 6 }}>{title}</div>
      {sub ? <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>{sub}</div> : null}
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </div>
  );
}

function Grid2({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(1, 1fr)", gap: 12 }}>{children}</div>;
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, color: "#111827" }}>{label}</div>
      {children}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.9)",
        outline: "none",
        fontWeight: 700
      }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.9)",
        outline: "none",
        fontWeight: 900
      }}
    />
  );
}

function Chip({ children }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 900,
        padding: "8px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.65)",
        border: "1px solid rgba(0,0,0,0.08)"
      }}
    >
      {children}
    </span>
  );
}

function MiniRow({ children }) {
  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>{children}</div>;
}

function Step({ label, active }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 1000,
        border: "1px solid rgba(0,0,0,0.08)",
        background: active ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.65)"
      }}
    >
      {label}
    </div>
  );
}

/* =========================
   Styles
   ========================= */
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,237,213,1) 100%)",
    paddingBottom: 110
  },

  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    backdropFilter: "blur(14px)",
    background: "rgba(255,255,255,0.55)",
    borderBottom: "1px solid rgba(0,0,0,0.06)"
  },
  topBarInner: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "14px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  title: { fontWeight: 1000, color: "#111827", fontSize: 18 },

  langWrap: {
    display: "flex",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(0,0,0,0.06)"
  },
  langBtn: {
    border: "none",
    borderRadius: 999,
    padding: "8px 10px",
    fontWeight: 1000,
    cursor: "pointer",
    background: "transparent",
    color: "rgba(17,24,39,0.7)"
  },
  langBtnActive: {
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    color: "#111827"
  },

  content: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 14
  },

  grid2: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },

  card: {
    borderRadius: 18,
    background: "rgba(255,255,255,0.65)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.5)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    padding: 14
  },

  cardHeader: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: "1px solid rgba(0,0,0,0.06)"
  },
  cardTitle: { fontWeight: 1000, fontSize: 16, color: "#111827" },
  cardSub: { marginTop: 4, fontSize: 12, color: "#6b7280", fontWeight: 800 },

  placeholder: {
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(0,0,0,0.12)",
    color: "#374151",
    background: "rgba(255,255,255,0.55)",
    fontWeight: 800
  },

  tabBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    padding: 12,
    paddingBottom: "calc(12px + env(safe-area-inset-bottom))"
  },
  tabBarInner: {
    maxWidth: 520,
    margin: "0 auto",
    display: "flex",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    background: "rgba(255,255,255,0.65)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.5)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
  },
  tabBtn: {
    flex: 1,
    border: "none",
    borderRadius: 14,
    padding: "12px 10px",
    fontWeight: 1000,
    cursor: "pointer",
    background: "transparent",
    color: "#111827"
  },
  tabBtnActive: {
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)"
  },

  credit: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: "calc(84px + env(safe-area-inset-bottom))",
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 25
  },
  creditLink: {
    pointerEvents: "auto",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(17,24,39,0.55)",
    textDecoration: "none",
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(0,0,0,0.06)",
    padding: "6px 10px",
    borderRadius: 999,
    backdropFilter: "blur(12px)"
  },

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "none",
    background: "#f97316",
    color: "white",
    fontWeight: 1000
  },
  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.7)",
    fontWeight: 1000,
    cursor: "pointer"
  },

  statusBox: {
    borderRadius: 18,
    padding: 12,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.55)"
  },

  progressOuter: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    background: "rgba(0,0,0,0.06)",
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.06)"
  },
  progressInner: {
    height: "100%",
    borderRadius: 999,
    background: "rgba(249,115,22,0.65)",
    transition: "width 220ms ease"
  },

  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "#b91c1c",
    fontWeight: 1000
  },

  loadingOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(255,255,255,0.35)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  loadingCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)"
  },
  spinnerRow: {
    marginTop: 12,
    display: "flex",
    gap: 10,
    alignItems: "center"
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "3px solid rgba(0,0,0,0.10)",
    borderTopColor: "rgba(249,115,22,0.9)",
    animation: "spin 0.9s linear infinite"
  },

  // Scenes styles
  sceneCard: {
    borderRadius: 18,
    padding: 12,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.55)"
  },
  sceneTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  sceneBadge: {
    fontWeight: 1000,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(249,115,22,0.18)",
    border: "1px solid rgba(249,115,22,0.20)"
  },
  sceneGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 },
  miniLabel: { fontSize: 12, fontWeight: 1000, color: "#111827", marginBottom: 6 },
  miniBox: {
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(0,0,0,0.06)",
    color: "#111827",
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: "pre-wrap"
  },
  stepperRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  sceneActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }
};

/* =========================
   CSS keyframes injection
   ========================= */
(function injectKeyframesOnce() {
  if (typeof document === "undefined") return;
  const id = "ugc-spin-keyframes";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.innerHTML = `
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @media (max-width: 860px) {
      .ugc-grid2 { grid-template-columns: 1fr !important; }
    }
  `;
  document.head.appendChild(style);
})();

// patch: apply responsive class for grid2
styles.grid2 = { ...styles.grid2, className: "ugc-grid2" };
