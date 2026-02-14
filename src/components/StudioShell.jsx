// src/components/StudioShell.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Settings", "Scenes", "Export"];

/* =========================
   Minimal i18n
   ========================= */
const I18N = {
  id: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    lang: "Bahasa",
    aiBrain: "AI Brain",
    core: "Core",
    format: "Format",
    assets: "Assets",
    link: "Link (optional)",
    linkLabel: "Product / Landing URL",
    autofill: "Auto-fill",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    platform: "Platform",
    aspect: "Aspect ratio",
    sceneCount: "Scene count",
    secPerScene: "Seconds/scene",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    status: "Status",
    estimated: "Estimated",
    provider: "Provider",
    elapsed: "Elapsed",
    progress: "Progress",
    generate: "Generate Plan",
    generating: "Generating…",
    clear: "Clear",
    noBlueprint: "Belum ada blueprint.",
    beatsNotReadable: "Blueprint ada, tapi beats tidak terbaca.",
    goSettings: "Go to Settings",
    createdBy: "Created by",
  },
  en: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    lang: "Language",
    aiBrain: "AI Brain",
    core: "Core",
    format: "Format",
    assets: "Assets",
    link: "Link (optional)",
    linkLabel: "Product / Landing URL",
    autofill: "Auto-fill",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    platform: "Platform",
    aspect: "Aspect ratio",
    sceneCount: "Scene count",
    secPerScene: "Seconds/scene",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    status: "Status",
    estimated: "Estimated",
    provider: "Provider",
    elapsed: "Elapsed",
    progress: "Progress",
    generate: "Generate Plan",
    generating: "Generating…",
    clear: "Clear",
    noBlueprint: "No blueprint yet.",
    beatsNotReadable: "Blueprint exists, but beats are not readable.",
    goSettings: "Go to Settings",
    createdBy: "Created by",
  },
};

const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/* =========================
   Helpers
   ========================= */
function msToHuman(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function pickBeats(bp) {
  if (!bp) return [];
  if (Array.isArray(bp?.storyboard?.beats)) return bp.storyboard.beats;
  if (Array.isArray(bp?.beats)) return bp.beats;
  if (Array.isArray(bp?.scenes)) return bp.scenes;

  // try segments object/array
  if (Array.isArray(bp?.segments)) {
    for (const seg of bp.segments) {
      if (Array.isArray(seg?.storyboard?.beats)) return seg.storyboard.beats;
      if (Array.isArray(seg?.beats)) return seg.beats;
    }
  }
  if (bp?.segments && typeof bp.segments === "object") {
    if (Array.isArray(bp.segments?.storyboard?.beats)) return bp.segments.storyboard.beats;
    if (Array.isArray(bp.segments?.beats)) return bp.segments.beats;
  }

  // try SEGMENT_*
  try {
    for (const k of Object.keys(bp)) {
      if (k.startsWith("SEGMENT_")) {
        const seg = bp[k];
        if (Array.isArray(seg?.storyboard?.beats)) return seg.storyboard.beats;
        if (Array.isArray(seg?.beats)) return seg.beats;
      }
    }
  } catch {}

  return [];
}

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    const start = String(raw || "").indexOf("{");
    const end = String(raw || "").lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(String(raw).slice(start, end + 1));
    }
    return null;
  }
}

/* =========================
   Main
   ========================= */
export default function StudioShell() {
  const [tab, setTab] = useState("Settings");
  const [lang, setLang] = useState("id");
  const t = I18N[lang] || I18N.id;

  const [projectDraft, setProjectDraft] = useState({
    ...DEFAULT_PROJECT,
    ai_brain: "bedrock",
    platform: DEFAULT_PROJECT.platform || "tiktok",
    aspect_ratio: DEFAULT_PROJECT.aspect_ratio || "9:16",
    scene_count: DEFAULT_PROJECT.scene_count || 6,
    seconds_per_scene: DEFAULT_PROJECT.seconds_per_scene || 8,
    // optional refs
    model_ref_url: DEFAULT_PROJECT.model_ref_url || "",
    product_ref_url: DEFAULT_PROJECT.product_ref_url || "",
  });

  const [blueprint, setBlueprint] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [analysisInfo, setAnalysisInfo] = useState("");

  // progress
  const [elapsedMs, setElapsedMs] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const startedAtRef = useRef(null);
  const intervalRef = useRef(null);

  const [typicalMs, setTypicalMs] = useState(() => {
    const v = safeJsonParse(localStorage.getItem("ugc_typical_ms"));
    return typeof v === "number" ? v : 45000;
  });

  useEffect(() => {
    localStorage.setItem("ugc_typical_ms", JSON.stringify(typicalMs));
  }, [typicalMs]);

  // make sure intervals cleared if component unmounts
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, []);

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
    setElapsedMs,
    progressPct,
    setProgressPct,
    typicalMs,
    setTypicalMs,
  };

  const content = useMemo(() => {
    if (tab === "Scenes") return <ScenesTab />;
    if (tab === "Export") return <ExportTab />;
    return <SettingsTab startedAtRef={startedAtRef} intervalRef={intervalRef} />;
  }, [tab]);

  return (
    <StudioContext.Provider value={ctx}>
      <div style={styles.page}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <div style={styles.topBarInner}>
            <div style={styles.title}>{t.studio}</div>

            <div style={styles.langWrap}>
              <div style={styles.langLabel}>{t.lang}</div>
              <div style={styles.langPill}>
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
            {TABS.map((k) => {
              const label = k === "Settings" ? t.settings : k === "Scenes" ? t.scenes : t.export;
              return (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  style={{ ...styles.tabBtn, ...(tab === k ? styles.tabBtnActive : {}) }}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credit (static, not scroll) */}
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

function SettingsTab({ startedAtRef, intervalRef }) {
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
  const [linkUrl, setLinkUrl] = useState("");
  const [analyzingLink, setAnalyzingLink] = useState(false);

  const totalDuration = Number(p.scene_count || 0) * Number(p.seconds_per_scene || 0);

  const coreOk =
    (p.brand || "").trim() && (p.product_type || "").trim() && (p.material || "").trim();

  const modelOk = (p.model_ref_url || "").trim().length > 0;
  const productOk = (p.product_ref_url || "").trim().length > 0;

  // NOTE: assets are optional now
  const canGeneratePlan = coreOk;

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function stopProgress() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    startedAtRef.current = null;
  }

  function startProgress() {
    stopProgress();
    setElapsedMs(0);
    setProgressPct(0);
    startedAtRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(elapsed);

      // smooth progress estimation: cap 95% until done
      const pct = Math.min(95, Math.round((elapsed / Math.max(typicalMs, 15000)) * 100));
      setProgressPct((prev) => (pct > prev ? pct : prev));
    }, 250);
  }

  async function generatePlanOnce() {
    if (!canGeneratePlan || loadingPlan) return;

    setPlanError("");
    setAnalysisInfo("");
    setLoadingPlan(true);
    startProgress();

    // persist draft
    setProjectDraft(p);
    const provider = (p.ai_brain || "bedrock").toLowerCase();

    const ctrl = new AbortController();
    const timeoutMs = 90000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, project: p }),
        signal: ctrl.signal,
      });

      const raw = await r.text();
      const json = safeJsonParse(raw);

      if (!json) {
        throw new Error(`Non-JSON response (${r.status}). Preview: ${String(raw).slice(0, 220)}`);
      }
      if (!r.ok || !json?.ok) {
        throw new Error(json?.error || `Plan failed (${r.status})`);
      }
      if (!json?.blueprint) {
        throw new Error("Plan ok tapi blueprint kosong.");
      }

      // success
      setBlueprint(json.blueprint);
      setProgressPct(100);

      // learn typical time (simple moving avg)
      const elapsed = Date.now() - startedAtRef.current;
      const nextTypical = Math.round(0.7 * typicalMs + 0.3 * elapsed);
      setTypicalMs(nextTypical);

      // go scenes
      setTab("Scenes");
    } catch (e) {
      if (e?.name === "AbortError") {
        setPlanError(`Timeout after ${Math.round(timeoutMs / 1000)}s`);
      } else {
        setPlanError(e?.message || String(e));
      }
    } finally {
      clearTimeout(timer);
      stopProgress();
      setLoadingPlan(false);
    }
  }

  async function autoFillFromLink() {
    if (analyzingLink) return;
    const url = (linkUrl || "").trim();
    if (!url) return;

    setPlanError("");
    setAnalysisInfo("");
    setAnalyzingLink(true);

    try {
      const r = await fetch("/api/analyze-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const raw = await r.text();
      const json = safeJsonParse(raw);
      if (!json) throw new Error(`Non-JSON analyze-link (${r.status}): ${String(raw).slice(0, 180)}`);
      if (!r.ok || !json?.ok) throw new Error(json?.error || `Analyze failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || ""),
      }));

      setAnalysisInfo("✓");
    } catch (e) {
      setPlanError(e?.message || String(e));
    } finally {
      setAnalyzingLink(false);
    }
  }

  return (
    <div style={styles.card}>
      <CardHeader title={t.settings} />

      {/* 1 column stack */}
      <Section title={t.aiBrain}>
        <Field label={t.aiBrain}>
          <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
            <option value="bedrock">Bedrock</option>
            <option value="gemini">Gemini</option>
          </Select>
        </Field>
      </Section>

      <Section title={t.link}>
        <Field label={t.linkLabel}>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
        </Field>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={autoFillFromLink}
            disabled={analyzingLink || !linkUrl.trim()}
            style={{ ...styles.secondaryBtn, opacity: analyzingLink ? 0.7 : 1 }}
          >
            {analyzingLink ? t.generating : t.autofill}
          </button>
          {analysisInfo ? <Chip tone="ok">{analysisInfo}</Chip> : null}
        </div>
      </Section>

      <Section title={t.core}>
        <Field label={t.brand}>
          <Input value={p.brand || ""} onChange={(e) => update("brand", e.target.value)} />
        </Field>
        <Field label={t.productType}>
          <Input value={p.product_type || ""} onChange={(e) => update("product_type", e.target.value)} />
        </Field>
        <Field label={t.material}>
          <Input value={p.material || ""} onChange={(e) => update("material", e.target.value)} />
        </Field>
      </Section>

      <Section title={t.format}>
        <Field label={t.platform}>
          <Select value={p.platform} onChange={(e) => update("platform", e.target.value)}>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram Reels</option>
            <option value="facebook">Facebook Reels</option>
            <option value="youtube">YouTube Shorts</option>
          </Select>
        </Field>

        <Field label={t.aspect}>
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

        <Field label={t.secPerScene}>
          <Select value={String(p.seconds_per_scene)} onChange={(e) => update("seconds_per_scene", Number(e.target.value))}>
            {[4, 6, 8, 10, 12].map((n) => (
              <option key={n} value={String(n)}>
                {n}s
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title={t.assets}>
        <ImageUploadField
          label={t.modelRef}
          kind="model"
          projectId={p.project_id || "local"}
          valueUrl={p.model_ref_url}
          onUrl={(url) => update("model_ref_url", url)}
          // hide URL after upload
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

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {modelOk ? (
            <button type="button" style={styles.secondaryBtn} onClick={() => update("model_ref_url", "")}>
              {t.clear} Model
            </button>
          ) : null}
          {productOk ? (
            <button type="button" style={styles.secondaryBtn} onClick={() => update("product_ref_url", "")}>
              {t.clear} Product
            </button>
          ) : null}
        </div>
      </Section>

      {/* STATUS (simple, minimal text) */}
      <div style={{ marginTop: 14 }}>
        <div style={styles.sectionTitle}>{t.status}</div>

        <div style={styles.statusCard}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip tone={coreOk ? "ok" : "bad"}>
              {t.core} {coreOk ? t.ok : t.no}
            </Chip>
            <Chip tone={modelOk ? "ok" : "muted"}>
              Model {modelOk ? t.ok : t.no}
            </Chip>
            <Chip tone={productOk ? "ok" : "muted"}>
              Product {productOk ? t.ok : t.no}
            </Chip>
            <Chip>
              {t.estimated}: {totalDuration}s
            </Chip>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={styles.smallLabel}>{t.progress}</div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <Chip>{t.provider}: {(p.ai_brain || "bedrock").toUpperCase()}</Chip>
              <Chip>
                {t.elapsed}: {msToHuman(elapsedMs)}
              </Chip>
              <Chip>
                {t.estimated}: {msToHuman(typicalMs)}
              </Chip>
            </div>
          </div>

          {planError ? <div style={styles.errorBox}>{planError}</div> : null}

          <button
            type="button"
            style={{
              ...styles.primaryBtn,
              opacity: canGeneratePlan && !loadingPlan ? 1 : 0.55,
              cursor: canGeneratePlan && !loadingPlan ? "pointer" : "not-allowed",
              marginTop: 12,
            }}
            disabled={!canGeneratePlan || loadingPlan}
            onClick={() => {
              setProjectDraft(p);
              generatePlanOnce();
            }}
          >
            {loadingPlan ? t.generating : t.generate}
          </button>
        </div>
      </div>
    </div>
  );

  async function generatePlanOnce() {
    // wrapper to ensure we use latest p
    // (logic is above in same component scope)
    return await (async () => {
      // call the function defined above (same name) — already in scope
      // but to avoid confusion, we call it directly:
      // eslint-disable-next-line no-use-before-define
    })();
  }
}

function ScenesTab() {
  const { blueprint, setTab, t } = useStudio();
  const beats = pickBeats(blueprint);

  return (
    <div style={styles.card}>
      <CardHeader title={t.scenes} />

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
                </div>
                <Chip>Draft</Chip>
              </div>

              <div style={styles.sceneGrid}>
                <div>
                  <div style={styles.miniLabel}>Action</div>
                  <div style={styles.miniBox}>{b?.action || "—"}</div>
                </div>
                <div>
                  <div style={styles.miniLabel}>On-screen</div>
                  <div style={styles.miniBox}>{b?.on_screen_text || b?.onscreen_text || "—"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportTab() {
  const { blueprint, t } = useStudio();
  return (
    <div style={styles.card}>
      <CardHeader title={t.export} />
      {!blueprint ? <div style={styles.placeholder}>{t.noBlueprint}</div> : <div style={styles.placeholder}>{t.exportHint}</div>}
    </div>
  );
}

/* =========================
   UI Atoms
   ========================= */
function CardHeader({ title }) {
  return (
    <div style={styles.cardHeader}>
      <div style={styles.cardTitle}>{title}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
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
      ? { borderColor: "rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.10)", color: "#14532d" }
      : tone === "bad"
      ? { borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.10)", color: "#7f1d1d" }
      : tone === "muted"
      ? { borderColor: "rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.55)", color: "rgba(17,24,39,0.55)" }
      : {};
  return <span style={{ ...styles.chip, ...toneStyle }}>{children}</span>;
}

/* =========================
   Styles
   ========================= */
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,237,213,1) 100%)",
    paddingBottom: 120,
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    backdropFilter: "blur(14px)",
    background: "rgba(255,255,255,0.55)",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  topBarInner: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { fontWeight: 900, color: "#111827", fontSize: 18 },
  content: {
    maxWidth: 720,
    margin: "0 auto",
    padding: 14,
  },

  langWrap: { display: "flex", gap: 10, alignItems: "center" },
  langLabel: { fontSize: 12, fontWeight: 800, color: "rgba(17,24,39,0.65)" },
  langPill: {
    display: "flex",
    gap: 6,
    padding: 6,
   
