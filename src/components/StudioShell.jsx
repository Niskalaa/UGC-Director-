// src/components/StudioShell.jsx
import React, { useMemo, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS_KEYS = ["Scenes", "Settings", "Export"];

const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/* =========================
   Helpers
   ========================= */
function fmtMMSS(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

const I18N = {
  id: {
    scenes: "Scenes",
    settings: "Settings",
    export: "Export",
    aiBrain: "AI Brain",
    language: "Bahasa",
    formatTiming: "Format & Timing",
    platform: "Platform",
    aspect: "Aspect ratio",
    sceneCount: "Scene count (max 10)",
    secondsPerScene: "Seconds per scene",
    coreInputs: "Core Inputs",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    assets: "Assets",
    autoFill: "Auto-fill from Images",
    analyzing: "Analyzing…",
    generating: "Generating…",
    generatePlan: "Generate Plan (once)",
    estTime: "Estimasi waktu",
    timeLeft: "Sisa waktu",
    pleaseWait: "Tunggu ya… sedang proses.",
    tip: "Kalau stuck, biasanya route /api/plan belum jalan atau quota/Bedrock error.",
    goSettings: "Go to Settings",
    noBlueprint: "Belum ada blueprint. Buka tab Settings → isi data → Generate Plan.",
    beatsMissing: "Blueprint ada, tapi beats tidak terbaca.",
    createdBy: "Created by"
  },
  en: {
    scenes: "Scenes",
    settings: "Settings",
    export: "Export",
    aiBrain: "AI Brain",
    language: "Language",
    formatTiming: "Format & Timing",
    platform: "Platform",
    aspect: "Aspect ratio",
    sceneCount: "Scene count (max 10)",
    secondsPerScene: "Seconds per scene",
    coreInputs: "Core Inputs",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    assets: "Assets",
    autoFill: "Auto-fill from Images",
    analyzing: "Analyzing…",
    generating: "Generating…",
    generatePlan: "Generate Plan (once)",
    estTime: "Estimated time",
    timeLeft: "Time left",
    pleaseWait: "Please wait… processing.",
    tip: "If it hangs, usually /api/plan isn’t responding or quota/Bedrock error.",
    goSettings: "Go to Settings",
    noBlueprint: "No blueprint yet. Go to Settings → fill inputs → Generate Plan.",
    beatsMissing: "Blueprint exists, but beats cannot be read.",
    createdBy: "Created by"
  }
};

export default function StudioShell() {
  const [tab, setTab] = useState("Scenes");

  // global studio state
  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" });
  const [blueprint, setBlueprint] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

  const lang = projectDraft?.ui_lang || "id";
  const t = I18N[lang] || I18N.id;
  const tabs = [t.scenes, t.settings, t.export];

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
    setPlanError
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
            <div style={styles.title}>Studio</div>
          </div>
        </div>

        {/* Content */}
        <div style={styles.content}>{content}</div>

        {/* Bottom tabs */}
        <div style={styles.tabBar}>
          <div style={styles.tabBarInner}>
            {tabs.map((label, idx) => {
              const key = TABS_KEYS[idx];
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{ ...styles.tabBtn, ...(tab === key ? styles.tabBtnActive : {}) }}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credit */}
        <div style={styles.credit}>
          {t.createdBy}{" "}
          <a
            href="https://x.com/adryndian"
            target="_blank"
            rel="noreferrer"
            style={styles.creditLink}
          >
            @adryndian
          </a>
        </div>
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   TABS
   ========================= */

function ScenesTab() {
  const { blueprint, setTab, projectDraft } = useStudio();
  const t = I18N[projectDraft?.ui_lang || "id"] || I18N.id;

  const beats =
    blueprint?.storyboard?.beats ||
    blueprint?.SEGMENT_3?.storyboard?.beats ||
    blueprint?.segments?.storyboard?.beats ||
    [];

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{t.scenes}</div>
        <div style={styles.cardSub}>Per-scene workflow: plan → image → approve → video → audio (manual trigger)</div>
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
                    <div style={styles.miniLabel}>On-screen text</div>
                    <div style={styles.miniBox}>{b.on_screen_text || "—"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={styles.miniLabel}>Negative prompt</div>
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
                    Generate Image
                  </button>
                  <button type="button" style={styles.secondaryBtn} onClick={() => alert("Next: Edit prompt per scene")}>
                    Edit Prompt
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

function SettingsTab() {
  const {
    setTab,
    projectDraft,
    setProjectDraft,
    setBlueprint,
    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError
  } = useStudio();

  const [p, setP] = React.useState(projectDraft);

  const [analyzing, setAnalyzing] = React.useState(false);
  const [analysisInfo, setAnalysisInfo] = React.useState("");

  // loading UI
  const [progress, setProgress] = React.useState(0);
  const [etaSec, setEtaSec] = React.useState(90);
  const [leftSec, setLeftSec] = React.useState(90);

  const lang = (p.ui_lang || "id");
  const t = I18N[lang] || I18N.id;

  React.useEffect(() => {
    if (!loadingPlan && !analyzing) return;
    const iv = setInterval(() => {
      setLeftSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(iv);
  }, [loadingPlan, analyzing]);

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

  async function generatePlanOnce() {
    if (!canGeneratePlan || loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);

    // ETA rule: base 60s + 6s/scene (cap 150s)
    const estimated = Math.min(150, 60 + Number(p.scene_count || 6) * 6);
    setEtaSec(estimated);
    setLeftSec(estimated);
    setProgress(2);

    setProjectDraft(p);

    const provider = (p.ai_brain || "bedrock").toLowerCase();

    const ctrl = new AbortController();
    const timeoutMs = estimated * 1000 + 15000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    const pv = setInterval(() => {
      setProgress((x) => (x < 92 ? x + 1 : x));
    }, 900);

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

      setProgress(100);
      setBlueprint(json.blueprint);
      setTab("Scenes");
    } catch (e) {
      if (e?.name === "AbortError") {
        setPlanError(`Timeout after ${Math.round(timeoutMs / 1000)}s. Server mungkin hang / route tidak kepanggil.`);
      } else {
        setPlanError(e?.message || String(e));
      }
    } finally {
      clearTimeout(timer);
      clearInterval(pv);
      setLoadingPlan(false);
      setTimeout(() => setProgress(0), 400);
    }
  }

  async function autoFillFromImages() {
    if (analyzing) return;
    if (!(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim()) return;

    setPlanError("");
    setAnalysisInfo("");
    setAnalyzing(true);

    const estimated = 25;
    setEtaSec(estimated);
    setLeftSec(estimated);
    setProgress(2);

    const pv = setInterval(() => {
      setProgress((x) => (x < 92 ? x + 2 : x));
    }, 700);

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

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Analyze failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || ""),
        tone: prev.tone?.trim() ? prev.tone : (f.tone || "natural gen-z"),
        target_audience: prev.target_audience?.trim() ? prev.target_audience : (f.target_audience || "")
      }));

      setProgress(100);
      setAnalysisInfo("Auto-fill sukses ✓ (cek Core Inputs & Tone).");
    } catch (e) {
      setPlanError(e?.message || String(e));
    } finally {
      clearInterval(pv);
      setAnalyzing(false);
      setTimeout(() => setProgress(0), 400);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{t.settings}</div>
        <div style={styles.cardSub}>Isi data → Auto-fill → Generate Plan</div>
      </div>

      {/* Language */}
      <Section title={t.language} sub="">
        <Grid2>
          <Field label={t.language}>
            <Select value={p.ui_lang || "id"} onChange={(e) => update("ui_lang", e.target.value)}>
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </Grid2>
      </Section>

      {/* AI Brain */}
      <Section title={t.aiBrain} sub="Default: Bedrock. Gemini opsional.">
        <Grid2>
          <Field label={t.aiBrain}>
            <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
              <option value="bedrock">Bedrock (DeepSeek + Claude)</option>
              <option value="gemini">Gemini (single-pass)</option>
            </Select>
          </Field>
        </Grid2>
      </Section>

      {/* Format & timing */}
      <Section title={t.formatTiming} sub="Atur jumlah scene dan durasi per scene.">
        <Grid2>
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
      </Section>

      {/* Core */}
      <Section title={t.coreInputs} sub="Wajib untuk generate plan.">
        <Grid2>
          <Field label={t.brand}>
            <Input value={p.brand} onChange={(e) => update("brand", e.target.value)} placeholder="Nama brand" />
          </Field>
          <Field label={t.productType}>
            <Input value={p.product_type} onChange={(e) => update("product_type", e.target.value)} placeholder="Contoh: sunscreen, hoodie, coffee" />
          </Field>
          <Field label={t.material}>
            <Input value={p.material} onChange={(e) => update("material", e.target.value)} placeholder="Contoh: cotton, serum gel, stainless" />
          </Field>
        </Grid2>

        <MiniRow>
          <Chip>Estimated duration: {totalDuration}s</Chip>
          <Chip>AI Brain: {(p.ai_brain || "bedrock").toUpperCase()}</Chip>
        </MiniRow>
      </Section>

      {/* Assets */}
      <Section title={t.assets} sub="Upload → URL otomatis → Auto-fill.">
        <Grid2>
          <ImageUploadField
            label="Model reference *"
            kind="model"
            projectId={p.project_id || "local"}
            valueUrl={p.model_ref_url}
            onUrl={(url) => update("model_ref_url", url)}
          />
          <ImageUploadField
            label="Product reference *"
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

      {planError ? <div style={styles.errorBox}>{planError}</div> : null}

      <div style={styles.stickyBar}>
        <div style={styles.stickyInner}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip>{(p.brand || "").trim() ? "Core ✓" : "Core ✗"}</Chip>
            <Chip>{(p.model_ref_url || "").trim() ? "Model ✓" : "Model ✗"}</Chip>
            <Chip>{(p.product_ref_url || "").trim() ? "Product ✓" : "Product ✗"}</Chip>
          </div>

          <button
            type="button"
            style={{
              ...styles.primaryBtn,
              opacity: canGeneratePlan && !loadingPlan ? 1 : 0.5,
              cursor: canGeneratePlan && !loadingPlan ? "pointer" : "not-allowed"
            }}
            disabled={!canGeneratePlan || loadingPlan}
            onClick={generatePlanOnce}
          >
            {loadingPlan ? t.generating : t.generatePlan}
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {(loadingPlan || analyzing) ? (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <div style={styles.spinner} />
            <div style={{ fontWeight: 900, marginTop: 10 }}>
              {loadingPlan ? t.generating : t.analyzing}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, textAlign: "center" }}>
              {t.pleaseWait}
            </div>

            <div style={{ width: "100%", marginTop: 12 }}>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${Math.min(100, progress)}%` }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: "#374151" }}>
                  {t.estTime}: {fmtMMSS(etaSec)}
                </div>
                <div style={{ fontWeight: 900, color: "#111827" }}>
                  {t.timeLeft}: {fmtMMSS(leftSec)}
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
                {t.tip}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExportTab() {
  const { blueprint, projectDraft } = useStudio();
  const t = I18N[projectDraft?.ui_lang || "id"] || I18N.id;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{t.export}</div>
        <div style={styles.cardSub}>Download blueprint + assets per scene</div>
      </div>
      {!blueprint ? (
        <div style={styles.placeholder}>Belum ada blueprint. Generate plan dulu di Settings.</div>
      ) : (
        <div style={styles.placeholder}>Next step: tombol download JSON blueprint + per-scene downloads.</div>
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
      <div style={{ fontWeight: 900, color: "#111827", marginBottom: 6 }}>{title}</div>
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
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: "#111827" }}>{label}</div>
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
        fontWeight: 600
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
        fontWeight: 700
      }}
    />
  );
}

function Chip({ children }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 800,
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
        fontWeight: 900,
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
    justifyContent: "space-between"
  },
  title: { fontWeight: 900, color: "#111827", fontSize: 18 },
  content: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 14
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
  cardTitle: { fontWeight: 900, fontSize: 16, color: "#111827" },
  cardSub: { marginTop: 4, fontSize: 12, color: "#6b7280" },
  placeholder: {
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(0,0,0,0.12)",
    color: "#374151",
    background: "rgba(255,255,255,0.55)"
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
    fontWeight: 800,
    cursor: "pointer",
    background: "transparent",
    color: "#111827"
  },
  tabBtnActive: {
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)"
  },

  stickyBar: { position: "sticky", bottom: 0, marginTop: 16, paddingTop: 12 },
  stickyInner: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    padding: 12,
    borderRadius: 18,
    background: "rgba(255,255,255,0.65)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.5)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
  },
  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "none",
    background: "#f97316",
    color: "white",
    fontWeight: 900
  },
  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.7)",
    fontWeight: 900
  },

  sceneCard: {
    borderRadius: 18,
    padding: 12,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.55)"
  },
  sceneTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  sceneBadge: {
    fontWeight: 900,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(249,115,22,0.18)",
    border: "1px solid rgba(249,115,22,0.20)"
  },
  sceneGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 },
  miniLabel: { fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 },
  miniBox: {
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(0,0,0,0.06)",
    color: "#111827",
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: "pre-wrap"
  },
  stepperRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  sceneActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },

  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "#b91c1c",
    fontWeight: 800
  },

  // overlay + progress
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(255,255,255,0.65)",
    backdropFilter: "blur(10px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  overlayCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.12)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  spinner: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "4px solid rgba(0,0,0,0.10)",
    borderTop: "4px solid rgba(249,115,22,0.95)",
    animation: "spin 0.9s linear infinite"
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    background: "rgba(0,0,0,0.06)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "rgba(249,115,22,0.95)",
    transition: "width 200ms ease"
  },

  // credit
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
    fontWeight: 800,
    color: "rgba(17,24,39,0.55)",
    textDecoration: "none",
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(0,0,0,0.06)",
    padding: "6px 10px",
    borderRadius: 999,
    backdropFilter: "blur(12px)"
  }
};
