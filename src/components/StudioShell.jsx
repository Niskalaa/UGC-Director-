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
function msToClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function openJson(obj) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(
      JSON.stringify(obj, null, 2)
    )}</pre>`
  );
  w.document.close();
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

/**
 * ✅ SCENE EXTRACTOR FIX
 * Support blueprint forms:
 * - { ugc_blueprint_v1: { creative_specs: { scenes: [...] }, voiceover_specs: { scenes: [...] } } }
 * - legacy: { scene_plans: [...] }
 * - legacy storyboard: { storyboard: { beats: [...] } }
 */
function extractScenes(blueprint) {
  if (!blueprint) return [];

  const root = blueprint.blueprint ? blueprint.blueprint : blueprint;

  // 1) UGC Blueprint V1 (your current JSON)
  const v1 = root?.ugc_blueprint_v1;
  const v1Scenes = v1?.creative_specs?.scenes;
  const v1VoScenes = v1?.voiceover_specs?.scenes;

  if (Array.isArray(v1Scenes)) {
    // merge VO by scene_id
    const voMap = new Map();
    if (Array.isArray(v1VoScenes)) {
      for (const vs of v1VoScenes) {
        const sid = vs?.scene_id;
        if (sid) voMap.set(String(sid), vs);
      }
    }

    return v1Scenes.map((s, idx) => {
      const sid = String(s?.scene_id ?? `S${idx + 1}`);
      const vo = voMap.get(sid);

      // normalize to UI-friendly fields
      return {
        id: sid,
        title: s?.title || s?.goal || `Scene ${idx + 1}`,
        time_window: s?.time_window || s?.duration_seconds ? `${s.duration_seconds}s` : "",
        action:
          s?.visuals?.primary_action ||
          s?.visuals?.camera ||
          s?.visuals?.environment ||
          s?.scene_prompt ||
          "",
        on_screen_text:
          vo?.on_screen_text?.primary ||
          (Array.isArray(vo?.on_screen_text?.alt) ? vo.on_screen_text.alt[0] : "") ||
          "",
        voiceover:
          vo?.voiceover_text?.primary ||
          (Array.isArray(vo?.voiceover_text?.alt) ? vo.voiceover_text.alt[0] : "") ||
          "",
        raw: { creative: s, vo }
      };
    });
  }

  // 2) legacy
  if (Array.isArray(root?.scene_plans)) return root.scene_plans;

  // 3) storyboard fallback
  const beats =
    root?.storyboard?.beats ||
    root?.SEGMENT_3?.storyboard?.beats ||
    root?.segments?.storyboard?.beats ||
    root?.storyboard?.scenes ||
    [];

  return Array.isArray(beats) ? beats : [];
}

/* ---------------------------
   Toast
--------------------------- */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onClose?.(), 2400);
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
   Root
--------------------------- */
export default function StudioShell() {
  const [tab, setTab] = useState("Scenes");
  const [lang, setLang] = useState("id"); // id | en
  const [theme, setTheme] = useState("dark"); // dark | light

  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" });
  const [blueprint, setBlueprint] = useState(null);

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [toast, setToast] = useState(null);

  const [statusMin, setStatusMin] = useState(true);

  const genStartRef = useRef(0);
  const tickRef = useRef(null);
  const abortRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // apply theme via dataset + CSS vars in global.css
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // elapsed timer when generating
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

    elapsedMs,

    abortRef
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
        <BottomTabs />

        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </StudioContext.Provider>
  );
}

/* ---------------------------
   UI pieces
--------------------------- */
function TopBar() {
  const { lang, setLang, theme, setTheme } = useStudio();
  const t = (id, en) => (lang === "id" ? id : en);

  return (
    <div style={styles.topBar}>
      <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>{t("Studio", "Studio")}</div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={styles.pill}>
          <span style={styles.pillLabel}>{t("Bahasa", "Lang")}</span>
          <button
            type="button"
            style={{ ...styles.pillBtn, ...(lang === "id" ? styles.pillBtnActive : null) }}
            onClick={() => setLang("id")}
          >
            ID
          </button>
          <button
            type="button"
            style={{ ...styles.pillBtn, ...(lang === "en" ? styles.pillBtnActive : null) }}
            onClick={() => setLang("en")}
          >
            EN
          </button>
        </div>

        <button type="button" style={styles.ghostBtn} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? t("Light", "Light") : t("Dark", "Dark")}
        </button>
      </div>
    </div>
  );
}

function BottomTabs() {
  const { tab, setTab, lang } = useStudio();
  const t = (id, en) => (lang === "id" ? id : en);

  return (
    <div style={styles.bottomTabs}>
      {TABS.map((x) => (
        <button
          key={x}
          type="button"
          onClick={() => setTab(x)}
          style={{ ...styles.tabBtn, ...(tab === x ? styles.tabBtnActive : null) }}
        >
          {t(x, x)}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------
   Tabs
--------------------------- */
function SettingsTab() {
  const { lang, projectDraft, setProjectDraft, setToast } = useStudio();
  const t = (id, en) => (lang === "id" ? id : en);

  const p = projectDraft;

  const update = (k, v) => setProjectDraft((s) => ({ ...s, [k]: v }));

  return (
    <div style={styles.card}>
      <CardTitle title={t("Settings", "Settings")} />

      <div style={styles.grid1}>
        <Field label={t("AI Brain", "AI Brain")}>
          <Select value={String(p.ai_brain || "bedrock")} onChange={(e) => update("ai_brain", e.target.value)}>
            <option value="bedrock">Bedrock</option>
            <option value="gemini">Gemini</option>
          </Select>
        </Field>

        <Field label={t("Platform", "Platform")}>
          <Select value={String(p.platform || "tiktok")} onChange={(e) => update("platform", e.target.value)}>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="youtube_shorts">YouTube Shorts</option>
          </Select>
        </Field>

        <Field label={t("Aspect ratio", "Aspect ratio")}>
          <Select value={String(p.aspect_ratio || "9:16")} onChange={(e) => update("aspect_ratio", e.target.value)}>
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

        <Field label={t("Seconds / scene", "Seconds / scene")}>
          <Select
            value={String(p.seconds_per_scene || 8)}
            onChange={(e) => update("seconds_per_scene", Number(e.target.value))}
          >
            {[4, 6, 8, 10, 12].map((n) => (
              <option key={n} value={String(n)}>
                {n}s
              </option>
            ))}
          </Select>
        </Field>

        <div style={{ marginTop: 4 }}>
          <div style={styles.sectionTitle}>{t("Assets", "Assets")}</div>
          <div style={styles.miniText}>{t("Upload model + product reference.", "Upload model + product reference.")}</div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <ImageUploadField
              label={t("Model reference", "Model reference")}
              value={p.model_ref_url || ""}
              onChange={(url) => update("model_ref_url", url)}
            />
            <ImageUploadField
              label={t("Product reference", "Product reference")}
              value={p.product_ref_url || ""}
              onChange={(url) => update("product_ref_url", url)}
            />
          </div>

          <button
            type="button"
            style={{ ...styles.secondaryBtn, marginTop: 10 }}
            onClick={() => setToast({ type: "ok", title: t("Saved", "Saved"), msg: t("Settings updated.", "Settings updated.") })}
          >
            {t("Done", "Done")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScenesTab() {
  const { lang, blueprint, setBlueprint, setToast } = useStudio();
  const t = (id, en) => (lang === "id" ? id : en);

  const scenes = useMemo(() => extractScenes(blueprint), [blueprint]);

  async function onUploadJsonFile(file) {
    const txt = await file.text();
    const parsed = JSON.parse(txt);
    setBlueprint(parsed);
    setToast({ type: "ok", title: t("Loaded", "Loaded"), msg: t("Blueprint JSON loaded.", "Blueprint JSON loaded.") });
  }

  return (
    <div style={styles.card}>
      <CardTitle title={t("Scenes", "Scenes")} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={styles.fileBtn}>
          {t("Upload JSON", "Upload JSON")}
          <input
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              onUploadJsonFile(f).catch((err) =>
                setToast({ type: "bad", title: t("Invalid JSON", "Invalid JSON"), msg: String(err?.message || err) })
              );
            }}
          />
        </label>

        {blueprint ? (
          <>
            <button type="button" style={styles.secondaryBtn} onClick={() => openJson(blueprint)}>
              {t("Open JSON", "Open JSON")}
            </button>
            <button type="button" style={styles.secondaryBtn} onClick={() => downloadJson(blueprint)}>
              {t("Download JSON", "Download JSON")}
            </button>
          </>
        ) : null}
      </div>

      {!blueprint ? (
        <div style={{ marginTop: 12, ...styles.placeholder }}>
          {t("Belum ada blueprint. Generate dulu atau upload JSON.", "No blueprint yet. Generate or upload JSON.")}
        </div>
      ) : scenes.length === 0 ? (
        <div style={{ marginTop: 12, ...styles.placeholder }}>
          {t(
            "Blueprint ada, tapi scenes tidak ditemukan (schema mismatch).",
            "Blueprint exists, but scenes not found (schema mismatch)."
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {scenes.map((s, i) => (
            <div key={s.id || i} style={styles.sceneCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={styles.sceneBadge}>{s.id || `S${i + 1}`}</span>
                  <div style={{ fontWeight: 900 }}>{s.title || `Scene ${i + 1}`}</div>
                  {s.time_window ? <Chip>{s.time_window}</Chip> : null}
                </div>
                <Chip>Draft</Chip>
              </div>

              {s.action ? (
                <div style={{ marginTop: 8 }}>
                  <div style={styles.miniLabel}>{t("Action / Visual", "Action / Visual")}</div>
                  <div style={styles.miniBox}>{String(s.action)}</div>
                </div>
              ) : null}

              {s.on_screen_text ? (
                <div style={{ marginTop: 8 }}>
                  <div style={styles.miniLabel}>{t("On-screen", "On-screen")}</div>
                  <div style={styles.miniBox}>{String(s.on_screen_text)}</div>
                </div>
              ) : null}

              {s.voiceover ? (
                <div style={{ marginTop: 8 }}>
                  <div style={styles.miniLabel}>{t("Voiceover", "Voiceover")}</div>
                  <div style={styles.miniBox}>{String(s.voiceover)}</div>
                </div>
              ) : null}

              <div style={styles.stepperRow}>
                <Step label="Plan" active />
                <Step label="Image" />
                <Step label="Approve" />
                <Step label="Video" />
                <Step label="Audio" />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() =>
                    setToast({
                      type: "ok",
                      title: t("Next step", "Next step"),
                      msg: t("Lanjut: Generate Image per scene.", "Next: Generate Image per scene.")
                    })
                  }
                >
                  {t("Generate Image", "Generate Image")}
                </button>
                <button type="button" style={styles.secondaryBtn} onClick={() => openJson(s.raw || s)}>
                  {t("Open Scene JSON", "Open Scene JSON")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportTab() {
  const { lang, blueprint } = useStudio();
  const t = (id, en) => (lang === "id" ? id : en);

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
   Status Bar (minimizable + generating)
--------------------------- */
function StatusBar() {
  const {
    lang,
    projectDraft,
    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,
    setBlueprint,
    setToast,
    statusMin,
    setStatusMin,
    elapsedMs,
    abortRef
  } = useStudio();

  const t = (id, en) => (lang === "id" ? id : en);

  const coreOk = !!(projectDraft.brand && projectDraft.product_type && projectDraft.material);
  const modelOk = !!projectDraft.model_ref_url;
  const productOk = !!projectDraft.product_ref_url;

  const totalDuration = Number(projectDraft.scene_count || 0) * Number(projectDraft.seconds_per_scene || 0);
  const provider = String(projectDraft.ai_brain || "bedrock").toUpperCase();

  const readiness = coreOk && modelOk && productOk;

  async function generatePlan() {
    if (!readiness || loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: String(projectDraft.ai_brain || "bedrock"),
          project: projectDraft
        }),
        signal: ac.signal
      });

      const txt = await r.text();
      let data;
      try {
        data = JSON.parse(txt);
      } catch {
        throw new Error(`Non-JSON response (${r.status}). Preview: ${txt.slice(0, 120)}`);
      }

      if (!r.ok || !data?.ok) {
        throw new Error(String(data?.error || `HTTP ${r.status}`));
      }

      setBlueprint(data.blueprint);
      setToast({
        type: "ok",
        title: t("Generate success", "Generate success"),
        msg: t("Blueprint berhasil dibuat. Buka tab Scenes.", "Blueprint created. Open Scenes tab.")
      });

      // auto-minimize status after success (feel less crowded)
      setStatusMin(true);
    } catch (err) {
      const msg = String(err?.message || err);
      setPlanError(msg);
      setToast({ type: "bad", title: t("Generate failed", "Generate failed"), msg });
    } finally {
      setLoadingPlan(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    try {
      abortRef.current?.abort?.();
    } catch {}
    setLoadingPlan(false);
    setToast({ type: "bad", title: t("Cancelled", "Cancelled"), msg: t("Request dibatalkan.", "Request cancelled.") });
  }

  const progress = loadingPlan ? Math.min(0.9, elapsedMs / Math.max(1, totalDuration * 1000)) : 0;

  return (
    <div style={styles.statusWrap}>
      <div style={styles.statusCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>{t("Status", "Status")}</div>
          <button type="button" style={styles.ghostBtnSmall} onClick={() => setStatusMin((s) => !s)}>
            {statusMin ? t("Show", "Show") : t("Minimize", "Minimize")}
          </button>
        </div>

        {statusMin ? null : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <Pill ok={coreOk}>{t("Core", "Core")}</Pill>
              <Pill ok={modelOk}>{t("Model", "Model")}</Pill>
              <Pill ok={productOk}>{t("Product", "Product")}</Pill>
              <Chip>{totalDuration ? `≈ ${totalDuration}s` : "—"}</Chip>
              <Chip>{t("Provider", "Provider")}: {provider}</Chip>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressBar, width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <div style={styles.miniText}>
                  {loadingPlan ? `${t("Elapsed", "Elapsed")}: ${msToClock(elapsedMs)}` : " "}
                </div>
                {loadingPlan ? (
                  <button type="button" style={styles.secondaryBtnSmall} onClick={cancel}>
                    {t("Cancel", "Cancel")}
                  </button>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...styles.primaryBtn, ...(readiness ? null : styles.btnDisabled) }}
                onClick={generatePlan}
                disabled={!readiness || loadingPlan}
              >
                {loadingPlan ? (
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <span style={styles.spinner} />
                    {t("Generating…", "Generating…")}
                  </span>
                ) : (
                  t("Generate Plan", "Generate Plan")
                )}
              </button>

              {!readiness ? (
                <div style={styles.warnText}>
                  {t("Lengkapi Core + upload model & product.", "Complete Core + upload model & product.")}
                </div>
              ) : null}
            </div>

            {planError ? (
              <div style={styles.errorBox}>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>{t("Error", "Error")}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{planError}</div>
                <button
                  type="button"
                  style={{ ...styles.secondaryBtnSmall, marginTop: 8 }}
                  onClick={() => setPlanError("")}
                >
                  {t("Clear", "Clear")}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------
   Small components
--------------------------- */
function CardTitle({ title }) {
  return <div style={styles.cardTitle}>{title}</div>;
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <div style={styles.label}>{label}</div>
      {children}
    </div>
  );
}

function Select(props) {
  return <select {...props} style={{ ...styles.select, ...(props.style || null) }} />;
}

function Chip({ children }) {
  return <span style={styles.chip}>{children}</span>;
}

function Pill({ ok, children }) {
  return <span style={{ ...styles.pillStatus, ...(ok ? styles.pillOk : styles.pillBad) }}>{children}</span>;
}

function Step({ label, active }) {
  return (
    <div style={{ ...styles.step, ...(active ? styles.stepActive : null) }}>
      {label}
    </div>
  );
}

/* ---------------------------
   Styles
   - reduced ~35% spacing + font sizes
   - consistent via CSS vars
--------------------------- */
const styles = {
  page: {
    minHeight: "100dvh",
    padding: 10, // reduced
    paddingBottom: 76,
    color: "var(--fg)",
    background: "var(--bg)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 14,
    background: "var(--topbar)",
    border: "1px solid var(--border)",
    backdropFilter: "blur(10px)"
  },
  content: { marginTop: 10 },

  card: {
    borderRadius: 16,
    padding: 12,
    background: "var(--card)",
    border: "1px solid var(--border)",
    boxShadow: "0 10px 30px rgba(0,0,0,.18)"
  },
  cardTitle: { fontWeight: 900, fontSize: 16, marginBottom: 10 },

  grid1: { display: "grid", gap: 10 },

  field: { display: "grid", gap: 6 },
  label: { fontSize: 12, opacity: 0.9, fontWeight: 800 },

  select: {
    width: "100%",
    borderRadius: 12,
    padding: "10px 10px",
    background: "var(--input)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    outline: "none"
  },

  sectionTitle: { fontWeight: 900, marginTop: 6 },
  miniText: { fontSize: 12, opacity: 0.75 },

  placeholder: {
    padding: 12,
    borderRadius: 14,
    border: "1px dashed var(--border)",
    background: "var(--card2)",
    opacity: 0.95
  },

  sceneCard: {
    borderRadius: 16,
    padding: 12,
    background: "var(--card2)",
    border: "1px solid var(--border)"
  },
  sceneBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(255,135,25,.14)",
    border: "1px solid rgba(255,135,25,.35)",
    fontWeight: 900,
    fontSize: 12
  },
  miniLabel: { fontSize: 12, fontWeight: 900, opacity: 0.85, marginBottom: 4 },
  miniBox: {
    padding: 10,
    borderRadius: 12,
    background: "var(--input)",
    border: "1px solid var(--border)",
    fontSize: 13,
    lineHeight: 1.35
  },

  stepperRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 },
  step: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "transparent",
    fontSize: 12,
    opacity: 0.75
  },
  stepActive: { background: "rgba(255,135,25,.16)", borderColor: "rgba(255,135,25,.35)", opacity: 1 },

  chip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.04)",
    fontSize: 12
  },

  pill: {
    display: "inline-flex",
    gap: 6,
    padding: "6px 8px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.04)",
    alignItems: "center"
  },
  pillLabel: { fontSize: 12, opacity: 0.75, fontWeight: 800, marginRight: 2 },
  pillBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--fg)",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer"
  },
  pillBtnActive: {
    background: "rgba(255,135,25,.18)",
    borderColor: "rgba(255,135,25,.35)"
  },

  ghostBtn: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.04)",
    color: "var(--fg)",
    fontWeight: 900,
    cursor: "pointer"
  },
  ghostBtnSmall: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.04)",
    color: "var(--fg)",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12
  },

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,135,25,.55)",
    background: "rgba(255,135,25,.90)",
    color: "#111",
    fontWeight: 1000,
    cursor: "pointer",
    minWidth: 180
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed"
  },

  secondaryBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.06)",
    color: "var(--fg)",
    fontWeight: 900,
    cursor: "pointer"
  },
  secondaryBtnSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.06)",
    color: "var(--fg)",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12
  },

  fileBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.06)",
    color: "var(--fg)",
    fontWeight: 900,
    cursor: "pointer"
  },

  warnText: { fontSize: 12, opacity: 0.75, alignSelf: "center" },

  statusWrap: {
    position: "fixed",
    left: 10,
    right: 10,
    bottom: 62,
    zIndex: 30,
    pointerEvents: "none"
  },
  statusCard: {
    pointerEvents: "auto",
    borderRadius: 18,
    padding: 12,
    background: "var(--statusCard)", // less transparent (fix)
    border: "1px solid var(--border)",
    boxShadow: "0 18px 50px rgba(0,0,0,.30)",
    backdropFilter: "blur(12px)"
  },

  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,.10)",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.10)"
  },
  progressBar: {
    height: "100%",
    background: "rgba(255,135,25,.95)",
    borderRadius: 999,
    transition: "width 180ms linear"
  },

  spinner: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "2px solid rgba(0,0,0,.25)",
    borderTopColor: "rgba(0,0,0,.85)",
    display: "inline-block",
    animation: "spin 800ms linear infinite" // ✅ guarantees it spins if keyframes exist
  },

  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,80,80,.35)",
    background: "rgba(255,80,80,.10)",
    color: "var(--fg)",
    fontSize: 12
  },

  pillStatus: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid transparent"
  },
  pillOk: {
    background: "rgba(40,190,120,.18)",
    borderColor: "rgba(40,190,120,.35)"
  },
  pillBad: {
    background: "rgba(255,80,80,.14)",
    borderColor: "rgba(255,80,80,.30)"
  },

  bottomTabs: {
    position: "fixed",
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 40,
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    padding: 8,
    borderRadius: 18,
    background: "var(--bottomTabs)",
    border: "1px solid var(--border)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 18px 50px rgba(0,0,0,.28)"
  },
  tabBtn: {
    padding: "10px 10px",
    borderRadius: 14,
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--fg)",
    fontWeight: 1000,
    cursor: "pointer"
  },
  tabBtnActive: {
    background: "rgba(255,135,25,.16)",
    borderColor: "rgba(255,135,25,.35)"
  },

  toastWrap: {
    position: "fixed",
    left: 10,
    right: 10,
    top: 10,
    zIndex: 60,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none"
  },
  toast: {
    width: "min(520px, calc(100vw - 20px))",
    borderRadius: 16,
    padding: 12,
    border: "1px solid var(--border)",
    background: "var(--statusCard)",
    color: "var(--fg)",
    boxShadow: "0 18px 50px rgba(0,0,0,.32)"
  },
  toastOk: { borderColor: "rgba(40,190,120,.40)" },
  toastBad: { borderColor: "rgba(255,80,80,.40)" }
};
