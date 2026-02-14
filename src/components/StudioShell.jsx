// src/components/StudioShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Settings", "Scenes", "Export"];

const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/* ---------------------------
   Utils
--------------------------- */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function msToClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function downloadJson(obj, filename = "blueprint.json") {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openJson(obj) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<pre style="white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${escapeHtml(JSON.stringify(obj, null, 2))}</pre>`);
  w.document.close();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ✅ robust scene extraction: supports your uploaded blueprint.json (scene_plans)
function extractScenes(blueprint) {
  if (!blueprint) return [];

  const bp = blueprint.blueprint ? blueprint.blueprint : blueprint;

  // primary
  if (Array.isArray(bp.scene_plans)) return bp.scene_plans;

  // fallbacks
  const beats =
    bp?.storyboard?.beats ||
    bp?.SEGMENT_3?.storyboard?.beats ||
    bp?.segments?.storyboard?.beats ||
    bp?.storyboard?.scenes ||
    [];

  return Array.isArray(beats) ? beats : [];
}

/* ---------------------------
   Toast
--------------------------- */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onClose?.(), 2600);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div style={styles.toastWrap}>
      <div style={{ ...styles.toast, ...(toast.type === "ok" ? styles.toastOk : styles.toastBad) }}>
        <div style={{ fontWeight: 900 }}>{toast.title}</div>
        {toast.msg ? <div style={{ marginTop: 4, opacity: 0.9 }}>{toast.msg}</div> : null}
      </div>
    </div>
  );
}

/* ---------------------------
   Root Shell
--------------------------- */
export default function StudioShell() {
  const [tab, setTab] = useState("Settings");

  const [lang, setLang] = useState("id"); // id | en
  const [theme, setTheme] = useState("dark"); // dark | light

  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" });
  const [blueprint, setBlueprint] = useState(null);

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [toast, setToast] = useState(null);

  const [statusMin, setStatusMin] = useState(false);

  // loading timers
  const genStartRef = useRef(0);
  const tickRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!loadingPlan) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    genStartRef.current = Date.now();
    setElapsedMs(0);
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - genStartRef.current);
    }, 250);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [loadingPlan]);

  const ctx = {
    tab,
    setTab,
    lang,
    setLang,
    theme,
    setTheme,

    projectDraft,
    setProjectDraft,
    blueprint,
    setBlueprint,

    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,

    toast,
    setToast,

    statusMin,
    setStatusMin,

    elapsedMs
  };

  const content = useMemo(() => {
    if (tab === "Settings") return <SettingsTab />;
    if (tab === "Scenes") return <ScenesTab />;
    return <ExportTab />;
  }, [tab]);

  return (
    <StudioContext.Provider value={ctx}>
      <div style={styles.page}>
        <TopBar />
        <div style={styles.content}>{content}</div>

        <StatusBar />

        <div style={styles.tabBar}>
          <div style={styles.tabBarInner}>
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{ ...styles.tabBtn, ...(tab === t ? styles.tabBtnActive : {}) }}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>
          <div style={styles.credit}>Created by @adryndian</div>
        </div>

        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </StudioContext.Provider>
  );
}

/* ---------------------------
   TopBar
--------------------------- */
function TopBar() {
  const { lang, setLang, theme, setTheme } = useStudio();
  return (
    <div style={styles.topBar}>
      <div style={styles.topBarInner}>
        <div style={styles.title}>Studio</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={styles.pill}>
            <span style={{ opacity: 0.7, fontWeight: 800 }}>{lang === "id" ? "Bahasa" : "Language"}</span>
            <button
              type="button"
              onClick={() => setLang("id")}
              style={{ ...styles.pillBtn, ...(lang === "id" ? styles.pillBtnActive : {}) }}
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              style={{ ...styles.pillBtn, ...(lang === "en" ? styles.pillBtnActive : {}) }}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={styles.ghostBtn}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------
   Tabs
--------------------------- */
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
    setToast
  } = useStudio();

  const [p, setP] = useState(projectDraft);

  const totalDuration = Number(p.scene_count || 0) * Number(p.seconds_per_scene || 0);

  // ✅ assets optional now
  const canGenerate =
    (p.brand || "").trim() &&
    (p.product_type || "").trim() &&
    (p.material || "").trim() &&
    (p.platform || "").trim() &&
    (p.aspect_ratio || "").trim() &&
    Number(p.scene_count || 0) > 0 &&
    Number(p.seconds_per_scene || 0) > 0;

  function t(id, en) {
    return lang === "id" ? id : en;
  }

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  async function generatePlan() {
    if (!canGenerate || loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);

    const provider = (p.ai_brain || "bedrock").toLowerCase();
    const ctrl = new AbortController();
    const timeoutMs = 120000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      setProjectDraft(p);

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

      setBlueprint(json.blueprint);
      setToast({ type: "ok", title: t("Generate sukses ✓", "Generate success ✓"), msg: t("Blueprint tersimpan.", "Blueprint saved.") });
      setTab("Scenes");
    } catch (e) {
      if (e?.name === "AbortError") {
        setPlanError(t("Timeout. Server terlalu lama merespons.", "Timeout. Server took too long."));
      } else {
        setPlanError(e?.message || String(e));
      }
      setToast({ type: "bad", title: t("Generate gagal", "Generate failed"), msg: e?.message || String(e) });
    } finally {
      clearTimeout(timer);
      setLoadingPlan(false);
    }
  }

  return (
    <div style={styles.card}>
      <CardTitle title={t("Settings", "Settings")} />

      <Section title={t("AI Brain", "AI Brain")}>
        <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
          <option value="bedrock">Bedrock</option>
          <option value="gemini">Gemini</option>
        </Select>
      </Section>

      <Section title={t("Core Inputs", "Core Inputs")}>
        <Field label={t("Brand *", "Brand *")}>
          <Input value={p.brand || ""} onChange={(e) => update("brand", e.target.value)} placeholder={t("Nama brand", "Brand name")} />
        </Field>
        <Field label={t("Product type *", "Product type *")}>
          <Input value={p.product_type || ""} onChange={(e) => update("product_type", e.target.value)} placeholder="sunscreen, hoodie, coffee" />
        </Field>
        <Field label={t("Material *", "Material *")}>
          <Input value={p.material || ""} onChange={(e) => update("material", e.target.value)} placeholder="cotton, serum gel, stainless" />
        </Field>
      </Section>

      <Section title={t("Format & Timing", "Format & Timing")}>
        <Field label={t("Platform", "Platform")}>
          <Select value={p.platform || "tiktok"} onChange={(e) => update("platform", e.target.value)}>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram Reels</option>
            <option value="facebook">Facebook Reels</option>
            <option value="youtube">YouTube Shorts</option>
          </Select>
        </Field>

        <Field label={t("Aspect ratio", "Aspect ratio")}>
          <Select value={p.aspect_ratio || "9:16"} onChange={(e) => update("aspect_ratio", e.target.value)}>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="16:9">16:9</option>
          </Select>
        </Field>

        <Field label={t("Scene count", "Scene count")}>
          <Select value={String(p.scene_count || 6)} onChange={(e) => update("scene_count", Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("Seconds per scene", "Seconds per scene")}>
          <Select value={String(p.seconds_per_scene || 8)} onChange={(e) => update("seconds_per_scene", Number(e.target.value))}>
            {[4, 6, 8, 10, 12].map((n) => (
              <option key={n} value={String(n)}>
                {n}s
              </option>
            ))}
          </Select>
        </Field>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          <Chip>{t("Estimasi durasi:", "Estimated duration:")} {totalDuration}s</Chip>
          <Chip>{t("Provider:", "Provider:")} {(p.ai_brain || "bedrock").toUpperCase()}</Chip>
        </div>
      </Section>

      <Section title={t("Assets (optional)", "Assets (optional)")}>
        <ImageUploadField
          label={t("Model reference", "Model reference")}
          kind="model"
          projectId={p.project_id || "local"}
          valueUrl={p.model_ref_url || ""}
          onUrl={(url) => update("model_ref_url", url)}
          hideUrl={true}
          showPreview={true}
          optional={true}
        />
        <div style={{ height: 10 }} />
        <ImageUploadField
          label={t("Product reference", "Product reference")}
          kind="product"
          projectId={p.project_id || "local"}
          valueUrl={p.product_ref_url || ""}
          onUrl={(url) => update("product_ref_url", url)}
          hideUrl={true}
          showPreview={true}
          optional={true}
        />
      </Section>

      {planError ? <div style={styles.errorBox}>{planError}</div> : null}

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={generatePlan}
          disabled={!canGenerate || loadingPlan}
          style={{
            ...styles.primaryBtn,
            opacity: canGenerate && !loadingPlan ? 1 : 0.55,
            cursor: canGenerate && !loadingPlan ? "pointer" : "not-allowed"
          }}
        >
          {loadingPlan ? t("Generating…", "Generating…") : t("Generate Plan", "Generate Plan")}
        </button>
      </div>
    </div>
  );
}

function ScenesTab() {
  const { lang, blueprint, setToast } = useStudio();
  function t(id, en) { return lang === "id" ? id : en; }

  const scenes = useMemo(() => extractScenes(blueprint), [blueprint]);

  return (
    <div style={styles.card}>
      <CardTitle title={t("Scenes", "Scenes")} />

      {!blueprint ? (
        <div style={styles.placeholder}>
          {t("Belum ada blueprint. Generate dulu di Settings.", "No blueprint yet. Generate in Settings first.")}
        </div>
      ) : (
        <>
          {scenes.length === 0 ? (
            <div style={styles.placeholder}>
              {t("Blueprint ada, tapi scenes tidak terbaca.", "Blueprint exists, but scenes not readable.")}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button type="button" style={styles.secondaryBtn} onClick={() => openJson(blueprint)}>
                  {t("Open JSON", "Open JSON")}
                </button>
                <button type="button" style={styles.secondaryBtn} onClick={() => downloadJson(blueprint)}>
                  {t("Download JSON", "Download JSON")}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {scenes.map((s, i) => {
                const id = s.id || s.scene_id || `S${i + 1}`;
                const goal = s.goal || s.title || s.hook || "SCENE";
                const time = s.time_window || s.time || s.duration || "";
                const action = s.action || s.visual || s.scene || "";
                const ost = s.on_screen_text || s.onscreen_text || s.ost || "";

                return (
                  <div key={id} style={styles.sceneCard}>
                    <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={styles.sceneBadge}>{id}</span>
                        <div style={{ fontWeight: 900 }}>{goal}</div>
                        {time ? <Chip>{time}</Chip> : null}
                      </div>
                      <Chip>Draft</Chip>
                    </div>

                    {action ? (
                      <div style={{ marginTop: 10 }}>
                        <div style={styles.miniLabel}>{t("Action", "Action")}</div>
                        <div style={styles.miniBox}>{String(action)}</div>
                      </div>
                    ) : null}

                    {ost ? (
                      <div style={{ marginTop: 10 }}>
                        <div style={styles.miniLabel}>{t("On-screen text", "On-screen text")}</div>
                        <div style={styles.miniBox}>{String(ost)}</div>
                      </div>
                    ) : null}

                    <div style={styles.stepperRow}>
                      <Step label="Plan" active />
                      <Step label="Image" />
                      <Step label="Approve" />
                      <Step label="Video" />
                      <Step label="Audio" />
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                      <button
                        type="button"
                        style={styles.secondaryBtn}
                        onClick={() => setToast({ type: "ok", title: t("Next", "Next"), msg: t("Step: Generate Image per scene", "Step: Generate Image per scene") })}
                      >
                        {t("Generate Image", "Generate Image")}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryBtn}
                        onClick={() => openJson(s)}
                      >
                        {t("Open Scene JSON", "Open Scene JSON")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExportTab() {
  const { lang, blueprint } = useStudio();
  function t(id, en) { return lang === "id" ? id : en; }

  return (
    <div style={styles.card}>
      <CardTitle title={t("Export", "Export")} />
      {!blueprint ? (
        <div style={styles.placeholder}>{t("Belum ada blueprint.", "No blueprint yet.")}</div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={styles.secondaryBtn} onClick={() => openJson(blueprint)}>
            {t("Open JSON", "Open JSON")}
          </button>
          <button type="button" style={styles.secondaryBtn} onClick={() => downloadJson(blueprint)}>
            {t("Download JSON", "Download JSON")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------
   Status Bar (minimizable)
--------------------------- */
function StatusBar() {
  const {
    lang,
    projectDraft,
    loadingPlan,
    planError,
    statusMin,
    setStatusMin,
    elapsedMs
  } = useStudio();

  function t(id, en) { return lang === "id" ? id : en; }

  const coreOk = !!(projectDraft.brand && projectDraft.product_type && projectDraft.material);
  const modelOk = !!(projectDraft.model_ref_url || ""); // optional, but show status
  const productOk = !!(projectDraft.product_ref_url || "");

  const totalDuration = Number(projectDraft.scene_count || 0) * Number(projectDraft.seconds_per_scene || 0);
  const provider = String(projectDraft.ai_brain || "bedrock").toUpperCase();

  // pseudo progress: based on elapsed vs expected duration (clamped)
  const expectedMs = clamp(totalDuration * 1000, 8000, 60000);
  const progress = loadingPlan ? clamp(elapsedMs / expectedMs, 0.05, 0.92) : (planError ? 1 : 0);

  return (
    <div style={{ ...styles.statusWrap, ...(statusMin ? styles.statusWrapMin : {}) }}>
      <div style={styles.statusCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>{t("Status", "Status")}</div>
          <button type="button" style={styles.ghostBtn} onClick={() => setStatusMin(!statusMin)}>
            {statusMin ? t("Expand", "Expand") : t("Minimize", "Minimize")}
          </button>
        </div>

        {statusMin ? null : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <Chip tone={coreOk ? "ok" : "bad"}>{coreOk ? "Core ✓" : "Core ✗"}</Chip>
              <Chip tone={modelOk ? "ok" : "neutral"}>{modelOk ? "Model ✓" : "Model (opt)"}</Chip>
              <Chip tone={productOk ? "ok" : "neutral"}>{productOk ? "Product ✓" : "Product (opt)"}</Chip>
              <Chip>{`≈ ${totalDuration || 0}s`}</Chip>
              <Chip>{`${t("Provider", "Provider")}: ${provider}`}</Chip>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8, marginBottom: 8 }}>
                {loadingPlan ? t("Generating…", "Generating…") : t("Idle", "Idle")}
              </div>

              <div style={styles.progressTrack}>
                {loadingPlan ? (
                  <div style={{ ...styles.progressBar, width: `${progress * 100}%` }}>
                    <div style={styles.progressSheen} />
                  </div>
                ) : (
                  <div style={{ ...styles.progressBar, width: planError ? "100%" : "0%" }} />
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                <div>{t("Elapsed", "Elapsed")}: {msToClock(elapsedMs)}</div>
                {loadingPlan ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={styles.spinner} />
                    <span>{t("Loading", "Loading")}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {planError ? <div style={styles.errorBox}>{planError}</div> : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------
   UI Atoms
--------------------------- */
function CardTitle({ title }) {
  return (
    <div style={styles.cardHeader}>
      <div style={styles.cardTitle}>{title}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{children}</div>
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
      ? { borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.14)", color: "var(--fg)" }
      : tone === "bad"
      ? { borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.14)", color: "var(--fg)" }
      : { borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.06)", color: "var(--fg)" };

  return <span style={{ ...styles.chip, ...toneStyle }}>{children}</span>;
}

function Step({ label, active }) {
  return <div style={{ ...styles.step, ...(active ? styles.stepActive : {}) }}>{label}</div>;
}

/* ---------------------------
   Styles (black-white-orange)
--------------------------- */
const styles = {
  page: {
    minHeight: "100vh",
    paddingBottom: 120,
    background: "radial-gradient(1200px 900px at 20% 10%, rgba(249,115,22,0.28), transparent 55%), radial-gradient(900px 700px at 80% 30%, rgba(249,115,22,0.18), transparent 50%), var(--bg)",
    color: "var(--fg)"
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 30,
    backdropFilter: "blur(14px)",
    background: "rgba(0,0,0,0.35)",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },
  topBarInner: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "14px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: { fontWeight: 950, fontSize: 18 },
  content: { maxWidth: 720, margin: "0 auto", padding: 14 },

  card: {
    borderRadius: 18,
    padding: 14,
    background: "var(--card)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)"
  },
  cardHeader: { paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 },
  cardTitle: { fontWeight: 950, fontSize: 16 },

  sectionTitle: { fontWeight: 900, fontSize: 13, opacity: 0.9 },
  label: { fontSize: 12, fontWeight: 850, opacity: 0.85, marginBottom: 6 },

  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "var(--fg)",
    outline: "none",
    fontWeight: 700
  },
  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "var(--fg)",
    outline: "none",
    fontWeight: 800
  },

  primaryBtn: {
    width: "100%",
    padding: "14px 14px",
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(180deg, rgba(249,115,22,1), rgba(234,88,12,1))",
    color: "#0b0b0b",
    fontWeight: 950
  },
  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "var(--fg)",
    fontWeight: 900
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    color: "var(--fg)",
    fontWeight: 900
  },

  pill: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: 8,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)"
  },
  pillBtn: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "none",
    background: "transparent",
    color: "var(--fg)",
    fontWeight: 950,
    cursor: "pointer"
  },
  pillBtnActive: {
    background: "rgba(255,255,255,0.12)"
  },

  placeholder: {
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.05)",
    opacity: 0.92
  },

  sceneCard: {
    borderRadius: 18,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.32)"
  },
  sceneBadge: {
    fontWeight: 950,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(249,115,22,0.18)",
    border: "1px solid rgba(249,115,22,0.22)"
  },
  miniLabel: { fontSize: 12, fontWeight: 900, opacity: 0.85, marginBottom: 6 },
  miniBox: {
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontWeight: 650,
    fontSize: 13,
    whiteSpace: "pre-wrap"
  },
  stepperRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  step: {
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)"
  },
  stepActive: {
    borderColor: "rgba(249,115,22,0.30)",
    background: "rgba(249,115,22,0.18)"
  },

  chip: {
    fontSize: 12,
    fontWeight: 950,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)"
  },

  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(239,68,68,0.14)",
    border: "1px solid rgba(239,68,68,0.22)",
    color: "var(--fg)",
    fontWeight: 900
  },

  statusWrap: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 86,
    zIndex: 40,
    padding: 12,
    pointerEvents: "none"
  },
  statusWrapMin: { bottom: 86 },
  statusCard: {
    pointerEvents: "auto",
    maxWidth: 720,
    margin: "0 auto",
    borderRadius: 18,
    padding: 12,
    // ✅ less transparent, more readable
    background: "rgba(0,0,0,0.72)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.50)"
  },

  progressTrack: {
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.10)"
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(249,115,22,1), rgba(255,255,255,0.22))",
    position: "relative"
  },
  progressSheen: {
    position: "absolute",
    inset: 0,
    background: "rgba(255,255,255,0.12)",
    transform: "translateX(-120%)",
    animation: "ugc_progress 1.2s linear infinite"
  },

  spinner: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.20)",
    borderTopColor: "rgba(249,115,22,1)",
    display: "inline-block",
    animation: "ugc_spin 0.9s linear infinite"
  },

  tabBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 35,
    padding: 12,
    paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(14px)",
    borderTop: "1px solid rgba(255,255,255,0.10)"
  },
  tabBarInner: {
    maxWidth: 520,
    margin: "0 auto",
    display: "flex",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)"
  },
  tabBtn: {
    flex: 1,
    border: "none",
    borderRadius: 14,
    padding: "12px 10px",
    fontWeight: 950,
    cursor: "pointer",
    background: "transparent",
    color: "var(--fg)"
  },
  tabBtnActive: {
    background: "rgba(255,255,255,0.12)"
  },
  credit: {
    maxWidth: 520,
    margin: "10px auto 0",
    textAlign: "center",
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 800
  },

  toastWrap: {
    position: "fixed",
    left: 0,
    right: 0,
    top: 70,
    zIndex: 50,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none"
  },
  toast: {
    pointerEvents: "auto",
    maxWidth: 560,
    width: "calc(100% - 24px)",
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.80)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.55)"
  },
  toastOk: { borderColor: "rgba(34,197,94,0.35)" },
  toastBad: { borderColor: "rgba(239,68,68,0.35)" }
};

/* Theme tokens */
if (typeof document !== "undefined") {
  const root = document.documentElement;
  // defaults (dark)
  if (!root.style.getPropertyValue("--bg")) {
    root.style.setProperty("--bg", "#070708");
    root.style.setProperty("--fg", "rgba(255,255,255,0.92)");
    root.style.setProperty("--card", "rgba(0,0,0,0.46)");
  }
  // update on dataset change
  const obs = new MutationObserver(() => {
    const theme = root.dataset.theme || "dark";
    if (theme === "light") {
      root.style.setProperty("--bg", "#ffffff");
      root.style.setProperty("--fg", "#0b0b0b");
      root.style.setProperty("--card", "rgba(255,255,255,0.76)");
    } else {
      root.style.setProperty("--bg", "#070708");
      root.style.setProperty("--fg", "rgba(255,255,255,0.92)");
      root.style.setProperty("--card", "rgba(0,0,0,0.46)");
    }
  });
  obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
}
