// src/components/StudioShell.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Settings", "Scenes", "Export"];

/* =========================
   i18n (simple)
   ========================= */
const I18N = {
  id: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    aiBrain: "AI Brain",
    aiBrainSub: "Default: Bedrock (DeepSeek → Claude → DeepSeek). Gemini opsional.",
    formatTiming: "Format & Timing",
    formatTimingSub: "Atur platform, aspect ratio, jumlah scene, dan durasi per scene.",
    core: "Core Inputs",
    coreSub: "Minimal untuk generate plan.",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count (max 10)",
    secondsPerScene: "Seconds per scene",
    assets: "Assets (optional)",
    assetsSub: "Upload optional. Kalau tidak upload, kamu bisa isi via link / manual.",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    autofillFromImages: "Auto-fill from Images",
    analyzing: "Analyzing…",
    autofillOk: "Auto-fill sukses ✓",
    autofillLinkTitle: "Auto-fill from Link (optional)",
    autofillLinkSub: "Paste link produk/landing page → sistem scrape/analyze → isi form otomatis.",
    productLink: "Product / Landing page URL",
    autofillFromLink: "Auto-fill from Link",
    status: "Status",
    statusSub: "Ringkasan readiness & kontrol generate",
    estimatedDuration: "Estimated duration",
    provider: "Provider",
    generatePlan: "Generate Plan",
    generating: "Generating…",
    elapsed: "Elapsed",
    typical: "Typical",
    progress: "Progress",
    readyCore: "Core",
    readyModel: "Model",
    readyProduct: "Product",
    ok: "✓",
    no: "✗",
    scenesSub: "Per-scene workflow: plan → image → approve → video → audio",
    noBlueprint: "Belum ada blueprint. Generate plan dulu di Settings.",
    beatsNotReadable:
      "Blueprint ada, tapi beats tidak terbaca. (Schema output AI belum konsisten.)",
    goSettings: "Go to Settings",
    nextImage: "Generate Image",
    editPrompt: "Edit Prompt",
    exportSub: "Download blueprint + assets per scene",
    nextExport: "Next step: tombol download JSON blueprint + per-scene downloads.",
    createdBy: "Created by",
    lang: "Bahasa",
  },
  en: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    aiBrain: "AI Brain",
    aiBrainSub: "Default: Bedrock (DeepSeek → Claude → DeepSeek). Gemini optional.",
    formatTiming: "Format & Timing",
    formatTimingSub: "Set platform, aspect ratio, scene count, and seconds per scene.",
    core: "Core Inputs",
    coreSub: "Minimal inputs to generate plan.",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count (max 10)",
    secondsPerScene: "Seconds per scene",
    assets: "Assets (optional)",
    assetsSub: "Upload is optional. If you skip upload, use link/manual inputs.",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    autofillFromImages: "Auto-fill from Images",
    analyzing: "Analyzing…",
    autofillOk: "Auto-fill success ✓",
    autofillLinkTitle: "Auto-fill from Link (optional)",
    autofillLinkSub: "Paste product/landing page link → scrape/analyze → auto-fill fields.",
    productLink: "Product / Landing page URL",
    autofillFromLink: "Auto-fill from Link",
    status: "Status",
    statusSub: "Readiness summary & generate control",
    estimatedDuration: "Estimated duration",
    provider: "Provider",
    generatePlan: "Generate Plan",
    generating: "Generating…",
    elapsed: "Elapsed",
    typical: "Typical",
    progress: "Progress",
    readyCore: "Core",
    readyModel: "Model",
    readyProduct: "Product",
    ok: "✓",
    no: "✗",
    scenesSub: "Per-scene workflow: plan → image → approve → video → audio",
    noBlueprint: "No blueprint yet. Generate plan in Settings first.",
    beatsNotReadable:
      "Blueprint exists, but beats are not readable. (AI schema not consistent yet.)",
    goSettings: "Go to Settings",
    nextImage: "Generate Image",
    editPrompt: "Edit Prompt",
    exportSub: "Download blueprint + per-scene assets",
    nextExport: "Next step: add download button for blueprint JSON + per-scene files.",
    createdBy: "Created by",
    lang: "Language",
  },
};

/* =========================
   Context
   ========================= */
const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/* =========================
   Blueprint normalizer
   ========================= */
function pickBeats(bp) {
  if (!bp) return [];

  // 1) storyboard.beats
  if (Array.isArray(bp?.storyboard?.beats)) return bp.storyboard.beats;

  // 2) storyboard = array directly
  if (Array.isArray(bp?.storyboard)) return bp.storyboard;

  // 3) beats/scenes at root
  if (Array.isArray(bp?.beats)) return bp.beats;
  if (Array.isArray(bp?.scenes)) return bp.scenes;

  // 4) SEGMENT_* keys
  try {
    for (const k of Object.keys(bp)) {
      if (k.startsWith("SEGMENT_")) {
        const seg = bp[k];
        if (Array.isArray(seg?.storyboard?.beats)) return seg.storyboard.beats;
        if (Array.isArray(seg?.beats)) return seg.beats;
        if (Array.isArray(seg?.storyboard)) return seg.storyboard;
      }
    }
  } catch {}

  // 5) segments as array
  if (Array.isArray(bp?.segments)) {
    for (const seg of bp.segments) {
      if (Array.isArray(seg?.storyboard?.beats)) return seg.storyboard.beats;
      if (Array.isArray(seg?.beats)) return seg.beats;
      if (Array.isArray(seg?.storyboard)) return seg.storyboard;
    }
  }

  // 6) segments as object
  if (bp?.segments && typeof bp.segments === "object") {
    const s = bp.segments;
    if (Array.isArray(s?.storyboard?.beats)) return s.storyboard.beats;
    if (Array.isArray(s?.storyboard)) return s.storyboard;
  }

  return [];
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function msToHuman(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function safeParseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* =========================
   Main
   ========================= */
export default function StudioShell() {
  const [tab, setTab] = useState("Settings");
  const [lang, setLang] = useState("id"); // "id" | "en"
  const t = I18N[lang] || I18N.id;

  // global state
  const [projectDraft, setProjectDraft] = useState({
    ...DEFAULT_PROJECT,
    ai_brain: "bedrock",
    platform: DEFAULT_PROJECT.platform || "tiktok",
    aspect_ratio: DEFAULT_PROJECT.aspect_ratio || "9:16",
    scene_count: DEFAULT_PROJECT.scene_count || 6,
    seconds_per_scene: DEFAULT_PROJECT.seconds_per_scene || 8,
  });

  const [blueprint, setBlueprint] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [analysisInfo, setAnalysisInfo] = useState("");

  // progress / timing (lebih “jujur”: elapsed + typical, bukan ETA palsu)
  const [elapsedMs, setElapsedMs] = useState(0);
  const [progressPct, setProgressPct] = useState(0); // 0..100 (heuristic)
  const startedAtRef = useRef(null);
  const tickRef = useRef(null);

  // store typical per provider (moving average)
  const [typicalMs, setTypicalMs] = useState(() => {
    const cached = safeParseJson(localStorage.getItem("ugc_typical_ms") || "");
    return typeof cached === "number" ? cached : 45000;
  });

  useEffect(() => {
    localStorage.setItem("ugc_typical_ms", JSON.stringify(typicalMs));
  }, [typicalMs]);

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
    analysisInfo,
    setAnalysisInfo,
    elapsedMs,
    progressPct,
    typicalMs,
    setTypicalMs,
    setElapsedMs,
    setProgressPct,
  };

  const content = useMemo(() => {
    if (tab === "Scenes") return <ScenesTab />;
    if (tab === "Export") return <ExportTab />;
    return <SettingsTab />;
  }, [tab]);

  return (
    <StudioContext.Provider value={ctx}>
      <div style={styles.page}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <div style={styles.topBarInner}>
            <div style={styles.title}>{t.studio}</div>

            {/* Language toggle (top-right) */}
            <div style={styles.langWrap}>
              <div style={styles.langLabel}>{t.lang}</div>
              <div style={styles.langPill}>
                <button
                  type="button"
                  onClick={() => setLang("id")}
                  style={{
                    ...styles.langBtn,
                    ...(lang === "id" ? styles.langBtnActive : {}),
                  }}
                >
                  ID
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  style={{
                    ...styles.langBtn,
                    ...(lang === "en" ? styles.langBtnActive : {}),
                  }}
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
            {TABS.map((k) => {
              const label = k === "Settings" ? t.settings : k === "Scenes" ? t.scenes : t.export;
              return (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  style={{
                    ...styles.tabBtn,
                    ...(tab === k ? styles.tabBtnActive : {}),
                  }}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credit (fixed, not scrolling) */}
        <div style={styles.credit}>
          <div style={styles.creditInner}>
            {t.createdBy} <span style={{ fontWeight: 900 }}>@adryndian</span>
          </div>
        </div>
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   Tabs
   ========================= */

function ScenesTab() {
  const { blueprint, setTab, t } = useStudio();

  const beats = pickBeats(blueprint);

  return (
    <div style={styles.card}>
      <CardHeader title={t.scenes} sub={t.scenesSub} />

      {!blueprint ? (
        <div style={styles.placeholder}>
          {t.noBlueprint}
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => setTab("Settings")} style={styles.secondaryBtn}>
              {t.goSettings}
            </button>
          </div>
        </div>
      ) : beats.length === 0 ? (
        <div style={styles.placeholder}>{t.beatsNotReadable}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {beats.map((b, idx) => (
            <div key={b?.id || idx} style={styles.sceneCard}>
              <div style={styles.sceneTop}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={styles.sceneBadge}>{b?.id || `S${idx + 1}`}</div>
                  <div style={{ fontWeight: 900 }}>{b?.goal || b?.title || "SCENE"}</div>
                  <Chip>{b?.time_window || "—"}</Chip>
                </div>
                <Chip>Draft</Chip>
              </div>

              <div style={styles.sceneGrid}>
                <div>
                  <div style={styles.miniLabel}>Action</div>
                  <div style={styles.miniBox}>{b?.action || "—"}</div>
                </div>
                <div>
                  <div style={styles.miniLabel}>On-screen text</div>
                  <div style={styles.miniBox}>{b?.on_screen_text || b?.onscreen_text || "—"}</div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={styles.miniLabel}>Negative prompt</div>
                <div style={styles.miniBox}>
                  {(b?.negative_prompt || b?.negatives || []).slice(0, 8).join(", ") || "—"}
                  {(b?.negative_prompt || b?.negatives || []).length > 8 ? "…" : ""}
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
                  {t.nextImage}
                </button>
                <button type="button" style={styles.secondaryBtn} onClick={() => alert("Next: Edit prompt per scene")}>
                  {t.editPrompt}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const {
    setTab,
    t,
    projectDraft,
    setProjectDraft,
    setBlueprint,
    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,
    analysisInfo,
    setAnalysisInfo,
    elapsedMs,
    setElapsedMs,
    progressPct,
    setProgressPct,
    typicalMs,
    setTypicalMs,
  } = useStudio();

  const [p, setP] = useState(projectDraft);

  // link autofill
  const [linkUrl, setLinkUrl] = useState("");

  // image analyze
  const [analyzing, setAnalyzing] = useState(false);

  const totalDuration = Number(p.scene_count || 0) * Number(p.seconds_per_scene || 0);

  const hasCore =
    (p.brand || "").trim() && (p.product_type || "").trim() && (p.material || "").trim();

  // assets are OPTIONAL now
  const hasModel = (p.model_ref_url || "").trim().length > 0;
  const hasProduct = (p.product_ref_url || "").trim().length > 0;

  const canGeneratePlan = hasCore && (hasModel && hasProduct); // keep requirement for current /api/plan
  // NOTE: if you truly want “no upload required”, you MUST also change /api/plan to not require model_ref_url & product_ref_url.

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function startTimer(provider) {
    // progress heuristic: ramp to 90% based on typicalMs
    const start = Date.now();
    setElapsedMs(0);
    setProgressPct(0);
    const typical = Math.max(15000, typicalMs || 45000);

    const tick = () => {
      const el = Date.now() - start;
      setElapsedMs(el);

      // progress: time-based ease-out (more stable than fake ETA)
      const ratio = clamp(el / typical, 0, 1);
      const eased = 1 - Math.pow(1 - ratio, 2.4); // easeOut
      const pct = clamp(Math.round(eased * 90), 0, 90); // never show 100 until done
      setProgressPct(pct);
    };

    tickRef.current = setInterval(tick, 200);
    startedAtRef.current = { start, provider };
  }

  function stopTimerAndCommit(success) {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;

    const meta = startedAtRef.current;
    if (!meta) return;

    const took = Date.now() - meta.start;

    if (success) {
      // update typical with simple moving average
      // newTypical = 0.75 old + 0.25 new
      const nextTypical = Math.round((typicalMs || 45000) * 0.75 + took * 0.25);
      setTypicalMs(clamp(nextTypical, 15000, 180000));
      setProgressPct(100);
    } else {
      // don't force 100 on failure
      setProgressPct((x) => clamp(x, 0, 95));
    }

    startedAtRef.current = null;
  }

  async function generatePlanOnce() {
    if (loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);

    // sync draft
    setProjectDraft(p);

    const provider = (p.ai_brain || "bedrock").toLowerCase();

    startTimer(provider);

    const ctrl = new AbortController();
    const timeoutMs = 120000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, project: p }),
        signal: ctrl.signal,
      });

      const raw = await r.text();
      const json = safeParseJson(raw);

      if (!r.ok) {
        // keep server preview if not json
        if (!json) throw new Error(`Non-JSON response (${r.status}). Preview: ${String(raw).slice(0, 220)}`);
        throw new Error(json?.error || `Plan failed (${r.status})`);
      }

      if (!json?.ok || !json?.blueprint) {
        throw new Error(json?.error || "Plan ok=false or blueprint missing.");
      }

      setBlueprint(json.blueprint);
      stopTimerAndCommit(true);
      setTab("Scenes");
    } catch (e) {
      stopTimerAndCommit(false);
      if (e?.name === "AbortError") {
        setPlanError(`Timeout after ${Math.round(timeoutMs / 1000)}s.`);
      } else {
        setPlanError(e?.message || String(e));
      }
    } finally {
      clearTimeout(timer);
      setLoadingPlan(false);
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
          product_ref_url: p.product_ref_url,
        }),
      });

      const raw = await r.text();
      const json = safeParseJson(raw);

      if (!r.ok || !json?.ok) {
        throw new Error(json?.error || `Analyze failed (${r.status}). Preview: ${String(raw).slice(0, 180)}`);
      }

      const f = json.fields || {};

      // only fill empty
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || ""),
        tone: prev.tone?.trim() ? prev.tone : (f.tone || prev.tone || ""),
        target_audience: prev.target_audience?.trim() ? prev.target_audience : (f.target_audience || ""),
      }));

      setAnalysisInfo(t.autofillOk);
    } catch (e) {
      setPlanError(e?.message || String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  async function autoFillFromLink() {
    if (!String(linkUrl || "").trim()) return;

    setPlanError("");
    setAnalysisInfo("");
    setAnalyzing(true);

    try {
      // endpoint optional. If not exist, you'll get 404.
      const r = await fetch("/api/analyze-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim() }),
      });

      const raw = await r.text();
      const json = safeParseJson(raw);

      if (!r.ok || !json?.ok) {
        throw new Error(json?.error || `Analyze-link failed (${r.status}). Preview: ${String(raw).slice(0, 180)}`);
      }

      const f = json.fields || {};

      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || ""),
        tone: prev.tone?.trim() ? prev.tone : (f.tone || prev.tone || ""),
        target_audience: prev.target_audience?.trim() ? prev.target_audience : (f.target_audience || ""),
      }));

      setAnalysisInfo(t.autofillOk);
    } catch (e) {
      setPlanError(e?.message || String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div style={styles.settingsWrap}>
      {/* 3 columns in 1 row (responsive) */}
      <div style={styles.grid3}>
        {/* Left column */}
        <div style={styles.card}>
          <CardHeader title={t.settings} sub="" />

          <Section title={t.aiBrain} sub={t.aiBrainSub}>
            <Grid2>
              <Field label={t.aiBrain}>
                <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
                  <option value="bedrock">Bedrock (DeepSeek + Claude)</option>
                  <option value="gemini">Gemini (single-pass)</option>
                </Select>
              </Field>
            </Grid2>
          </Section>

          {/* Link autofill (requested: put above Format & Timing) */}
          <Section title={t.autofillLinkTitle} sub={t.autofillLinkSub}>
            <Grid2>
              <Field label={t.productLink}>
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
              </Field>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  disabled={analyzing || !String(linkUrl || "").trim()}
                  onClick={autoFillFromLink}
                  style={{ ...styles.secondaryBtn, opacity: analyzing || !String(linkUrl || "").trim() ? 0.6 : 1 }}
                >
                  {analyzing ? t.analyzing : t.autofillFromLink}
                </button>
                {analysisInfo ? <Chip tone="ok">{analysisInfo}</Chip> : null}
              </div>
            </Grid2>
          </Section>

          <Section title={t.formatTiming} sub={t.formatTimingSub}>
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
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t.secondsPerScene}>
                <Select
                  value={String(p.seconds_per_scene)}
                  onChange={(e) => update("seconds_per_scene", Number(e.target.value))}
                >
                  {[4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}s
                    </option>
                  ))}
                </Select>
              </Field>
            </Grid2>

            <MiniRow>
              <Chip>
                {t.estimatedDuration}: {totalDuration}s
              </Chip>
            </MiniRow>
          </Section>
        </div>

        {/* Middle column */}
        <div style={styles.card}>
          <CardHeader title={t.core} sub={t.coreSub} />

          <Section title={t.core} sub="">
            <Grid2>
              <Field label={t.brand}>
                <Input value={p.brand || ""} onChange={(e) => update("brand", e.target.value)} placeholder="Brand" />
              </Field>
              <Field label={t.productType}>
                <Input
                  value={p.product_type || ""}
                  onChange={(e) => update("product_type", e.target.value)}
                  placeholder="sunscreen / hoodie / coffee"
                />
              </Field>
              <Field label={t.material}>
                <Input
                  value={p.material || ""}
                  onChange={(e) => update("material", e.target.value)}
                  placeholder="cotton / serum gel / stainless"
                />
              </Field>
            </Grid2>
          </Section>

          <Section title={t.assets} sub={t.assetsSub}>
            <Grid2>
              <ImageUploadField
                label={t.modelRef}
                kind="model"
                optional
                hideUrl
                showPreview
                projectId={p.project_id || "local"}
                valueUrl={p.model_ref_url || ""}
                onUrl={(url) => update("model_ref_url", url)}
              />
              <ImageUploadField
                label={t.productRef}
                kind="product"
                optional
                hideUrl
                showPreview
                projectId={p.project_id || "local"}
                valueUrl={p.product_ref_url || ""}
                onUrl={(url) => update("product_ref_url", url)}
              />
            </Grid2>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                disabled={analyzing || !hasModel || !hasProduct}
                onClick={autoFillFromImages}
                style={{ ...styles.secondaryBtn, opacity: analyzing || !hasModel || !hasProduct ? 0.6 : 1 }}
              >
                {analyzing ? t.analyzing : t.autofillFromImages}
              </button>

              {analysisInfo ? <Chip tone="ok">{analysisInfo}</Chip> : null}
            </div>
          </Section>
        </div>

        {/* Right column: (spacer / notes / could be future) */}
        <div style={styles.card}>
          <CardHeader title="Notes" sub="(Optional) Quick checklist" />
          <div style={{ display: "grid", gap: 10 }}>
            <div style={styles.noteBox}>
              • If plan fails with Claude/DeepSeek: ensure Bedrock inference profiles ENV are set in Vercel.
            </div>
            <div style={styles.noteBox}>
              • If Gemini returns 429: free-tier quota may be 0. Use billing-enabled key or switch provider.
            </div>
            <div style={styles.noteBox}>
              • If beats not readable: UI is now robust, but we still want to lock the final blueprint schema.
            </div>
          </div>
        </div>
      </div>

      {/* STATUS (bottom full-width card, centered container) */}
      <div style={styles.statusWrap}>
        <div style={styles.statusCard}>
          <CardHeader title={t.status} sub={t.statusSub} />

          <div style={styles.statusRow}>
            <Chip tone={hasCore ? "ok" : "bad"}>
              {t.readyCore} {hasCore ? t.ok : t.no}
            </Chip>
            <Chip tone={hasModel ? "ok" : "bad"}>
              {t.readyModel} {hasModel ? t.ok : t.no}
            </Chip>
            <Chip tone={hasProduct ? "ok" : "bad"}>
              {t.readyProduct} {hasProduct ? t.ok : t.no}
            </Chip>

            <Chip>
              {t.estimatedDuration}: {totalDuration}s
            </Chip>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={styles.smallTitle}>{t.progress}</div>
            <ProgressBar value={progressPct} busy={loadingPlan} />
            <div style={styles.progressMeta}>
              <Chip>
                {t.elapsed}: {msToHuman(elapsedMs)}
              </Chip>
              <Chip>
                {t.typical}: {msToHuman(typicalMs)}
              </Chip>
              <Chip>
                {t.provider}: {(p.ai_brain || "bedrock").toUpperCase()}
              </Chip>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              style={{
                ...styles.primaryBtn,
                opacity: !loadingPlan ? 1 : 0.7,
                cursor: !loadingPlan ? "pointer" : "not-allowed",
              }}
              disabled={loadingPlan}
              onClick={generatePlanOnce}
            >
              {loadingPlan ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <Spinner /> {t.generating}
                </span>
              ) : (
                t.generatePlan
              )}
            </button>

            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => {
                setBlueprint(null);
                setPlanError("");
                setProgressPct(0);
                setElapsedMs(0);
                setTab("Settings");
              }}
            >
              Reset
            </button>

            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => {
                // quick open Scenes even if empty
                setTab("Scenes");
              }}
            >
              {t.scenes}
            </button>
          </div>

          {planError ? <div style={styles.errorBox}>{planError}</div> : null}

          {/* IMPORTANT: current backend still requires both URLs */}
          {!canGeneratePlan ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
              Note: backend masih mewajibkan <b>model_ref_url</b> & <b>product_ref_url</b>. Kalau mau benar-benar opsional,
              kita perlu ubah /api/plan guard.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ExportTab() {
  const { blueprint, t } = useStudio();

  return (
    <div style={styles.card}>
      <CardHeader title={t.export} sub={t.exportSub} />

      {!blueprint ? (
        <div style={styles.placeholder}>{t.noBlueprint}</div>
      ) : (
        <div style={styles.placeholder}>
          {t.nextExport}
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => {
                const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "blueprint.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download blueprint.json
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   UI Atoms
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

function Grid2({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
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
  return <span style={{ ...styles.chip, ...toneStyle }}>{children}</span>;
}

function Step({ label, active }) {
  return <div style={{ ...styles.step, ...(active ? styles.stepActive : {}) }}>{label}</div>;
}

function MiniRow({ children }) {
  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>{children}</div>;
}

function ProgressBar({ value, busy }) {
  return (
    <div style={styles.progressOuter} aria-label="progress">
      <div
        style={{
          ...styles.progressInner,
          width: `${clamp(Number(value) || 0, 0, 100)}%`,
          ...(busy ? styles.progressInnerBusy : {}),
        }}
      />
    </div>
  );
}

function Spinner() {
  return <span style={styles.spinner} />;
}

/* =========================
   Styles
   ========================= */

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,237,213,1) 100%)",
    paddingBottom: 170, // space for tab + credit
  },

  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    backdropFilter: "blur(14px)",
    background: "rgba(255,255,255,0.60)",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  topBarInner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { fontWeight: 950, color: "#111827", fontSize: 18, letterSpacing: -0.2 },

  langWrap: { display: "flex", alignItems: "center", gap: 10 },
  langLabel: { fontSize: 12, fontWeight: 800, color: "#6b7280" },
  langPill: {
    display: "flex",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.65)",
  },
  langBtn: {
    border: "none",
    borderRadius: 999,
    padding: "8px 10px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    background: "transparent",
    color: "#111827",
  },
  langBtnActive: {
    background: "rgba(255,255,255,0.95)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },

  content: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 14,
  },

  settingsWrap: { display: "grid", gap: 14 },

  grid3: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },

  card: {
    borderRadius: 18,
    background: "rgba(255,255,255,0.68)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    padding: 14,
  },

  cardHeader: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  cardTitle: { fontWeight: 950, fontSize: 16, color: "#111827" },
  cardSub: { marginTop: 4, fontSize: 12, color: "#6b7280", fontWeight: 650 },

  sectionTitle: { fontWeight: 950, color: "#111827", fontSize: 13, letterSpacing: -0.1 },
  sectionSub: { marginTop: 4, fontSize: 12, color: "#6b7280", fontWeight: 650 },

  label: { fontSize: 12, fontWeight: 850, marginBottom: 6, color: "#111827" },

  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.92)",
    outline: "none",
    fontWeight: 700,
    fontSize: 13,
  },
  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.92)",
    outline: "none",
    fontWeight: 800,
    fontSize: 13,
  },

  chip: {
    fontSize: 12,
    fontWeight: 850,
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.70)",
    border: "1px solid rgba(0,0,0,0.08)",
    color: "#111827",
  },

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "none",
    background: "#f97316",
    color: "white",
    fontWeight: 950,
    fontSize: 13,
    minWidth: 180,
  },
  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.75)",
    fontWeight: 950,
    fontSize: 13,
  },

  placeholder: {
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(0,0,0,0.12)",
    color: "#374151",
    background: "rgba(255,255,255,0.55)",
    fontWeight: 700,
    fontSize: 13,
  },

  statusWrap: {
    display: "grid",
    placeItems: "center",
    paddingBottom: 10,
  },
  statusCard: {
    width: "min(980px, 100%)",
    borderRadius: 18,
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    padding: 14,
  },
  statusRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  progressOuter: {
    height: 12,
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  progressInner: {
    height: "100%",
    borderRadius: 999,
    background: "rgba(249,115,22,0.85)",
    transition: "width 220ms ease",
  },
  progressInnerBusy: {
    background:
      "linear-gradient(90deg, rgba(249,115,22,0.65), rgba(249,115,22,0.95), rgba(249,115,22,0.65))",
    backgroundSize: "220% 100%",
    animation: "ugcShimmer 1.1s linear infinite",
  },

  smallTitle: { fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 },
  progressMeta: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },

  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "#b91c1c",
    fontWeight: 850,
    fontSize: 12,
    whiteSpace: "pre-wrap",
  },

  noteBox: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontWeight: 750,
    color: "#374151",
    lineHeight: 1.35,
  },

  tabBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    padding: 12,
    paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
  },
  tabBarInner: {
    maxWidth: 520,
    margin: "0 auto",
    display: "flex",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    background: "rgba(255,255,255,0.70)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },
  tabBtn: {
    flex: 1,
    border: "none",
    borderRadius: 14,
    padding: "12px 10px",
    fontWeight: 900,
    cursor: "pointer",
    background: "transparent",
    color: "#111827",
    fontSize: 13,
  },
  tabBtnActive: {
    background: "rgba(255,255,255,0.95)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },

  // Scenes styles
  sceneCard: {
    borderRadius: 18,
    padding: 12,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.55)",
  },
  sceneTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  sceneBadge: {
    fontWeight: 950,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(249,115,22,0.18)",
    border: "1px solid rgba(249,115,22,0.20)",
  },
  sceneGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 },
  miniLabel: { fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 },
  miniBox: {
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(0,0,0,0.06)",
    color: "#111827",
    fontWeight: 650,
    fontSize: 13,
    whiteSpace: "pre-wrap",
  },
  stepperRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  step: {
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.65)",
  },
  stepActive: {
    background: "rgba(249,115,22,0.18)",
    borderColor: "rgba(249,115,22,0.22)",
  },
  sceneActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },

  // Credit fixed
  credit: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: "calc(74px + env(safe-area-inset-bottom))",
    display: "flex",
    justifyContent: "center",
    zIndex: 25,
    pointerEvents: "none",
  },
  creditInner: {
    pointerEvents: "auto",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(17,24,39,0.55)",
    textDecoration: "none",
    background: "rgba(255,255,255,0.60)",
    border: "1px solid rgba(0,0,0,0.06)",
    padding: "6px 10px",
    borderRadius: 999,
    backdropFilter: "blur(12px)",
  },

  spinner: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.55)",
    borderTopColor: "rgba(255,255,255,1)",
    display: "inline-block",
    animation: "ugcSpin 0.8s linear infinite",
  },
};

/* =========================
   Keyframes injection
   ========================= */
if (typeof document !== "undefined") {
  const id = "ugc-styles-kf";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      @keyframes ugcSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      @keyframes ugcShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 220% 50%; } }

      /* Responsive: collapse 3 columns */
      @media (max-width: 980px) {
        .__ugc_grid3 { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(style);
  }
}

// attach class for responsive rule (without extra CSS files)
styles.grid3 = { ...styles.grid3, className: "__ugc_grid3" };
