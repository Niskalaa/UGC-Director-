// src/components/StudioShell.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Scenes", "Settings", "Export"];

const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/** Normalize agar aman dari variasi response:
 *  - blueprint bisa kebungkus { blueprint: {...} }
 *  - atau langsung object blueprint
 */
function normalizeBlueprint(b) {
  if (!b) return null;
  if (b.blueprint && typeof b.blueprint === "object") return b.blueprint;
  return b;
}

/** Convert scene_plans -> beats-like UI items */
function getScenes(blueprint) {
  const bp = normalizeBlueprint(blueprint);
  if (!bp) return [];

  // Primary: scene_plans
  if (Array.isArray(bp.scene_plans) && bp.scene_plans.length) {
    return bp.scene_plans.map((s, i) => ({
      id: s.id || `S${i + 1}`,
      goal: s.title || s.goal || `Scene ${i + 1}`,
      time_window: s.time_window || "",
      action: s.action || "",
      on_screen_text: s.on_screen_text || "",
      negative_prompt: Array.isArray(s.negative_prompt) ? s.negative_prompt : [],
      // optional extras
      video_prompt: s.video_prompt || "",
      vo: s.vo || ""
    }));
  }

  // Fallback: storyboard.beats (kalau suatu hari schema berubah)
  const beats =
    bp?.storyboard?.beats ||
    bp?.SEGMENT_3?.storyboard?.beats ||
    bp?.segments?.storyboard?.beats ||
    [];

  if (Array.isArray(beats) && beats.length) {
    return beats.map((b, i) => ({
      id: b.id || `S${i + 1}`,
      goal: b.goal || "",
      time_window: b.time_window || "",
      action: b.action || "",
      on_screen_text: b.on_screen_text || "",
      negative_prompt: Array.isArray(b.negative_prompt) ? b.negative_prompt : [],
      video_prompt: b.video_prompt || "",
      vo: b.vo || ""
    }));
  }

  return [];
}

export default function StudioShell() {
  const [tab, setTab] = useState("Settings");

  // theme
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.setAttribute("data-theme", "dark");
    else root.setAttribute("data-theme", "light");
  }, [dark]);

  // global studio state
  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" });
  const [blueprint, setBlueprint] = useState(null);

  // status / loading
  const [statusOpen, setStatusOpen] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [planError, setPlanError] = useState("");
  const [toast, setToast] = useState("");

  // loading timer
  const startedAtRef = useRef(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!loadingPlan) return;
    const t = setInterval(() => {
      const ms = Date.now() - (startedAtRef.current || Date.now());
      setElapsedSec(Math.floor(ms / 1000));
    }, 250);
    return () => clearInterval(t);
  }, [loadingPlan]);

  // auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

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
    setToast,
    setLoadingLabel,
    startedAtRef,
    setElapsedSec
  };

  const content = useMemo(() => {
    if (tab === "Scenes") return <ScenesTab />;
    if (tab === "Settings") return <SettingsTab />;
    return <ExportTab />;
  }, [tab]);

  return (
    <StudioContext.Provider value={ctx}>
      <div style={styles.page}>
        {/* Top Bar */}
        <div style={styles.topBar}>
          <div style={styles.topBarInner}>
            <div style={styles.brand}>
              <div style={styles.brandDot} />
              <div style={styles.brandText}>UGC Studio</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setDark((v) => !v)}
                style={styles.ghostBtn}
                title="Toggle theme"
              >
                {dark ? "Dark" : "Light"}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabsRow}>
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{ ...styles.tabBtn, ...(tab === t ? styles.tabBtnActive : {}) }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={styles.content}>{content}</div>

        {/* Status (minimizable) */}
        <div style={styles.statusWrap}>
          <div style={{ ...styles.statusCard, ...(statusOpen ? {} : styles.statusCardMin) }}>
            <div style={styles.statusTop}>
              <div style={styles.statusTitle}>Status</div>
              <button
                type="button"
                onClick={() => setStatusOpen((v) => !v)}
                style={styles.ghostBtn}
              >
                {statusOpen ? "Minimize" : "Show"}
              </button>
            </div>

            {statusOpen ? (
              <>
                <div style={styles.statusRow}>
                  {loadingPlan ? (
                    <>
                      <div style={styles.spinner} />
                      <div style={styles.statusText}>
                        {loadingLabel || "Generating…"} <span style={{ opacity: 0.7 }}>({elapsedSec}s)</span>
                      </div>
                    </>
                  ) : (
                    <div style={styles.statusText}>Idle</div>
                  )}
                </div>

                {planError ? <div style={styles.errorBox}>{planError}</div> : null}
              </>
            ) : null}
          </div>
        </div>

        {/* Credit (static bottom, not scrolling) */}
        <div style={styles.credit}>
          Created by <span style={{ fontWeight: 800 }}>adryndian</span>
        </div>

        {/* Toast */}
        {toast ? <div style={styles.toast}>{toast}</div> : null}
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   TABS
   ========================= */

function ScenesTab() {
  const { blueprint, setTab } = useStudio();
  const scenes = getScenes(blueprint);

  return (
    <div style={styles.card}>
      <CardHeader title="Scenes" sub={blueprint ? "" : "Generate plan dulu di Settings."} />

      {!blueprint ? (
        <div style={styles.empty}>
          <button type="button" onClick={() => setTab("Settings")} style={styles.primaryBtn}>
            Go to Settings
          </button>
        </div>
      ) : scenes.length === 0 ? (
        <div style={styles.empty}>
          Tidak ada scene ditemukan di blueprint. (Aku sudah support `scene_plans` + fallback `storyboard.beats`.)
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {scenes.map((s) => (
            <div key={s.id} style={styles.sceneCard}>
              <div style={styles.sceneTop}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={styles.badge}>{s.id}</span>
                  <span style={{ fontWeight: 800 }}>{s.goal}</span>
                  {s.time_window ? <span style={styles.pill}>{s.time_window}</span> : null}
                </div>
              </div>

              {s.action ? (
                <div style={{ marginTop: 10 }}>
                  <div style={styles.smallLabel}>Action</div>
                  <div style={styles.box}>{s.action}</div>
                </div>
              ) : null}

              {s.on_screen_text ? (
                <div style={{ marginTop: 10 }}>
                  <div style={styles.smallLabel}>On-screen</div>
                  <div style={styles.box}>{s.on_screen_text}</div>
                </div>
              ) : null}

              {s.negative_prompt?.length ? (
                <div style={{ marginTop: 10 }}>
                  <div style={styles.smallLabel}>Negative</div>
                  <div style={styles.box}>{s.negative_prompt.slice(0, 10).join(", ")}</div>
                </div>
              ) : null}
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
    projectDraft,
    setProjectDraft,
    setBlueprint,
    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,
    setToast,
    setLoadingLabel,
    startedAtRef,
    setElapsedSec
  } = useStudio();

  const [p, setP] = useState(projectDraft);

  // optional: link scrape
  const [linkUrl, setLinkUrl] = useState("");

  // analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [scraping, setScraping] = useState(false);

  const canGeneratePlan =
    (p.brand || "").trim() &&
    (p.product_type || "").trim() &&
    (p.material || "").trim() &&
    (p.platform || "").trim() &&
    (p.aspect_ratio || "").trim() &&
    Number(p.scene_count || 0) > 0 &&
    Number(p.seconds_per_scene || 0) > 0;

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  async function generatePlanOnce() {
    if (!canGeneratePlan || loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);
    setLoadingLabel("Generating plan");
    startedAtRef.current = Date.now();
    setElapsedSec(0);

    // persist global draft
    setProjectDraft(p);

    const provider = (p.ai_brain || "bedrock").toLowerCase();
    const ctrl = new AbortController();
    const timeoutMs = 120000;
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
        throw new Error(`Non-JSON response (${r.status})`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Plan failed (${r.status})`);

      const bp = normalizeBlueprint(json.blueprint);
      if (!bp) throw new Error("Blueprint kosong dari server.");

      setBlueprint(bp);
      setToast("Generate success ✓");
      setTab("Scenes");
    } catch (e) {
      if (e?.name === "AbortError") setPlanError("Timeout. Coba lagi atau cek logs /api/plan.");
      else setPlanError(e?.message || String(e));
    } finally {
      clearTimeout(timer);
      setLoadingPlan(false);
      setLoadingLabel("");
    }
  }

  async function autoFillFromImages() {
    if (analyzing) return;
    const hasModel = (p.model_ref_url || "").trim();
    const hasProduct = (p.product_ref_url || "").trim();
    if (!hasModel || !hasProduct) {
      setPlanError("Upload model + product dulu (opsional tapi dibutuhkan untuk image analysis).");
      return;
    }

    setPlanError("");
    setAnalyzing(true);
    setLoadingLabel("Analyzing images");
    startedAtRef.current = Date.now();
    setElapsedSec(0);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);

    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_ref_url: p.model_ref_url, product_ref_url: p.product_ref_url }),
        signal: ctrl.signal
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON analyze response (${r.status})`);
      }
      if (!r.ok || !json?.ok) throw new Error(json?.error || `Analyze failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || ""),
        tone: prev.tone?.trim() ? prev.tone : (f.tone || prev.tone || "natural gen-z"),
        target_audience: prev.target_audience?.trim() ? prev.target_audience : (f.target_audience || "")
      }));

      setToast("Auto-fill success ✓");
    } catch (e) {
      if (e?.name === "AbortError") setPlanError("Analyze timeout.");
      else setPlanError(e?.message || String(e));
    } finally {
      clearTimeout(timer);
      setAnalyzing(false);
      setLoadingLabel("");
    }
  }

  async function autoFillFromLink() {
    if (scraping) return;
    const u = (linkUrl || "").trim();
    if (!u) return;

    setPlanError("");
    setScraping(true);
    setLoadingLabel("Scraping link");
    startedAtRef.current = Date.now();
    setElapsedSec(0);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);

    try {
      const r = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
        signal: ctrl.signal
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON scrape response (${r.status})`);
      }
      if (!r.ok || !json?.ok) throw new Error(json?.error || `Scrape failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || ""),
        target_audience: prev.target_audience?.trim() ? prev.target_audience : (f.target_audience || ""),
        tone: prev.tone?.trim() ? prev.tone : (f.tone || prev.tone || "natural gen-z")
      }));

      setToast("Auto-fill from link ✓");
    } catch (e) {
      if (e?.name === "AbortError") setPlanError("Scrape timeout.");
      else setPlanError(e?.message || String(e));
    } finally {
      clearTimeout(timer);
      setScraping(false);
      setLoadingLabel("");
    }
  }

  return (
    <div style={styles.card}>
      <CardHeader title="Settings" sub="" />

      {/* Brain */}
      <Section title="AI Brain">
        <Grid2>
          <Field label="Provider">
            <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
              <option value="bedrock">Bedrock</option>
              <option value="gemini">Gemini</option>
            </Select>
          </Field>
        </Grid2>
      </Section>

      {/* Optional Link Scrape */}
      <Section title="Auto-fill (optional)">
        <div style={{ display: "grid", gap: 10 }}>
          <Field label="Product page URL (optional)">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <button
            type="button"
            onClick={autoFillFromLink}
            disabled={scraping || !linkUrl.trim()}
            style={{ ...styles.secondaryBtn, opacity: scraping || !linkUrl.trim() ? 0.6 : 1 }}
          >
            {scraping ? "Scraping…" : "Auto-fill from Link"}
          </button>
        </div>
      </Section>

      {/* Format */}
      <Section title="Format & Timing">
        <Grid2>
          <Field label="Platform">
            <Select value={p.platform} onChange={(e) => update("platform", e.target.value)}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube Shorts</option>
              <option value="facebook">Facebook</option>
            </Select>
          </Field>

          <Field label="Aspect ratio">
            <Select value={p.aspect_ratio} onChange={(e) => update("aspect_ratio", e.target.value)}>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
            </Select>
          </Field>

          <Field label="Scene count">
            <Select value={String(p.scene_count)} onChange={(e) => update("scene_count", Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </Select>
          </Field>

          <Field label="Seconds/scene">
            <Select value={String(p.seconds_per_scene)} onChange={(e) => update("seconds_per_scene", Number(e.target.value))}>
              {[4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={String(n)}>{n}s</option>
              ))}
            </Select>
          </Field>
        </Grid2>
      </Section>

      {/* Core */}
      <Section title="Core">
        <Grid2>
          <Field label="Brand">
            <Input value={p.brand} onChange={(e) => update("brand", e.target.value)} />
          </Field>
          <Field label="Product type">
            <Input value={p.product_type} onChange={(e) => update("product_type", e.target.value)} />
          </Field>
          <Field label="Material">
            <Input value={p.material} onChange={(e) => update("material", e.target.value)} />
          </Field>
          <Field label="Tone (optional)">
            <Input value={p.tone || ""} onChange={(e) => update("tone", e.target.value)} placeholder="natural gen-z" />
          </Field>
        </Grid2>
      </Section>

      {/* Assets (optional) */}
      <Section title="Assets (optional)">
        <Grid2>
          <ImageUploadField
            label="Model reference"
            kind="model"
            projectId={p.project_id || "local"}
            valueUrl={p.model_ref_url || ""}
            onUrl={(url) => update("model_ref_url", url)}
            optional
            hideUrl
            showPreview
          />
          <ImageUploadField
            label="Product reference"
            kind="product"
            projectId={p.project_id || "local"}
            valueUrl={p.product_ref_url || ""}
            onUrl={(url) => update("product_ref_url", url)}
            optional
            hideUrl
            showPreview
          />
        </Grid2>

        <button
          type="button"
          onClick={autoFillFromImages}
          disabled={analyzing || !(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim()}
          style={{
            ...styles.secondaryBtn,
            marginTop: 10,
            opacity: analyzing || !(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim() ? 0.6 : 1
          }}
        >
          {analyzing ? "Analyzing…" : "Auto-fill from Images"}
        </button>
      </Section>

      {/* Generate */}
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={generatePlanOnce}
          disabled={!canGeneratePlan || loadingPlan}
          style={{
            ...styles.primaryBtn,
            width: "100%",
            opacity: !canGeneratePlan || loadingPlan ? 0.6 : 1
          }}
        >
          {loadingPlan ? "Generating…" : "Generate Plan"}
        </button>
      </div>

      {planError ? <div style={styles.errorBox}>{planError}</div> : null}
    </div>
  );
}

function ExportTab() {
  const { blueprint } = useStudio();
  return (
    <div style={styles.card}>
      <CardHeader title="Export" sub="" />
      {!blueprint ? (
        <div style={styles.empty}>Generate dulu.</div>
      ) : (
        <pre style={styles.pre}>
          {JSON.stringify(normalizeBlueprint(blueprint), null, 2)}
        </pre>
      )}
    </div>
  );
}

/* =========================
   UI helpers
   ========================= */

function CardHeader({ title, sub }) {
  return (
    <div style={styles.cardHeader}>
      <div style={styles.cardTitle}>{title}</div>
      {sub ? <div style={styles.cardSub}>{sub}</div> : null}
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

function Grid2({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", gap: 12 }}>
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

/* =========================
   Styles (CSS vars friendly)
   ========================= */

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--fg)",
    paddingBottom: 120
  },

  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "var(--card)",
    borderBottom: "1px solid var(--border)"
  },
  topBarInner: {
    maxWidth: 920,
    margin: "0 auto",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brand: { display: "flex", gap: 10, alignItems: "center" },
  brandDot: { width: 10, height: 10, borderRadius: 999, background: "var(--accent)" },
  brandText: { fontWeight: 900 },

  tabsRow: {
    maxWidth: 920,
    margin: "10px auto 0",
    padding: "0 14px",
    display: "flex",
    gap: 8
  },
  tabBtn: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--fg)",
    fontWeight: 800,
    cursor: "pointer"
  },
  tabBtnActive: {
    background: "rgba(249,115,22,0.14)",
    borderColor: "rgba(249,115,22,0.28)"
  },

  content: {
    maxWidth: 920,
    margin: "0 auto",
    padding: 14
  },

  card: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 14
  },
  cardHeader: {
    paddingBottom: 10,
    borderBottom: "1px solid var(--border)",
    marginBottom: 12
  },
  cardTitle: { fontWeight: 900, fontSize: 16 },
  cardSub: { marginTop: 4, opacity: 0.75, fontSize: 12 },

  sectionTitle: { fontWeight: 900, fontSize: 13, marginBottom: 6, opacity: 0.95 },
  label: { fontSize: 12, fontWeight: 800, marginBottom: 6, opacity: 0.9 },

  input: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--fg)",
    outline: "none",
    fontWeight: 700
  },
  select: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--fg)",
    outline: "none",
    fontWeight: 800
  },

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(249,115,22,0.35)",
    background: "var(--accent)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer"
  },
  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--fg)",
    fontWeight: 900,
    cursor: "pointer"
  },
  ghostBtn: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--fg)",
    fontWeight: 900,
    cursor: "pointer"
  },

  empty: {
    padding: 14,
    borderRadius: 14,
    border: "1px dashed var(--border)",
    textAlign: "center"
  },

  sceneCard: {
    borderRadius: 16,
    border: "1px solid var(--border)",
    padding: 12,
    background: "rgba(255,255,255,0.02)"
  },
  sceneTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  badge: {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(249,115,22,0.14)",
    border: "1px solid rgba(249,115,22,0.25)"
  },
  pill: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    opacity: 0.9
  },

  smallLabel: { fontSize: 12, fontWeight: 900, marginBottom: 6, opacity: 0.9 },
  box: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    whiteSpace: "pre-wrap",
    fontSize: 13,
    fontWeight: 650
  },

  pre: {
    margin: 0,
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    overflow: "auto",
    maxHeight: 420,
    fontSize: 12
  },

  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.25)",
    background: "rgba(239,68,68,0.10)",
    color: "var(--fg)",
    fontWeight: 800
  },

  statusWrap: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 46,
    display: "flex",
    justifyContent: "center",
    zIndex: 30,
    pointerEvents: "none"
  },
  statusCard: {
    width: "min(720px, calc(100vw - 24px))",
    pointerEvents: "auto",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 18px 60px rgba(0,0,0,0.25)"
  },
  statusCardMin: {
    paddingBottom: 8
  },
  statusTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  statusTitle: { fontWeight: 900 },
  statusRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 },
  statusText: { fontWeight: 800, opacity: 0.95 },

  spinner: {
    width: 16,
    height: 16,
    borderRadius: 999,
    border: "2px solid rgba(249,115,22,0.35)",
    borderTopColor: "rgba(249,115,22,1)",
    animation: "spin 0.9s linear infinite"
  },

  toast: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 92,
    display: "flex",
    justifyContent: "center",
    zIndex: 40,
    pointerEvents: "none"
  },

  credit: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 10,
    textAlign: "center",
    fontSize: 12,
    opacity: 0.7
  }
};
