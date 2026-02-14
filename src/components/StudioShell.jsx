// src/components/StudioShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Settings", "Scenes", "Export"];

/* =========================
   i18n (simple)
   ========================= */
const COPY = {
  id: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Bahasa",
    dark: "Dark",
    light: "Light",
    aiBrain: "AI Brain",
    bedrock: "Bedrock",
    gemini: "Gemini",
    coreInputs: "Core Inputs",
    brand: "Brand",
    productType: "Product type",
    material: "Material",
    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds/scene",
    assets: "Assets (optional)",
    modelRef: "Model reference",
    productRef: "Product reference",
    linkAutofill: "Auto-fill from Link (optional)",
    productUrl: "Product / Landing page URL",
    runAutofill: "Auto-fill",
    generating: "Generating…",
    cancel: "Cancel",
    generatePlan: "Generate Plan",
    status: "Status",
    readiness: "Readiness",
    provider: "Provider",
    elapsed: "Elapsed",
    collapse: "Minimize",
    expand: "Show status",
    success: "Generate success ✓",
    failed: "Generate failed",
    noBlueprint: "No blueprint yet. Generate in Settings.",
    beatsMissing: "Blueprint exists, but beats not readable.",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    copied: "Copied ✓",
    createdBy: "Created by",
    requiredMissing: "Fill required fields first.",
    coreOk: "Core",
    modelOk: "Model",
    productOk: "Product",
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
    bedrock: "Bedrock",
    gemini: "Gemini",
    coreInputs: "Core Inputs",
    brand: "Brand",
    productType: "Product type",
    material: "Material",
    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds/scene",
    assets: "Assets (optional)",
    modelRef: "Model reference",
    productRef: "Product reference",
    linkAutofill: "Auto-fill from Link (optional)",
    productUrl: "Product / Landing page URL",
    runAutofill: "Auto-fill",
    generating: "Generating…",
    cancel: "Cancel",
    generatePlan: "Generate Plan",
    status: "Status",
    readiness: "Readiness",
    provider: "Provider",
    elapsed: "Elapsed",
    collapse: "Minimize",
    expand: "Show status",
    success: "Generate success ✓",
    failed: "Generate failed",
    noBlueprint: "No blueprint yet. Generate in Settings.",
    beatsMissing: "Blueprint exists, but beats not readable.",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    copied: "Copied ✓",
    createdBy: "Created by",
    requiredMissing: "Fill required fields first.",
    coreOk: "Core",
    modelOk: "Model",
    productOk: "Product",
  }
};

/* =========================
   Blueprint normalization
   ========================= */
function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}
function asArray(x) {
  return Array.isArray(x) ? x : [];
}

/**
 * Try HARD to find beats/scenes array from many possible shapes.
 * Returns { beats, path }.
 */
function extractBeats(blueprint) {
  if (!blueprint) return { beats: [], path: "" };

  // 1) canonical
  if (isObj(blueprint.storyboard) && Array.isArray(blueprint.storyboard.beats)) {
    return { beats: blueprint.storyboard.beats, path: "storyboard.beats" };
  }

  // 2) common variants
  const candidates = [
    blueprint?.beats,
    blueprint?.scenes,
    blueprint?.storyboard?.scenes,
    blueprint?.storyboard?.timeline,
    blueprint?.SEGMENT_3?.storyboard?.beats,
    blueprint?.SEGMENT_2?.storyboard?.beats,
    blueprint?.SEGMENT_1?.storyboard?.beats,
    blueprint?.segments?.storyboard?.beats,
    blueprint?.segments?.beats,
  ];

  for (let i = 0; i < candidates.length; i++) {
    if (Array.isArray(candidates[i]) && candidates[i].length) {
      return { beats: candidates[i], path: `candidate[${i}]` };
    }
  }

  // 3) segments as array
  const segArr = asArray(blueprint?.segments);
  for (let i = 0; i < segArr.length; i++) {
    const s = segArr[i];
    if (isObj(s?.storyboard) && Array.isArray(s.storyboard.beats) && s.storyboard.beats.length) {
      return { beats: s.storyboard.beats, path: `segments[${i}].storyboard.beats` };
    }
    if (Array.isArray(s?.beats) && s.beats.length) {
      return { beats: s.beats, path: `segments[${i}].beats` };
    }
    if (Array.isArray(s?.scenes) && s.scenes.length) {
      return { beats: s.scenes, path: `segments[${i}].scenes` };
    }
  }

  // 4) last resort: scan top-level keys for any object containing storyboard.beats
  for (const k of Object.keys(blueprint)) {
    const v = blueprint[k];
    if (isObj(v?.storyboard) && Array.isArray(v.storyboard.beats) && v.storyboard.beats.length) {
      return { beats: v.storyboard.beats, path: `${k}.storyboard.beats` };
    }
    if (isObj(v) && Array.isArray(v?.beats) && v.beats.length) {
      return { beats: v.beats, path: `${k}.beats` };
    }
  }

  return { beats: [], path: "" };
}

/* =========================
   Toast (no deps)
   ========================= */
function ToastHost({ toasts, onDismiss, theme }) {
  return (
    <div style={{ ...styles.toastHost, ...(theme === "dark" ? styles.toastHostDark : {}) }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            ...styles.toast,
            ...(theme === "dark" ? styles.toastDark : {}),
            ...(t.type === "success" ? styles.toastSuccess : {}),
            ...(t.type === "error" ? styles.toastError : {}),
          }}
        >
          <div style={{ fontWeight: 900 }}>{t.title}</div>
          {t.msg ? <div style={{ marginTop: 4, opacity: 0.85, fontSize: 12 }}>{t.msg}</div> : null}
          <button onClick={() => onDismiss(t.id)} style={styles.toastX} type="button">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  function push({ type, title, msg, ttl = 2600 }) {
    const id = Math.random().toString(16).slice(2);
    setToasts((p) => [...p, { id, type, title, msg }]);
    if (ttl > 0) setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), ttl);
  }
  function dismiss(id) {
    setToasts((p) => p.filter((x) => x.id !== id));
  }
  return { toasts, push, dismiss };
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
  const [lang, setLang] = useState("id"); // "id" | "en"
  const [theme, setTheme] = useState("dark"); // "dark" | "light"

  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" });
  const [blueprint, setBlueprint] = useState(null);

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [statusCollapsed, setStatusCollapsed] = useState(false);

  const startedAtRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef(null);

  const { toasts, push, dismiss } = useToasts();
  const t = COPY[lang];

  useEffect(() => {
    document.documentElement.style.background = theme === "dark" ? "#0b0b0f" : "#fff7ed";
  }, [theme]);

  // elapsed ticker while generating
  useEffect(() => {
    if (!loadingPlan) return;
    const i = setInterval(() => {
      const s = startedAtRef.current || Date.now();
      setElapsedMs(Date.now() - s);
    }, 200);
    return () => clearInterval(i);
  }, [loadingPlan]);

  const ctx = {
    tab, setTab,
    lang, setLang,
    theme, setTheme,
    projectDraft, setProjectDraft,
    blueprint, setBlueprint,
    loadingPlan, setLoadingPlan,
    planError, setPlanError,
    statusCollapsed, setStatusCollapsed,
    startedAtRef, elapsedMs, setElapsedMs,
    abortRef,
    toast: push,
  };

  const content = useMemo(() => {
    if (tab === "Settings") return <SettingsTab />;
    if (tab === "Scenes") return <ScenesTab />;
    return <ExportTab />;
  }, [tab]);

  return (
    <StudioContext.Provider value={ctx}>
      <div style={{ ...styles.page, ...(theme === "dark" ? styles.pageDark : styles.pageLight) }}>
        <TopBar />

        <div style={styles.content}>
          {content}
        </div>

        <StatusDock />

        <TabBar />

        <FooterCredit theme={theme} />

        <ToastHost toasts={toasts} onDismiss={dismiss} theme={theme} />
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   Top bar + controls
   ========================= */
function TopBar() {
  const { lang, setLang, theme, setTheme } = useStudio();
  const t = COPY[lang];

  return (
    <div style={{ ...styles.topBar, ...(theme === "dark" ? styles.topBarDark : styles.topBarLight) }}>
      <div style={styles.topBarInner}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ ...styles.title, ...(theme === "dark" ? styles.titleDark : styles.titleLight) }}>
            {t.studio}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ ...styles.pill, ...(theme === "dark" ? styles.pillDark : styles.pillLight) }}>
            <span style={{ opacity: 0.75, fontSize: 12, fontWeight: 800 }}>{t.language}</span>
            <div style={styles.pillBtns}>
              <button
                type="button"
                onClick={() => setLang("id")}
                style={{
                  ...styles.pillBtn,
                  ...(lang === "id" ? styles.pillBtnActive : {}),
                  ...(theme === "dark" ? styles.pillBtnDark : {}),
                }}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                style={{
                  ...styles.pillBtn,
                  ...(lang === "en" ? styles.pillBtnActive : {}),
                  ...(theme === "dark" ? styles.pillBtnDark : {}),
                }}
              >
                EN
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{
              ...styles.modeBtn,
              ...(theme === "dark" ? styles.modeBtnDark : styles.modeBtnLight),
            }}
          >
            {theme === "dark" ? t.light : t.dark}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Tabs
   ========================= */
function SettingsTab() {
  const {
    theme, lang,
    projectDraft, setProjectDraft,
    setBlueprint, setTab,
    loadingPlan, setLoadingPlan,
    planError, setPlanError,
    startedAtRef, setElapsedMs,
    abortRef,
    toast,
    setStatusCollapsed
  } = useStudio();
  const t = COPY[lang];

  const [p, setP] = useState(projectDraft);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkInfo, setLinkInfo] = useState("");

  useEffect(() => setP(projectDraft), [projectDraft]);

  const totalDuration = Number(p.scene_count || 0) * Number(p.seconds_per_scene || 0);

  const coreOk =
    (p.brand || "").trim() &&
    (p.product_type || "").trim() &&
    (p.material || "").trim() &&
    (p.platform || "").trim() &&
    (p.aspect_ratio || "").trim() &&
    Number(p.scene_count || 0) > 0 &&
    Number(p.seconds_per_scene || 0) > 0;

  const modelOk = (p.model_ref_url || "").trim().length > 0;
  const productOk = (p.product_ref_url || "").trim().length > 0;

  // assets optional: allow generate with just core, BUT backend kamu masih require model_ref_url & product_ref_url
  // jadi tombol generate tetap butuh keduanya, kecuali kamu ubah backend.
  const canGeneratePlan = coreOk && modelOk && productOk && !loadingPlan;

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  async function generatePlanOnce() {
    if (!canGeneratePlan) {
      toast({ type: "error", title: t.requiredMissing, msg: "" });
      return;
    }

    setPlanError("");
    setLoadingPlan(true);
    setStatusCollapsed(false);

    setProjectDraft(p);

    // reset timers
    startedAtRef.current = Date.now();
    setElapsedMs(0);

    const provider = (p.ai_brain || "bedrock").toLowerCase();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // timeout
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
      let json = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON response (${r.status}). Preview: ${String(raw).slice(0, 200)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Plan failed (${r.status})`);
      if (!json?.blueprint) throw new Error("Plan OK but blueprint is empty.");

      setBlueprint(json.blueprint);

      toast({ type: "success", title: t.success, msg: `${provider.toUpperCase()} • ${totalDuration}s`, ttl: 2400 });

      // go scenes
      setTab("Scenes");

      // auto-collapse status after success (feel snappy)
      setTimeout(() => setStatusCollapsed(true), 600);
    } catch (e) {
      const msg =
        e?.name === "AbortError"
          ? `Timeout after ${Math.round(timeoutMs / 1000)}s`
          : (e?.message || String(e));
      setPlanError(msg);
      toast({ type: "error", title: t.failed, msg, ttl: 5000 });
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setLoadingPlan(false);
    }
  }

  async function autoFillFromLink() {
    if (!linkUrl.trim()) return;
    setLinkInfo("");
    setPlanError("");

    try {
      const r = await fetch("/api/analyze-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim() }),
      });

      const raw = await r.text();
      let json = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON analyze response (${r.status}).`);
      }
      if (!r.ok || !json?.ok) throw new Error(json?.error || `Analyze failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || ""),
      }));

      setLinkInfo("✓");
    } catch (e) {
      setPlanError(e?.message || String(e));
      setLinkInfo("");
    }
  }

  return (
    <div style={{ ...styles.card, ...(theme === "dark" ? styles.cardDark : styles.cardLight) }}>
      <CardHeader title={t.settings} theme={theme} />

      {/* AI + Link */}
      <Section theme={theme} title={t.aiBrain}>
        <Grid1>
          <Field theme={theme} label={t.aiBrain}>
            <Select theme={theme} value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
              <option value="bedrock">{t.bedrock}</option>
              <option value="gemini">{t.gemini}</option>
            </Select>
          </Field>

          <Field theme={theme} label={t.productUrl}>
            <Input
              theme={theme}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
              <button
                type="button"
                onClick={autoFillFromLink}
                style={{ ...styles.secondaryBtn, ...(theme === "dark" ? styles.secondaryBtnDark : {}) }}
              >
                {t.runAutofill}
              </button>
              {linkInfo ? <Chip theme={theme} tone="ok">{linkInfo}</Chip> : null}
            </div>
          </Field>
        </Grid1>
      </Section>

      {/* Core */}
      <Section theme={theme} title={t.coreInputs}>
        <Grid1>
          <Field theme={theme} label={`${t.brand} *`}>
            <Input theme={theme} value={p.brand} onChange={(e) => update("brand", e.target.value)} placeholder="…" />
          </Field>
          <Field theme={theme} label={`${t.productType} *`}>
            <Input theme={theme} value={p.product_type} onChange={(e) => update("product_type", e.target.value)} placeholder="…" />
          </Field>
          <Field theme={theme} label={`${t.material} *`}>
            <Input theme={theme} value={p.material} onChange={(e) => update("material", e.target.value)} placeholder="…" />
          </Field>
        </Grid1>
      </Section>

      {/* Format & Timing */}
      <Section theme={theme} title={t.formatTiming}>
        <Grid1>
          <Field theme={theme} label={t.platform}>
            <Select theme={theme} value={p.platform} onChange={(e) => update("platform", e.target.value)}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram Reels</option>
              <option value="facebook">Facebook Reels</option>
              <option value="youtube">YouTube Shorts</option>
            </Select>
          </Field>

          <Field theme={theme} label={t.aspectRatio}>
            <Select theme={theme} value={p.aspect_ratio} onChange={(e) => update("aspect_ratio", e.target.value)}>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
            </Select>
          </Field>

          <Field theme={theme} label={t.sceneCount}>
            <Select
              theme={theme}
              value={String(p.scene_count)}
              onChange={(e) => update("scene_count", Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </Select>
          </Field>

          <Field theme={theme} label={t.secondsPerScene}>
            <Select
              theme={theme}
              value={String(p.seconds_per_scene)}
              onChange={(e) => update("seconds_per_scene", Number(e.target.value))}
            >
              {[4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={String(n)}>{n}s</option>
              ))}
            </Select>
          </Field>

          <MiniRow>
            <Chip theme={theme}>{`≈ ${totalDuration}s`}</Chip>
          </MiniRow>
        </Grid1>
      </Section>

      {/* Assets optional (but backend currently requires both URLs) */}
      <Section theme={theme} title={t.assets}>
        <Grid1>
          <ImageUploadField
            label={`${t.modelRef} (optional)`}
            kind="model"
            projectId={p.project_id || "local"}
            valueUrl={p.model_ref_url}
            onUrl={(url) => update("model_ref_url", url)}
            optional
            hideUrl
            showPreview
          />

          <ImageUploadField
            label={`${t.productRef} (optional)`}
            kind="product"
            projectId={p.project_id || "local"}
            valueUrl={p.product_ref_url}
            onUrl={(url) => update("product_ref_url", url)}
            optional
            hideUrl
            showPreview
          />
        </Grid1>
      </Section>

      {planError ? (
        <div style={{ ...styles.errorBox, ...(theme === "dark" ? styles.errorBoxDark : {}) }}>
          {planError}
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={generatePlanOnce}
          disabled={!canGeneratePlan}
          style={{
            ...styles.primaryBtn,
            ...(theme === "dark" ? styles.primaryBtnDark : styles.primaryBtnLight),
            opacity: canGeneratePlan ? 1 : 0.5,
            cursor: canGeneratePlan ? "pointer" : "not-allowed",
            width: "100%",
          }}
        >
          {loadingPlan ? t.generating : t.generatePlan}
        </button>
      </div>
    </div>
  );
}

function ScenesTab() {
  const { blueprint, theme, lang, toast } = useStudio();
  const t = COPY[lang];

  const { beats, path } = useMemo(() => extractBeats(blueprint), [blueprint]);

  function copyJson() {
    try {
      navigator.clipboard.writeText(JSON.stringify(blueprint, null, 2));
      toast({ type: "success", title: t.copied, msg: "", ttl: 1200 });
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ ...styles.card, ...(theme === "dark" ? styles.cardDark : styles.cardLight) }}>
      <CardHeader title={t.scenes} theme={theme} />

      {!blueprint ? (
        <div style={{ ...styles.placeholder, ...(theme === "dark" ? styles.placeholderDark : {}) }}>
          {t.noBlueprint}
        </div>
      ) : beats.length === 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ ...styles.placeholder, ...(theme === "dark" ? styles.placeholderDark : {}) }}>
            {t.beatsMissing}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={copyJson}
              style={{ ...styles.secondaryBtn, ...(theme === "dark" ? styles.secondaryBtnDark : {}) }}
            >
              {t.openJson}
            </button>

            <a
              href={makeJsonDownloadHref(blueprint)}
              download="blueprint.json"
              style={{
                ...styles.secondaryBtn,
                ...(theme === "dark" ? styles.secondaryBtnDark : {}),
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {t.downloadJson}
            </a>

            {path ? <Chip theme={theme}>{path}</Chip> : null}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {path ? <Chip theme={theme}>{path}</Chip> : null}

          {beats.map((b, idx) => {
            const id = b?.id || b?.scene_id || `S${idx + 1}`;
            const goal = b?.goal || b?.title || b?.name || "SCENE";
            const action = b?.action || b?.visual || b?.what_happens || "—";
            const ost = b?.on_screen_text || b?.text_overlay || b?.caption || "—";
            const neg = Array.isArray(b?.negative_prompt)
              ? b.negative_prompt
              : Array.isArray(b?.negatives)
              ? b.negatives
              : [];

            return (
              <div key={id} style={{ ...styles.sceneCard, ...(theme === "dark" ? styles.sceneCardDark : {}) }}>
                <div style={styles.sceneTop}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ ...styles.sceneBadge, ...(theme === "dark" ? styles.sceneBadgeDark : {}) }}>
                      {id}
                    </span>
                    <div style={{ fontWeight: 900 }}>{goal}</div>
                  </div>
                  <Chip theme={theme}>Draft</Chip>
                </div>

                <div style={styles.sceneGrid}>
                  <div>
                    <div style={{ ...styles.miniLabel, ...(theme === "dark" ? styles.miniLabelDark : {}) }}>Action</div>
                    <div style={{ ...styles.miniBox, ...(theme === "dark" ? styles.miniBoxDark : {}) }}>
                      {String(action)}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...styles.miniLabel, ...(theme === "dark" ? styles.miniLabelDark : {}) }}>
                      On-screen
                    </div>
                    <div style={{ ...styles.miniBox, ...(theme === "dark" ? styles.miniBoxDark : {}) }}>
                      {String(ost)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ ...styles.miniLabel, ...(theme === "dark" ? styles.miniLabelDark : {}) }}>
                    Negative
                  </div>
                  <div style={{ ...styles.miniBox, ...(theme === "dark" ? styles.miniBoxDark : {}) }}>
                    {neg.slice(0, 10).join(", ") || "—"}
                    {neg.length > 10 ? "…" : ""}
                  </div>
                </div>

                <div style={styles.stepperRow}>
                  <Step theme={theme} label="Plan" active />
                  <Step theme={theme} label="Image" />
                  <Step theme={theme} label="Approve" />
                  <Step theme={theme} label="Video" />
                  <Step theme={theme} label="Audio" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExportTab() {
  const { blueprint, theme, lang } = useStudio();
  const t = COPY[lang];

  return (
    <div style={{ ...styles.card, ...(theme === "dark" ? styles.cardDark : styles.cardLight) }}>
      <CardHeader title={t.export} theme={theme} />
      {!blueprint ? (
        <div style={{ ...styles.placeholder, ...(theme === "dark" ? styles.placeholderDark : {}) }}>
          {t.noBlueprint}
        </div>
      ) : (
        <a
          href={makeJsonDownloadHref(blueprint)}
          download="blueprint.json"
          style={{
            ...styles.primaryBtn,
            ...(theme === "dark" ? styles.primaryBtnDark : styles.primaryBtnLight),
            textDecoration: "none",
            display: "inline-flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {t.downloadJson}
        </a>
      )}
    </div>
  );
}

/* =========================
   Status dock (collapsible)
   ========================= */
function StatusDock() {
  const {
    theme, lang,
    projectDraft,
    loadingPlan,
    planError,
    statusCollapsed,
    setStatusCollapsed,
    elapsedMs,
    abortRef,
    setLoadingPlan,
    setPlanError
  } = useStudio();
  const t = COPY[lang];

  const coreOk =
    (projectDraft.brand || "").trim() &&
    (projectDraft.product_type || "").trim() &&
    (projectDraft.material || "").trim() &&
    (projectDraft.platform || "").trim() &&
    (projectDraft.aspect_ratio || "").trim() &&
    Number(projectDraft.scene_count || 0) > 0 &&
    Number(projectDraft.seconds_per_scene || 0) > 0;

  const modelOk = (projectDraft.model_ref_url || "").trim().length > 0;
  const productOk = (projectDraft.product_ref_url || "").trim().length > 0;

  const duration = Number(projectDraft.scene_count || 0) * Number(projectDraft.seconds_per_scene || 0);

  function onCancel() {
    try {
      abortRef.current?.abort();
    } catch {}
    abortRef.current = null;
    setLoadingPlan(false);
    setPlanError("Canceled");
  }

  const elapsed = formatElapsed(elapsedMs);

  return (
    <div
      style={{
        ...styles.statusDock,
        ...(theme === "dark" ? styles.statusDockDark : styles.statusDockLight),
        transform: statusCollapsed ? "translateY(calc(100% - 44px))" : "translateY(0)",
      }}
    >
      <div style={styles.statusInner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>{t.status}</div>

          <button
            type="button"
            onClick={() => setStatusCollapsed(!statusCollapsed)}
            style={{
              ...styles.collapseBtn,
              ...(theme === "dark" ? styles.collapseBtnDark : styles.collapseBtnLight),
            }}
          >
            {statusCollapsed ? t.expand : t.collapse}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <Chip theme={theme} tone={coreOk ? "ok" : "bad"}>{t.coreOk} {coreOk ? "✓" : "×"}</Chip>
          <Chip theme={theme} tone={modelOk ? "ok" : "bad"}>{t.modelOk} {modelOk ? "✓" : "×"}</Chip>
          <Chip theme={theme} tone={productOk ? "ok" : "bad"}>{t.productOk} {productOk ? "✓" : "×"}</Chip>
          <Chip theme={theme}>{`≈ ${duration || 0}s`}</Chip>
          <Chip theme={theme}>{`${t.provider}: ${(projectDraft.ai_brain || "bedrock").toUpperCase()}`}</Chip>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ opacity: 0.8, fontSize: 12, fontWeight: 800 }}>{t.elapsed}: {elapsed}</div>
            {loadingPlan ? (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  ...styles.secondaryBtn,
                  ...(theme === "dark" ? styles.secondaryBtnDark : {}),
                  padding: "10px 12px",
                }}
              >
                {t.cancel}
              </button>
            ) : null}
          </div>

          <div style={{ ...styles.progressTrack, ...(theme === "dark" ? styles.progressTrackDark : {}) }}>
            <div
              style={{
                ...styles.progressBar,
                ...(loadingPlan ? styles.progressBarAnim : {}),
              }}
            />
          </div>
        </div>

        {planError ? (
          <div style={{ ...styles.errorBox, ...(theme === "dark" ? styles.errorBoxDark : {}) }}>
            {planError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* =========================
   Bottom tabs
   ========================= */
function TabBar() {
  const { tab, setTab, theme, lang } = useStudio();
  const t = COPY[lang];

  const labels = {
    Settings: t.settings,
    Scenes: t.scenes,
    Export: t.export,
  };

  return (
    <div style={styles.tabBarWrap}>
      <div style={{ ...styles.tabBar, ...(theme === "dark" ? styles.tabBarDark : styles.tabBarLight) }}>
        {TABS.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setTab(x)}
            style={{
              ...styles.tabBtn,
              ...(theme === "dark" ? styles.tabBtnDark : {}),
              ...(tab === x ? (theme === "dark" ? styles.tabBtnActiveDark : styles.tabBtnActiveLight) : {}),
            }}
          >
            {labels[x]}
          </button>
        ))}
      </div>
    </div>
  );
}

function FooterCredit({ theme }) {
  return (
    <div style={{ ...styles.footer, ...(theme === "dark" ? styles.footerDark : styles.footerLight) }}>
      Created by <span style={{ fontWeight: 900 }}>@adryndian</span>
    </div>
  );
}

/* =========================
   UI atoms
   ========================= */
function MiniRow({ children }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {children}
    </div>
  );
}
function CardHeader({ title, theme }) {
  return (
    <div style={{ ...styles.cardHeader, ...(theme === "dark" ? styles.cardHeaderDark : {}) }}>
      <div style={{ ...styles.cardTitle, ...(theme === "dark" ? styles.cardTitleDark : {}) }}>{title}</div>
    </div>
  );
}

function Section({ title, children, theme }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ ...styles.sectionTitle, ...(theme === "dark" ? styles.sectionTitleDark : {}) }}>{title}</div>
      <div style={{ display: "grid", gap: 12, marginTop: 10 }}>{children}</div>
    </div>
  );
}

function Grid1({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>{children}</div>;
}

function Field({ label, children, theme }) {
  return (
    <div>
      <div style={{ ...styles.label, ...(theme === "dark" ? styles.labelDark : {}) }}>{label}</div>
      {children}
    </div>
  );
}

function Input({ theme, ...props }) {
  return (
    <input
      {...props}
      style={{
        ...styles.input,
        ...(theme === "dark" ? styles.inputDark : styles.inputLight),
      }}
    />
  );
}

function Select({ theme, ...props }) {
  return (
    <select
      {...props}
      style={{
        ...styles.select,
        ...(theme === "dark" ? styles.selectDark : styles.selectLight),
      }}
    />
  );
}

function Chip({ children, tone, theme }) {
  const base = theme === "dark" ? styles.chipDark : styles.chipLight;
  const ok = theme === "dark" ? styles.chipOkDark : styles.chipOkLight;
  const bad = theme === "dark" ? styles.chipBadDark : styles.chipBadLight;

  return (
    <span style={{ ...styles.chip, ...base, ...(tone === "ok" ? ok : tone === "bad" ? bad : {}) }}>
      {children}
    </span>
  );
}

function Step({ label, active, theme }) {
  return (
    <div style={{ ...styles.step, ...(theme === "dark" ? styles.stepDark : styles.stepLight), ...(active ? styles.stepActive : {}) }}>
      {label}
    </div>
  );
}

/* =========================
   Utils
   ========================= */
function formatElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function makeJsonDownloadHref(obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  return URL.createObjectURL(blob);
}

/* =========================
   Styles (black / white / orange)
   ========================= */
const ORANGE = "#ff6a00";

const styles = {
  page: {
    minHeight: "100vh",
    paddingBottom: 140, // for tabbar + footer
  },
  pageDark: {
    background: "radial-gradient(1200px 900px at 20% 0%, rgba(255,106,0,0.12), rgba(0,0,0,0) 55%), #0b0b0f",
    color: "#e5e7eb",
  },
  pageLight: {
    background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 70%)",
    color: "#0b1220",
  },

  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    backdropFilter: "blur(14px)",
  },
  topBarDark: { background: "rgba(10,10,14,0.72)" },
  topBarLight: { background: "rgba(255,255,255,0.70)", borderBottom: "1px solid rgba(0,0,0,0.06)" },
  topBarInner: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "14px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { fontWeight: 950, fontSize: 18, letterSpacing: -0.2 },
  titleDark: { color: "#f9fafb" },
  titleLight: { color: "#0b1220" },

  pill: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 999,
  },
  pillDark: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" },
  pillLight: { background: "rgba(255,255,255,0.80)", border: "1px solid rgba(0,0,0,0.06)" },
  pillBtns: { display: "flex", gap: 6 },
  pillBtn: {
    border: "none",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
    background: "transparent",
  },
  pillBtnDark: { color: "#e5e7eb" },
  pillBtnActive: { background: "rgba(255,255,255,0.16)" },

  modeBtn: {
    borderRadius: 999,
    padding: "10px 12px",
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.10)",
    cursor: "pointer",
  },
  modeBtnDark: { background: "rgba(255,255,255,0.06)", color: "#f9fafb" },
  modeBtnLight: { background: "rgba(255,255,255,0.90)", color: "#0b1220", border: "1px solid rgba(0,0,0,0.08)" },

  content: {
    maxWidth: 860,
    margin: "0 auto",
    padding: 14,
    display: "grid",
    gap: 12,
  },

  card: {
    borderRadius: 18,
    padding: 14,
  },
  cardDark: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  },
  cardLight: {
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.07)",
  },

  cardHeader: { paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" },
  cardHeaderDark: { borderBottom: "1px solid rgba(255,255,255,0.08)" },
  cardTitle: { fontWeight: 950, fontSize: 16, letterSpacing: -0.2 },
  cardTitleDark: { color: "#f9fafb" },

  sectionTitle: { fontWeight: 950, fontSize: 13, opacity: 0.95 },
  sectionTitleDark: { color: "#f9fafb" },

  label: { fontSize: 12, fontWeight: 900, marginBottom: 8, opacity: 0.85 },
  labelDark: { color: "#e5e7eb" },

  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    outline: "none",
    fontWeight: 800,
    fontSize: 13,
  },
  inputDark: {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#f9fafb",
  },
  inputLight: {
    background: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: "#0b1220",
  },

  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    outline: "none",
    fontWeight: 900,
    fontSize: 13,
  },
  selectDark: {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#f9fafb",
  },
  selectLight: {
    background: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: "#0b1220",
  },

  chip: {
    fontSize: 12,
    fontWeight: 950,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid transparent",
  },
  chipDark: { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)", color: "#e5e7eb" },
  chipLight: { background: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.06)", color: "#0b1220" },
  chipOkDark: { background: "rgba(34,197,94,0.16)", borderColor: "rgba(34,197,94,0.22)" },
  chipBadDark: { background: "rgba(239,68,68,0.16)", borderColor: "rgba(239,68,68,0.22)" },
  chipOkLight: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.18)" },
  chipBadLight: { background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.16)" },

  MiniRow: {},

  primaryBtn: {
    padding: "14px 14px",
    borderRadius: 16,
    border: "none",
    fontWeight: 950,
    fontSize: 14,
  },
  primaryBtnDark: { background: ORANGE, color: "black" },
  primaryBtnLight: { background: ORANGE, color: "white" },

  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    fontWeight: 950,
    cursor: "pointer",
  },
  secondaryBtnDark: { color: "#f9fafb", borderColor: "rgba(255,255,255,0.12)" },

  placeholder: {
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(0,0,0,0.18)",
    background: "rgba(255,255,255,0.04)",
  },
  placeholderDark: { border: "1px dashed rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.04)" },

  sceneCard: {
    borderRadius: 18,
    padding: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.70)",
  },
  sceneCardDark: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
  },
  sceneTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  sceneBadge: {
    fontWeight: 950,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,106,0,0.16)",
    border: "1px solid rgba(255,106,0,0.25)",
    color: "#111827",
  },
  sceneBadgeDark: { color: "#f9fafb" },
  sceneGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 },
  miniLabel: { fontSize: 12, fontWeight: 950, marginBottom: 6 },
  miniLabelDark: { color: "#e5e7eb" },
  miniBox: {
    borderRadius: 14,
    padding: 10,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "pre-wrap",
  },
  miniBoxDark: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.35)",
    color: "#f9fafb",
  },
  stepperRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  step: {
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid rgba(0,0,0,0.08)",
  },
  stepDark: { border: "1px solid rgba(255,255,255,0.10)", color: "#e5e7eb", background: "rgba(255,255,255,0.04)" },
  stepLight: { color: "#0b1220", background: "rgba(0,0,0,0.04)" },
  stepActive: { background: "rgba(255,106,0,0.18)", borderColor: "rgba(255,106,0,0.30)" },

  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "#b91c1c",
    fontWeight: 900,
    fontSize: 13,
    whiteSpace: "pre-wrap",
  },
  errorBoxDark: { color: "#fecaca" },

  // Status dock
  statusDock: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 64, // above tab bar
    zIndex: 60,
    transition: "transform 220ms ease",
    pointerEvents: "none",
  },
  statusDockDark: {},
  statusDockLight: {},
  statusInner: {
    maxWidth: 860,
    margin: "0 auto",
    pointerEvents: "auto",
    borderRadius: 18,
    padding: 12,
  },
  statusDockDarkInner: {},
  statusDockLightInner: {},
  // apply inner skin via theme
  statusDockDark: {},
  statusDockLight: {},
  // we'll reuse card skins directly on inner:
  // but easiest: set background here:
  statusInnerSkin: {},

  collapseBtn: {
    borderRadius: 999,
    padding: "8px 10px",
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    cursor: "pointer",
  },
  collapseBtnDark: { color: "#f9fafb" },
  collapseBtnLight: { color: "#0b1220", borderColor: "rgba(0,0,0,0.10)", background: "rgba(255,255,255,0.75)" },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    background: "rgba(0,0,0,0.18)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginTop: 10,
  },
  progressTrackDark: { background: "rgba(255,255,255,0.06)" },
  progressBar: {
    height: "100%",
    width: "35%",
    background: ORANGE,
    borderRadius: 999,
    transform: "translateX(-120%)",
  },
  progressBarAnim: {
    animation: "ugc_progress 1.1s ease-in-out infinite",
  },

  // Tab bar
  tabBarWrap: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 34, // above footer
    zIndex: 55,
    padding: 12,
    paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
    pointerEvents: "none",
  },
  tabBar: {
    maxWidth: 520,
    margin: "0 auto",
    display: "flex",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    pointerEvents: "auto",
  },
  tabBarDark: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(16px)",
  },
  tabBarLight: {
    background: "rgba(255,255,255,0.80)",
    border: "1px solid rgba(0,0,0,0.06)",
    backdropFilter: "blur(16px)",
  },
  tabBtn: {
    flex: 1,
    border: "none",
    borderRadius: 14,
    padding: "12px 10px",
    fontWeight: 950,
    cursor: "pointer",
    background: "transparent",
    fontSize: 13,
  },
  tabBtnDark: { color: "#e5e7eb" },
  tabBtnActiveDark: { background: "rgba(255,255,255,0.10)" },
  tabBtnActiveLight: { background: "rgba(0,0,0,0.06)" },

  // Footer
  footer: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    pointerEvents: "none",
  },
  footerDark: { color: "rgba(255,255,255,0.45)", background: "rgba(0,0,0,0.15)" },
  footerLight: { color: "rgba(0,0,0,0.50)", background: "rgba(255,255,255,0.45)" },

  // Toast
  toastHost: {
    position: "fixed",
    top: 64,
    right: 12,
    zIndex: 80,
    display: "grid",
    gap: 10,
    pointerEvents: "none",
  },
  toastHostDark: {},
  toast: {
    position: "relative",
    width: 280,
    borderRadius: 16,
    padding: 12,
    pointerEvents: "auto",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(14px)",
  },
  toastDark: { color: "#f9fafb" },
  toastSuccess: { borderColor: "rgba(34,197,94,0.22)" },
  toastError: { borderColor: "rgba(239,68,68,0.22)" },
  toastX: {
    position: "absolute",
    top: 6,
    right: 10,
    border: "none",
    background: "transparent",
    color: "inherit",
    fontSize: 18,
    cursor: "pointer",
    opacity: 0.7,
  },
};

// keyframes injection (for progress bar)
if (typeof document !== "undefined") {
  const id = "ugc_progress_keyframes";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.innerHTML = `
      @keyframes ugc_progress {
        0% { transform: translateX(-120%); opacity: .85; }
        50% { transform: translateX(120%); opacity: 1; }
        100% { transform: translateX(320%); opacity: .85; }
      }
    `;
    document.head.appendChild(s);
  }
}

// Patch statusInner skin depending theme (cheap + safe)
const _origStatusDock = styles.statusDock;
styles.statusDock = _origStatusDock;

// We'll just override statusInner background in runtime via inline in StatusDock:
const _origStatusInner = styles.statusInner;
styles.statusInner = _origStatusInner;
