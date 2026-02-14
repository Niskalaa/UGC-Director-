// src/components/StudioShell.jsx
import React, { useMemo, useState, useEffect } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

/* =========================
   Tabs
   ========================= */
const TABS = ["Settings", "Scenes", "Export"];

/* =========================
   i18n
   ========================= */
const STR = {
  id: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Bahasa",
    createdBy: "Created by",
    hintStable: "Tips: Bedrock paling stabil. Gemini free-tier sering limit 0 / quota.",
    noBlueprint: "Belum ada blueprint. Buka Settings → isi data → Generate Plan.",
    beatsMissing: "Blueprint ada, tapi beats tidak terbaca.",
    workflow: "Per-scene workflow: plan → image → approve → video → audio",
    goSettings: "Ke Settings",
    generateImage: "Generate Image",
    editPrompt: "Edit Prompt",

    aiBrain: "AI Brain",
    provider: "Provider",
    bedrock: "Bedrock (DeepSeek + Claude)",
    gemini: "Gemini (single-pass)",

    coreInputs: "Core Inputs",
    projectName: "Project name (opsional)",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",

    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count (max 10)",
    secondsPerScene: "Seconds per scene",
    estimatedDuration: "Estimated duration",

    assets: "Assets",
    modelRef: "Model reference *",
    productRef: "Product reference *",

    autoFill: "Image Analysis (Auto-fill)",
    analyzing: "Analyzing…",
    generating: "Generating…",
    generatePlan: "Generate Plan",
    progress: "Progress",
    eta: "ETA",
    ok: "OK",

    geminiQuotaTitle: "Gemini quota hit",
    geminiQuotaMsg: "Auto fallback ke BEDROCK…",
    planGenerated: "Plan generated",
    generateFailed: "Generate failed",
    analyzeMissing: "Endpoint /api/analyze belum ada atau error.",

    statusTitle: "Status",
    statusSubtitle: "Ringkasan readiness & kontrol generate",
    coreOk: "Core ✓",
    coreNo: "Core ✗",
    modelOk: "Model ✓",
    modelNo: "Model ✗",
    productOk: "Product ✓",
    productNo: "Product ✗",
  },
  en: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Language",
    createdBy: "Created by",
    hintStable: "Tip: Bedrock is most stable. Gemini free-tier often has 0 limit / quota.",
    noBlueprint: "No blueprint yet. Go to Settings → fill inputs → Generate Plan.",
    beatsMissing: "Blueprint exists, but beats can't be read.",
    workflow: "Per-scene workflow: plan → image → approve → video → audio",
    goSettings: "Go to Settings",
    generateImage: "Generate Image",
    editPrompt: "Edit Prompt",

    aiBrain: "AI Brain",
    provider: "Provider",
    bedrock: "Bedrock (DeepSeek + Claude)",
    gemini: "Gemini (single-pass)",

    coreInputs: "Core Inputs",
    projectName: "Project name (optional)",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",

    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count (max 10)",
    secondsPerScene: "Seconds per scene",
    estimatedDuration: "Estimated duration",

    assets: "Assets",
    modelRef: "Model reference *",
    productRef: "Product reference *",

    autoFill: "Image Analysis (Auto-fill)",
    analyzing: "Analyzing…",
    generating: "Generating…",
    generatePlan: "Generate Plan",
    progress: "Progress",
    eta: "ETA",
    ok: "OK",

    geminiQuotaTitle: "Gemini quota hit",
    geminiQuotaMsg: "Auto fallback to BEDROCK…",
    planGenerated: "Plan generated",
    generateFailed: "Generate failed",
    analyzeMissing: "/api/analyze endpoint missing or error.",

    statusTitle: "Status",
    statusSubtitle: "Readiness summary & generate controls",
    coreOk: "Core ✓",
    coreNo: "Core ✗",
    modelOk: "Model ✓",
    modelNo: "Model ✗",
    productOk: "Product ✓",
    productNo: "Product ✗",
  }
};

function useText(lang) {
  return STR[lang] || STR.id;
}

/* =========================
   Toast
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
    <div style={styles.toastWrap}>
      <div style={{ ...styles.toast, background: bg, border: `1px solid ${border}` }}>
        <div style={{ color, fontWeight: 900, fontSize: 13, lineHeight: 1.35 }}>
          <div style={{ fontWeight: 1000 }}>{toast.title || "Info"}</div>
          {toast.message ? <div style={{ fontWeight: 700, marginTop: 4 }}>{toast.message}</div> : null}
        </div>
        <button type="button" onClick={onClose} style={styles.toastBtn}>
          {t.ok}
        </button>
      </div>
    </div>
  );
}

/* =========================
   Context
   ========================= */
const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/* =========================
   Main
   ========================= */
export default function StudioShell() {
  const [tab, setTab] = useState("Settings");
  const [lang, setLang] = useState("id");
  const t = useText(lang);

  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" });
  const [blueprint, setBlueprint] = useState(null);

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

  const [progress, setProgress] = useState(0);
  const [etaSec, setEtaSec] = useState(0);
  const [leftSec, setLeftSec] = useState(0);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisInfo, setAnalysisInfo] = useState("");

  const [toast, setToast] = useState(null);
  function showToast(payload) {
    setToast(payload);
    setTimeout(() => setToast(null), 3500);
  }

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
    t,

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
    if (tab === "Settings") return <SettingsTab />;
    if (tab === "Scenes") return <ScenesTab />;
    return <ExportTab />;
  }, [tab]);

  return (
    <StudioContext.Provider value={ctx}>
      <div style={styles.page}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <div style={styles.topBarInner}>
            <div style={styles.title}>{t.studio}</div>

            <div style={styles.topRight}>
              <div style={styles.langLabel}>{t.language}</div>
              <div style={styles.langWrap}>
                <button type="button" onClick={() => setLang("id")} style={{ ...styles.langBtn, ...(lang === "id" ? styles.langBtnActive : {}) }}>
                  ID
                </button>
                <button type="button" onClick={() => setLang("en")} style={{ ...styles.langBtn, ...(lang === "en" ? styles.langBtnActive : {}) }}>
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
              <button key={tb} onClick={() => setTab(tb)} type="button" style={{ ...styles.tabBtn, ...(tab === tb ? styles.tabBtnActive : {}) }}>
                {tb === "Settings" ? t.settings : tb === "Scenes" ? t.scenes : t.export}
              </button>
            ))}
          </div>
        </div>

        {/* Static Credit (fixed, never scroll) */}
        <div style={styles.creditFixed}>
          <span style={styles.creditText}>
            {t.createdBy} <b>@adryndian</b>
          </span>
        </div>

        {/* toast */}
        <Toast toast={toast} onClose={() => setToast(null)} t={t} />
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   Settings (3 columns + status bottom)
   ========================= */
function SettingsTab() {
  const {
    lang,
    t,

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

  const [p, setP] = useState(projectDraft);

  useEffect(() => setProjectDraft(p), [p, setProjectDraft]);

  const totalDuration = Number(p.scene_count || 0) * Number(p.seconds_per_scene || 0);

  const canGeneratePlan =
  (p.brand || "").trim() &&
  (p.product_type || "").trim() &&
  (p.material || "").trim();

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

    // ETA heuristic
    const estimated = Math.min(180, 55 + Number(p.scene_count || 6) * 7);
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

    const estimated = Math.min(180, 55 + Number(p.scene_count || 6) * 7);
    setEtaSec(estimated);
    setLeftSec(estimated);
    setProgress(3);

    showToast({
      type: "info",
      title: t.generating,
      message: `${t.provider}: ${provider0.toUpperCase()} • ${t.eta}: ~${estimated}s`
    });

    const pv = setInterval(() => setProgress((x) => (x < 92 ? x + 1 : x)), 850);

    try {
      let result;
      let finalProviderLabel = provider0.toUpperCase();

      try {
        result = await runPlan(provider0);
      } catch (e) {
        const msg = e?.message || String(e);

        if (provider0 === "gemini" && isGeminiQuotaError(msg)) {
          showToast({ type: "info", title: t.geminiQuotaTitle, message: t.geminiQuotaMsg });
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
          ? "Timeout. Server mungkin hang / route tidak kepanggil."
          : (e?.message || String(e));

      setPlanError(msg);
      showToast({ type: "error", title: t.generateFailed, message: msg.slice(0, 160) });
    } finally {
      clearInterval(pv);
      setLoadingPlan(false);
      setTimeout(() => setProgress(0), 400);
      setTimeout(() => setLeftSec(0), 400);
    }
  }
const [linkUrl, setLinkUrl] = React.useState("");
const [linkAnalyzing, setLinkAnalyzing] = React.useState(false);
const [linkInfo, setLinkInfo] = React.useState("");

   
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
          product_ref_url: p.product_ref_url,
          // optional: hint context
          platform: p.platform,
          aspect_ratio: p.aspect_ratio
        })
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON analyze response (${r.status}): ${String(raw).slice(0, 180)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `${t.analyzeMissing} (${r.status})`);

      const f = json.fields || {};

      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || ""),
        // optional suggestions
        scene_count: prev.scene_count || (Number(f.suggested_scene_count) || prev.scene_count),
        seconds_per_scene: prev.seconds_per_scene || (Number(f.suggested_seconds_per_scene) || prev.seconds_per_scene),
        platform: prev.platform || (f.suggested_platform || prev.platform),
        aspect_ratio: prev.aspect_ratio || (f.suggested_aspect_ratio || prev.aspect_ratio),
      }));

      setAnalysisInfo("Auto-fill ✓");
      showToast({ type: "success", title: "Image Analysis", message: "Fields updated." });
    } catch (e) {
      const msg = e?.message || String(e);
      setPlanError(msg);
      showToast({ type: "error", title: "Image Analysis", message: msg.slice(0, 140) });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* 3 columns row */}
      <div className="ugc-grid3" style={styles.grid3}>
        {/* Col 1 */}
        <div style={styles.card}>
          <CardHeader title={t.aiBrain} sub={t.hintStable} />
          <Section title={t.aiBrain} sub={`${t.provider}: ${t.bedrock} / ${t.gemini}`}>
            <Field label={t.aiBrain}>
              <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
                <option value="bedrock">{t.bedrock}</option>
                <option value="gemini">{t.gemini}</option>
              </Select>
            </Field>
          </Section>

          <Section title={t.coreInputs} sub=" ">
            <Grid>
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
            </Grid>
          </Section>
        </div>

        {/* Col 2 */}
        <div style={styles.card}>
          <CardHeader title={t.formatTiming} sub=" " />

          {/* Image Analysis button ABOVE format&timing */}
          <div style={styles.actionRowTop}>
            <button
              type="button"
              disabled={analyzing || !(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim()}
              onClick={autoFillFromImages}
              style={{
                ...styles.secondaryBtn,
                width: "100%",
                opacity: analyzing ? 0.6 : 1
              }}
            >
              {analyzing ? t.analyzing : t.autoFill}
            </button>
            {analysisInfo ? <div style={styles.smallHint}>{analysisInfo}</div> : <div style={styles.smallHint}> </div>}
          </div>

          <Section title={t.formatTiming} sub=" ">
            <Grid>
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
            </Grid>

            <div style={styles.hintRow}>
              <Chip>{t.estimatedDuration}: {totalDuration}s</Chip>
              <Chip>{t.provider}: {(p.ai_brain || "bedrock").toUpperCase()}</Chip>
            </div>
          </Section>
        </div>

        {/* Col 3 */}
        <div style={styles.card}>
          <Section title="Assets (optional)" sub="Upload optional. URL disimpan tapi tidak ditampilkan.">
  <Grid2>
    <ImageUploadField
      label="Model reference (optional)"
      kind="model"
      projectId={p.project_id || "local"}
      valueUrl={p.model_ref_url}
      onUrl={(url) => update("model_ref_url", url)}
      hideUrl={true}
      optional={true}
    />
    <ImageUploadField
      label="Product reference (optional)"
      kind="product"
      projectId={p.project_id || "local"}
      valueUrl={p.product_ref_url}
      onUrl={(url) => update("product_ref_url", url)}
      hideUrl={true}
      optional={true}
    />
  </Grid2>
</Section>
           <Section title="Auto-fill from Link (optional)" sub="Paste link produk/landing page → sistem scrape/analyze → isi form otomatis.">
  <Grid2>
    <Field label="Product / Landing page URL">
      <Input
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        placeholder="https://..."
      />
    </Field>
  </Grid2>

  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
    <button
      type="button"
      disabled={linkAnalyzing || !(linkUrl || "").trim()}
      onClick={async () => {
        setPlanError("");
        setLinkInfo("");
        setLinkAnalyzing(true);
        try {
          const r = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: linkUrl })
          });

          const raw = await r.text();
          let json;
          try { json = raw ? JSON.parse(raw) : null; } catch {
            throw new Error(`Non-JSON scrape response (${r.status}): ${String(raw).slice(0, 180)}`);
          }
          if (!r.ok || !json?.ok) throw new Error(json?.error || `Scrape failed (${r.status})`);

          const f = json.fields || {};
          setP((prev) => ({
            ...prev,
            brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
            product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
            material: prev.material?.trim() ? prev.material : (f.material || ""),
            target_audience: prev.target_audience?.trim() ? prev.target_audience : (f.target_audience || ""),
            tone: prev.tone?.trim() ? prev.tone : (f.tone || "natural gen-z"),
            platform: prev.platform || (f.suggested_platform || "tiktok"),
            aspect_ratio: prev.aspect_ratio || (f.suggested_aspect_ratio || "9:16"),
          }));

          setLinkInfo("Auto-fill dari link sukses ✓");
        } catch (e) {
          setPlanError(e?.message || String(e));
        } finally {
          setLinkAnalyzing(false);
        }
      }}
      style={{ ...styles.secondaryBtn, opacity: linkAnalyzing ? 0.6 : 1 }}
    >
      {linkAnalyzing ? "Analyzing…" : "Auto-fill from Link"}
    </button>

    {linkInfo ? <Chip>{linkInfo}</Chip> : null}
  </div>
</Section>
        </div>
      </div>

      {/* Status card bottom (full width, centered rectangle inside) */}
      <div style={styles.card}>
        <CardHeader title={t.statusTitle} sub={t.statusSubtitle} />

        <div style={styles.statusOuter}>
          <div style={styles.statusInner}>
            <div style={styles.statusRow}>
              <Chip tone={(p.brand || "").trim() ? "ok" : "bad"}>{(p.brand || "").trim() ? t.coreOk : t.coreNo}</Chip>
              <Chip tone={(p.model_ref_url || "").trim() ? "ok" : "bad"}>{(p.model_ref_url || "").trim() ? t.modelOk : t.modelNo}</Chip>
              <Chip tone={(p.product_ref_url || "").trim() ? "ok" : "bad"}>{(p.product_ref_url || "").trim() ? t.productOk : t.productNo}</Chip>
              <Chip>{t.estimatedDuration}: {totalDuration}s</Chip>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div>
                <div style={styles.labelSmall}>{t.progress}</div>
                <div style={styles.progressOuter}>
                  <div style={{ ...styles.progressInner, width: `${Math.max(0, Math.min(100, progress))}%` }} />
                </div>
              </div>

              <div style={styles.statusRow}>
                <Chip>{t.eta}: {loadingPlan ? `${leftSec}s` : "-"}</Chip>
                <Chip>{t.provider}: {(p.ai_brain || "bedrock").toUpperCase()}</Chip>
              </div>

              <button
                type="button"
                style={{
                  ...styles.primaryBtn,
                  width: "100%",
                  opacity: canGeneratePlan && !loadingPlan ? 1 : 0.55,
                  cursor: canGeneratePlan && !loadingPlan ? "pointer" : "not-allowed"
                }}
                disabled={!canGeneratePlan || loadingPlan}
                onClick={generatePlanOnce}
              >
                {loadingPlan ? t.generating : t.generatePlan}
              </button>

              {planError ? <div style={styles.errorBox}>{planError}</div> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loadingPlan ? (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingCard}>
            <div style={styles.loadingTitle}>{t.generating}</div>
            <div style={styles.loadingSub}>
              {t.provider}: {(p.ai_brain || "bedrock").toUpperCase()} • {t.eta}: ~{etaSec}s
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={styles.progressOuter}>
                <div style={{ ...styles.progressInner, width: `${Math.max(0, Math.min(100, progress))}%` }} />
              </div>
              <div style={styles.loadingMeta}>
                {t.progress}: {progress}% • {t.eta}: {leftSec}s
              </div>
            </div>

            <div style={styles.spinnerRow}>
              <div style={styles.spinner} />
              <div style={styles.loadingHint}>Waiting for server response…</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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
      <CardHeader title={t.scenes} sub={t.workflow} />

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
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{b.goal || "SCENE"}</div>
                    <Chip>{b.time_window || "—"}</Chip>
                  </div>
                  <Chip>Draft</Chip>
                </div>

                <div style={styles.sceneGrid}>
                  <div>
                    <div style={styles.labelSmall}>Action</div>
                    <div style={styles.miniBox}>{b.action || "—"}</div>
                  </div>
                  <div>
                    <div style={styles.labelSmall}>On-screen</div>
                    <div style={styles.miniBox}>{b.on_screen_text || "—"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={styles.labelSmall}>Negative</div>
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
   Export tab
   ========================= */
function ExportTab() {
  const { blueprint, lang } = useStudio();
  const t = useText(lang);

  return (
    <div style={styles.card}>
      <CardHeader title={t.export} sub="Download blueprint + assets per scene" />
      {!blueprint ? (
        <div style={styles.placeholder}>{t.noBlueprint}</div>
      ) : (
        <div style={styles.placeholder}>Next step: tombol download JSON blueprint + per-scene downloads.</div>
      )}
    </div>
  );
}

/* =========================
   UI atoms
   ========================= */
function CardHeader({ title, sub }) {
  return (
    <div style={styles.cardHeader}>
      <div style={styles.cardTitle}>{title}</div>
      {sub ? <div style={styles.cardSub}>{sub}</div> : null}
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={styles.sectionTitle}>{title}</div>
      {sub ? <div style={styles.sectionSub}>{sub}</div> : null}
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function Grid({ children, cols = 1 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 12
      }}
    >
      {children}
    </div>
  );
}

function Grid2({ children }) {
  return <Grid cols={1}>{children}</Grid>;
}
function Field({ label, children }) {
  return (
    <div>
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

function Chip({ children, tone }) {
  const toneStyle =
    tone === "ok"
      ? { borderColor: "rgba(34,197,94,0.22)", background: "rgba(34,197,94,0.10)", color: "#14532d" }
      : tone === "bad"
      ? { borderColor: "rgba(239,68,68,0.22)", background: "rgba(239,68,68,0.10)", color: "#7f1d1d" }
      : {};
  return (
    <span style={{ ...styles.chip, ...toneStyle }}>
      {children}
    </span>
  );
}

function Step({ label, active }) {
  return (
    <div style={{ ...styles.step, ...(active ? styles.stepActive : {}) }}>
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
    paddingBottom: 140 // room for tabs + credit
  },

  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    backdropFilter: "blur(14px)",
    background: "rgba(255,255,255,0.55)",
    borderBottom: "1px solid rgba(0,0,0,0.06)"
  },
  topBarInner: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  title: { fontWeight: 1000, color: "#111827", fontSize: 16 },

  topRight: { display: "flex", alignItems: "center", gap: 8 },
  langLabel: { fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.6)" },
  langWrap: {
    display: "flex",
    gap: 6,
    padding: 5,
    borderRadius: 999,
    background: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(0,0,0,0.06)"
  },
  langBtn: {
    border: "none",
    borderRadius: 999,
    padding: "7px 10px",
    fontWeight: 1000,
    cursor: "pointer",
    background: "transparent",
    color: "rgba(17,24,39,0.7)",
    fontSize: 12
  },
  langBtnActive: {
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    color: "#111827"
  },

  content: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: 14
  },

  grid3: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
  },

  card: {
    borderRadius: 16,
    background: "rgba(255,255,255,0.68)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.5)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
    padding: 14
  },
  cardHeader: {
    marginBottom: 8,
    paddingBottom: 10,
    borderBottom: "1px solid rgba(0,0,0,0.06)"
  },
  cardTitle: { fontWeight: 1000, fontSize: 14, color: "#111827" },
  cardSub: { marginTop: 4, fontSize: 12, color: "#6b7280", fontWeight: 800 },

  sectionTitle: { fontWeight: 1000, fontSize: 12, color: "#111827" },
  sectionSub: { marginTop: 4, fontSize: 11, color: "rgba(107,114,128,0.9)", fontWeight: 700, marginBottom: 8 },

  label: { fontSize: 12, fontWeight: 900, marginBottom: 6, color: "#111827" },
  labelSmall: { fontSize: 11, fontWeight: 900, marginBottom: 6, color: "rgba(17,24,39,0.8)" },

  input: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.92)",
    outline: "none",
    fontWeight: 800,
    fontSize: 13,
    color: "#111827"
  },
  select: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.92)",
    outline: "none",
    fontWeight: 900,
    fontSize: 13,
    color: "#111827"
  },

  chip: {
    fontSize: 12,
    fontWeight: 900,
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(0,0,0,0.08)",
    color: "#111827"
  },

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "none",
    background: "#f97316",
    color: "white",
    fontWeight: 1000,
    fontSize: 13
  },
  secondaryBtn: {
    padding: "11px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.75)",
    fontWeight: 1000,
    fontSize: 13,
    cursor: "pointer"
  },

  actionRowTop: { display: "grid", gap: 8, marginTop: 8 },
  smallHint: { fontSize: 11, fontWeight: 800, color: "rgba(17,24,39,0.55)" },

  hintRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 },

  statusOuter: { display: "flex", justifyContent: "center" },
  statusInner: {
    width: "100%",
    maxWidth: 680,
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.60)"
  },
  statusRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },

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
    background: "rgba(249,115,22,0.68)",
    transition: "width 220ms ease"
  },

  errorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "#b91c1c",
    fontWeight: 1000,
    fontSize: 12
  },

  placeholder: {
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(0,0,0,0.12)",
    color: "#374151",
    background: "rgba(255,255,255,0.55)",
    fontWeight: 800,
    fontSize: 12
  },

  tabBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 22, // leave room for fixed credit
    zIndex: 60,
    padding: 12,
    paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
    pointerEvents: "none"
  },
  tabBarInner: {
    pointerEvents: "auto",
    maxWidth: 520,
    margin: "0 auto",
    display: "flex",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    background: "rgba(255,255,255,0.70)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)"
  },
  tabBtn: {
    flex: 1,
    border: "none",
    borderRadius: 14,
    padding: "11px 10px",
    fontWeight: 1000,
    cursor: "pointer",
    background: "transparent",
    color: "#111827",
    fontSize: 13
  },
  tabBtnActive: {
    background: "rgba(255,255,255,0.95)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)"
  },

  // static credit fixed at bottom
  creditFixed: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 55,
    padding: "8px 12px",
    paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
    display: "flex",
    justifyContent: "center",
    background: "rgba(255,255,255,0.40)",
    backdropFilter: "blur(10px)",
    borderTop: "1px solid rgba(0,0,0,0.06)"
  },
  creditText: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(17,24,39,0.55)"
  },

  // Toast
  toastWrap: {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: "calc(120px + env(safe-area-inset-bottom))",
    zIndex: 99999,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none"
  },
  toast: {
    pointerEvents: "auto",
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    padding: 12,
    backdropFilter: "blur(14px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  toastBtn: {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.7)",
    borderRadius: 12,
    padding: "6px 10px",
    fontWeight: 1000,
    cursor: "pointer",
    fontSize: 12
  },

  // Loading overlay
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
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)"
  },
  loadingTitle: { fontWeight: 1000, fontSize: 14, color: "#111827" },
  loadingSub: { marginTop: 6, fontWeight: 800, fontSize: 12, color: "rgba(17,24,39,0.65)" },
  loadingMeta: { marginTop: 10, fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.62)" },
  spinnerRow: { marginTop: 12, display: "flex", gap: 10, alignItems: "center" },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "3px solid rgba(0,0,0,0.10)",
    borderTopColor: "rgba(249,115,22,0.9)",
    animation: "spin 0.9s linear infinite"
  },
  loadingHint: { fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.6)" },

  // Scenes
  sceneCard: {
    borderRadius: 16,
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
  miniBox: {
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(0,0,0,0.06)",
    color: "#111827",
    fontWeight: 800,
    fontSize: 12,
    whiteSpace: "pre-wrap"
  },
  stepperRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  step: {
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 1000,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.65)"
  },
  stepActive: { background: "rgba(249,115,22,0.18)" },
  sceneActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }
};

/* =========================
   Inject keyframes + responsive grid
   ========================= */
(function injectKeyframesOnce() {
  if (typeof document === "undefined") return;
  const id = "ugc-studio-style";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.innerHTML = `
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @media (max-width: 980px) {
      .ugc-grid3 { grid-template-columns: 1fr !important; }
    }
  `;
  document.head.appendChild(style);
})();
