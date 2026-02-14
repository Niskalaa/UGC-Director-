// src/components/StudioShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

/* =========================
   i18n
   ========================= */
const I18N = {
  id: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Bahasa",
    dark: "Dark",
    light: "Light",

    aiBrain: "AI Brain",
    providerBedrock: "Bedrock",
    providerGemini: "Gemini",

    coreInputs: "Core Inputs",
    brand: "Brand",
    productType: "Product type",
    material: "Material",

    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds/scene",
    estDuration: "Estimated duration",

    assets: "Assets (optional)",
    modelRef: "Model reference",
    productRef: "Product reference",

    autofillLink: "Auto-fill from Link (optional)",
    landingUrl: "Product / Landing page URL",
    autofillBtn: "Auto-fill",
    autofillOk: "Auto-fill sukses ✓",

    status: "Status",
    readiness: "Readiness",
    progress: "Progress",
    elapsed: "Elapsed",
    cancel: "Cancel",
    generate: "Generate Plan",
    generating: "Generating…",

    noBlueprint: "Belum ada blueprint. Generate dulu di Settings.",
    beatsMissing: "Blueprint ada, tapi beats tidak terbaca.",
    draft: "Draft",
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
    providerBedrock: "Bedrock",
    providerGemini: "Gemini",

    coreInputs: "Core Inputs",
    brand: "Brand",
    productType: "Product type",
    material: "Material",

    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds/scene",
    estDuration: "Estimated duration",

    assets: "Assets (optional)",
    modelRef: "Model reference",
    productRef: "Product reference",

    autofillLink: "Auto-fill from Link (optional)",
    landingUrl: "Product / Landing page URL",
    autofillBtn: "Auto-fill",
    autofillOk: "Auto-fill success ✓",

    status: "Status",
    readiness: "Readiness",
    progress: "Progress",
    elapsed: "Elapsed",
    cancel: "Cancel",
    generate: "Generate Plan",
    generating: "Generating…",

    noBlueprint: "No blueprint yet. Generate it in Settings.",
    beatsMissing: "Blueprint exists, but beats are not readable.",
    draft: "Draft",
  },
};

/* =========================
   Tabs + Context
   ========================= */
const TABS = ["Settings", "Scenes", "Export"];

const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/* =========================
   Theme helpers
   ========================= */
function getSystemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; //  [oai_citation:1‡web.dev](https://web.dev/articles/prefers-color-scheme?utm_source=chatgpt.com)
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function msToHMS(ms) {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/* =========================
   Main Shell
   ========================= */
export default function StudioShell() {
  const [tab, setTab] = useState("Settings");

  // UI prefs
  const [lang, setLang] = useState(() => {
    if (typeof window === "undefined") return "id";
    return localStorage.getItem("studio_lang") || "id";
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("studio_theme") || (getSystemPrefersDark() ? "dark" : "light");
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("studio_lang", lang);
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("studio_theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const t = I18N[lang] || I18N.id;

  // global studio state
  const [projectDraft, setProjectDraft] = useState(() => ({
    ...DEFAULT_PROJECT,
    ai_brain: "bedrock",
    platform: DEFAULT_PROJECT.platform || "tiktok",
    aspect_ratio: DEFAULT_PROJECT.aspect_ratio || "9:16",
    scene_count: DEFAULT_PROJECT.scene_count ?? 6,
    seconds_per_scene: DEFAULT_PROJECT.seconds_per_scene ?? 8,
  }));

  const [blueprint, setBlueprint] = useState(null);

  // status / errors
  const [planError, setPlanError] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  // link autofill
  const [landingUrl, setLandingUrl] = useState("");
  const [autofillInfo, setAutofillInfo] = useState("");

  const abortRef = useRef(null);
  const tickRef = useRef(null);

  function startTimer() {
    setElapsedMs(0);
    const t0 = Date.now();
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - t0), 250);
  }
  function stopTimer() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }

  // compute readiness
  const readiness = useMemo(() => {
    const p = projectDraft || {};
    const coreOk =
      String(p.brand || "").trim() &&
      String(p.product_type || "").trim() &&
      String(p.material || "").trim() &&
      String(p.platform || "").trim() &&
      String(p.aspect_ratio || "").trim() &&
      Number(p.scene_count) > 0 &&
      Number(p.seconds_per_scene) > 0;

    // assets optional, tapi kalau backend kamu masih mewajibkan images, coreOk saja belum cukup.
    // UI: kita anggap "Ready" jika coreOk, lalu tampilkan chips model/product tergantung isi.
    const modelOk = String(p.model_ref_url || "").trim().length > 0;
    const productOk = String(p.product_ref_url || "").trim().length > 0;

    return { coreOk: !!coreOk, modelOk, productOk };
  }, [projectDraft]);

  const estimatedDuration = useMemo(() => {
    const p = projectDraft || {};
    const sc = Number(p.scene_count) || 0;
    const sp = Number(p.seconds_per_scene) || 0;
    return sc * sp;
  }, [projectDraft]);

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
  };

  const content = useMemo(() => {
    if (tab === "Scenes") return <ScenesTab />;
    if (tab === "Export") return <ExportTab />;
    return <SettingsTab landingUrl={landingUrl} setLandingUrl={setLandingUrl} autofillInfo={autofillInfo} setAutofillInfo={setAutofillInfo} />;
  }, [tab, landingUrl, autofillInfo]);

  async function generatePlanOnce() {
    const p = projectDraft;

    // IMPORTANT: jangan bikin tombol “aktif tapi nggak jalan”.
    // Kalau sedang loading, block.
    if (loadingPlan) return;

    // Core minimal
    const coreOk = readiness.coreOk;
    if (!coreOk) {
      setPlanError(lang === "id" ? "Lengkapi Core & Format dulu." : "Complete Core & Format first.");
      return;
    }

    setPlanError("");
    setLoadingPlan(true);
    setAutofillInfo("");
    startTimer();

    const provider = String(p.ai_brain || "bedrock").toLowerCase();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // timeout hard
    const timeoutMs = 120000;
    const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

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
        throw new Error(`Non-JSON response (${r.status}). Preview: ${String(raw).slice(0, 160)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Plan failed (${r.status})`);
      if (!json?.blueprint) throw new Error("Plan OK but blueprint is empty.");

      setBlueprint(json.blueprint);
      setTab("Scenes");
    } catch (e) {
      if (e?.name === "AbortError") {
        setPlanError(lang === "id" ? "Request dibatalkan / timeout." : "Request canceled / timed out.");
      } else {
        setPlanError(e?.message || String(e));
      }
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
      stopTimer();
      setLoadingPlan(false);
    }
  }

  function cancelGenerate() {
    if (abortRef.current) abortRef.current.abort();
  }

  return (
    <StudioContext.Provider value={ctx}>
      <div style={getStyles(theme).page}>
        {/* Top Bar */}
        <div style={getStyles(theme).topBar}>
          <div style={getStyles(theme).topBarInner}>
            <div style={getStyles(theme).title}>{t.studio}</div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {/* Language toggle */}
              <div style={getStyles(theme).pill}>
                <span style={getStyles(theme).pillLabel}>{t.language}</span>
                <button
                  type="button"
                  onClick={() => setLang("id")}
                  style={{ ...getStyles(theme).pillBtn, ...(lang === "id" ? getStyles(theme).pillBtnActive : {}) }}
                >
                  ID
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  style={{ ...getStyles(theme).pillBtn, ...(lang === "en" ? getStyles(theme).pillBtnActive : {}) }}
                >
                  EN
                </button>
              </div>

              {/* Theme toggle */}
              <button
                type="button"
                onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
                style={getStyles(theme).iconBtn}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? t.dark : t.light}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={getStyles(theme).content}>{content}</div>

        {/* Status Card (bottom) */}
        <div style={getStyles(theme).statusWrap}>
          <div style={getStyles(theme).statusCard}>
            <div style={getStyles(theme).statusHeader}>
              <div style={getStyles(theme).statusTitle}>{t.status}</div>
              <div style={getStyles(theme).statusSub}>{t.readiness}</div>
            </div>

            <div style={getStyles(theme).chipRow}>
              <Chip theme={theme} tone={readiness.coreOk ? "ok" : "bad"}>{readiness.coreOk ? "Core ✓" : "Core ✗"}</Chip>
              <Chip theme={theme} tone={readiness.modelOk ? "ok" : "bad"}>{readiness.modelOk ? "Model ✓" : "Model ✗"}</Chip>
              <Chip theme={theme} tone={readiness.productOk ? "ok" : "bad"}>{readiness.productOk ? "Product ✓" : "Product ✗"}</Chip>
              <Chip theme={theme}>{t.estDuration}: {estimatedDuration}s</Chip>
              <Chip theme={theme}>Provider: {String(projectDraft.ai_brain || "bedrock").toUpperCase()}</Chip>
            </div>

            <div style={getStyles(theme).progressRow}>
              <div style={getStyles(theme).progressLabel}>{t.progress}</div>
              <div style={getStyles(theme).progressBarOuter}>
                <div
                  style={{
                    ...getStyles(theme).progressBarInner,
                    width: loadingPlan ? `${clamp((elapsedMs / 120000) * 100, 3, 95)}%` : blueprint ? "100%" : "0%",
                  }}
                />
              </div>
            </div>

            <div style={getStyles(theme).rowBetween}>
              <Chip theme={theme}>{t.elapsed}: {loadingPlan ? msToHMS(elapsedMs) : "—"}</Chip>
              {loadingPlan ? (
                <button type="button" onClick={cancelGenerate} style={getStyles(theme).secondaryBtn}>
                  {t.cancel}
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={generatePlanOnce}
              disabled={loadingPlan}
              style={{
                ...getStyles(theme).primaryBtn,
                opacity: loadingPlan ? 0.6 : 1,
                cursor: loadingPlan ? "not-allowed" : "pointer",
              }}
            >
              {loadingPlan ? (
                <span style={{ display: "inline-flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
                  <Spinner theme={theme} />
                  {t.generating}
                </span>
              ) : (
                t.generate
              )}
            </button>

            {planError ? <div style={getStyles(theme).errorBox}>{planError}</div> : null}
          </div>
        </div>

        {/* Bottom Tabs */}
        <div style={getStyles(theme).tabBar}>
          <div style={getStyles(theme).tabBarInner}>
            {TABS.map((tt) => (
              <button
                key={tt}
                onClick={() => setTab(tt)}
                style={{ ...getStyles(theme).tabBtn, ...(tab === tt ? getStyles(theme).tabBtnActive : {}) }}
                type="button"
              >
                {t[tt.toLowerCase()]}
              </button>
            ))}
          </div>
        </div>

        {/* Credit (fixed, tidak ikut scroll) */}
        <div style={getStyles(theme).credit}>Created by @adryndian</div>
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   Tabs
   ========================= */

function SettingsTab({ landingUrl, setLandingUrl, autofillInfo, setAutofillInfo }) {
  const { projectDraft, setProjectDraft, theme, lang, setPlanError } = useStudio();
  const t = I18N[lang] || I18N.id;

  const [p, setP] = useState(projectDraft);
  const [analyzingLink, setAnalyzingLink] = useState(false);

  // keep draft synced
  useEffect(() => setP(projectDraft), [projectDraft]);

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
    setProjectDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function autoFillFromLink() {
    if (analyzingLink) return;
    if (!String(landingUrl || "").trim()) return;

    setPlanError("");
    setAutofillInfo("");
    setAnalyzingLink(true);

    try {
      const r = await fetch("/api/analyze-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: landingUrl }),
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON analyze-link response (${r.status}): ${String(raw).slice(0, 160)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Analyze-link failed (${r.status})`);

      const f = json.fields || {};
      // only fill if empty (biar nggak nimpa input manual)
      const next = {
        ...p,
        brand: String(p.brand || "").trim() ? p.brand : (f.brand || ""),
        product_type: String(p.product_type || "").trim() ? p.product_type : (f.product_type || ""),
        material: String(p.material || "").trim() ? p.material : (f.material || ""),
      };
      setP(next);
      setProjectDraft(next);

      setAutofillInfo(t.autofillOk);
    } catch (e) {
      setPlanError(e?.message || String(e));
    } finally {
      setAnalyzingLink(false);
    }
  }

  return (
    <div style={getStyles(theme).card}>
      <CardHeader theme={theme} title={t.settings} />

      <Section theme={theme} title={t.aiBrain}>
        <Grid1 theme={theme}>
          <Field theme={theme} label={t.aiBrain}>
            <Select
              theme={theme}
              value={p.ai_brain || "bedrock"}
              onChange={(e) => update("ai_brain", e.target.value)}
            >
              <option value="bedrock">{t.providerBedrock}</option>
              <option value="gemini">{t.providerGemini}</option>
            </Select>
          </Field>
        </Grid1>
      </Section>

      <Section theme={theme} title={t.autofillLink}>
        <Grid1 theme={theme}>
          <Field theme={theme} label={t.landingUrl}>
            <Input
              theme={theme}
              value={landingUrl}
              onChange={(e) => setLandingUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={autoFillFromLink}
              disabled={analyzingLink || !String(landingUrl || "").trim()}
              style={{
                ...getStyles(theme).secondaryBtn,
                opacity: analyzingLink || !String(landingUrl || "").trim() ? 0.6 : 1,
              }}
            >
              {analyzingLink ? "…" : t.autofillBtn}
            </button>
            {autofillInfo ? <Chip theme={theme} tone="ok">{autofillInfo}</Chip> : null}
          </div>
        </Grid1>
      </Section>

      <Section theme={theme} title={t.formatTiming}>
        <Grid1 theme={theme}>
          <Field theme={theme} label={t.platform}>
            <Select theme={theme} value={p.platform || "tiktok"} onChange={(e) => update("platform", e.target.value)}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram Reels</option>
              <option value="facebook">Facebook Reels</option>
              <option value="youtube">YouTube Shorts</option>
            </Select>
          </Field>

          <Field theme={theme} label={t.aspectRatio}>
            <Select theme={theme} value={p.aspect_ratio || "9:16"} onChange={(e) => update("aspect_ratio", e.target.value)}>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
            </Select>
          </Field>

          <Field theme={theme} label={t.sceneCount}>
            <Select
              theme={theme}
              value={String(p.scene_count ?? 6)}
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
              value={String(p.seconds_per_scene ?? 8)}
              onChange={(e) => update("seconds_per_scene", Number(e.target.value))}
            >
              {[4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={String(n)}>{n}s</option>
              ))}
            </Select>
          </Field>
        </Grid1>
      </Section>

      <Section theme={theme} title={t.coreInputs}>
        <Grid1 theme={theme}>
          <Field theme={theme} label={`${t.brand} *`}>
            <Input theme={theme} value={p.brand || ""} onChange={(e) => update("brand", e.target.value)} />
          </Field>
          <Field theme={theme} label={`${t.productType} *`}>
            <Input theme={theme} value={p.product_type || ""} onChange={(e) => update("product_type", e.target.value)} />
          </Field>
          <Field theme={theme} label={`${t.material} *`}>
            <Input theme={theme} value={p.material || ""} onChange={(e) => update("material", e.target.value)} />
          </Field>
        </Grid1>
      </Section>

      <Section theme={theme} title={t.assets}>
        <Grid1 theme={theme}>
          <ImageUploadField
            label={t.modelRef}
            kind="model"
            projectId={p.project_id || "local"}
            valueUrl={p.model_ref_url || ""}
            onUrl={(url) => update("model_ref_url", url)}
            hideUrl={true}
            showPreview={true}
            optional={true}
          />
          <ImageUploadField
            label={t.productRef}
            kind="product"
            projectId={p.project_id || "local"}
            valueUrl={p.product_ref_url || ""}
            onUrl={(url) => update("product_ref_url", url)}
            hideUrl={true}
            showPreview={true}
            optional={true}
          />
        </Grid1>
      </Section>
    </div>
  );
}

function ScenesTab() {
  const { blueprint, theme, lang } = useStudio();
  const t = I18N[lang] || I18N.id;

  const beats = useMemo(() => extractBeats(blueprint), [blueprint]);

  return (
    <div style={getStyles(theme).card}>
      <CardHeader theme={theme} title={t.scenes} sub="plan → image → approve → video → audio" />

      {!blueprint ? (
        <div style={getStyles(theme).placeholder}>{t.noBlueprint}</div>
      ) : beats.length === 0 ? (
        <div style={getStyles(theme).placeholder}>{t.beatsMissing}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {beats.map((b, idx) => (
            <div key={b.id || idx} style={getStyles(theme).sceneCard}>
              <div style={getStyles(theme).sceneTop}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={getStyles(theme).sceneBadge}>{b.id || `S${idx + 1}`}</span>
                  <div style={{ fontWeight: 900 }}>{b.goal || b.title || "SCENE"}</div>
                  <Chip theme={theme}>{b.time_window || b.duration || "—"}</Chip>
                </div>
                <Chip theme={theme}>{t.draft}</Chip>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <MiniBox theme={theme} label="Action" value={b.action || "—"} />
                <MiniBox theme={theme} label="On-screen text" value={b.on_screen_text || b.onscreen || "—"} />
                <MiniBox
                  theme={theme}
                  label="Negative prompt"
                  value={(Array.isArray(b.negative_prompt) ? b.negative_prompt : []).slice(0, 10).join(", ") || "—"}
                />
              </div>

              <div style={getStyles(theme).stepperRow}>
                <Step theme={theme} label="Plan" active />
                <Step theme={theme} label="Image" />
                <Step theme={theme} label="Approve" />
                <Step theme={theme} label="Video" />
                <Step theme={theme} label="Audio" />
              </div>

              <div style={getStyles(theme).sceneActions}>
                <button type="button" style={getStyles(theme).secondaryBtn} onClick={() => alert("Next: per-scene editor")}>
                  Edit Prompt
                </button>
                <button type="button" style={getStyles(theme).primaryBtn} onClick={() => alert("Next: Generate Image per scene")}>
                  Generate Image
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
  const { blueprint, theme, lang } = useStudio();
  const t = I18N[lang] || I18N.id;

  return (
    <div style={getStyles(theme).card}>
      <CardHeader theme={theme} title={t.export} />
      {!blueprint ? (
        <div style={getStyles(theme).placeholder}>{t.noBlueprint}</div>
      ) : (
        <div style={getStyles(theme).placeholder}>
          Next: download blueprint JSON + per-scene assets.
        </div>
      )}
    </div>
  );
}

/* =========================
   Blueprint beat extractor (robust)
   ========================= */
function extractBeats(blueprint) {
  if (!blueprint) return [];

  // common layouts
  const direct =
    blueprint?.storyboard?.beats ||
    blueprint?.storyboard?.scenes ||
    blueprint?.beats ||
    blueprint?.scenes;

  if (Array.isArray(direct)) return direct;

  // segmented object
  const segKeys = Object.keys(blueprint || {}).filter((k) => String(k).toLowerCase().includes("segment"));
  for (const k of segKeys) {
    const v = blueprint?.[k];
    const arr = v?.storyboard?.beats || v?.storyboard?.scenes || v?.beats || v?.scenes;
    if (Array.isArray(arr) && arr.length) return arr;
  }

  // nested segments array
  const segArr = blueprint?.segments;
  if (Array.isArray(segArr)) {
    for (const s of segArr) {
      const arr = s?.storyboard?.beats || s?.storyboard?.scenes || s?.beats || s?.scenes;
      if (Array.isArray(arr) && arr.length) return arr;
    }
  }

  return [];
}

/* =========================
   UI atoms
   ========================= */
function CardHeader({ theme, title, sub }) {
  return (
    <div style={getStyles(theme).cardHeader}>
      <div style={getStyles(theme).cardTitle}>{title}</div>
      {sub ? <div style={getStyles(theme).cardSub}>{sub}</div> : null}
    </div>
  );
}

function Section({ theme, title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={getStyles(theme).sectionTitle}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function Grid1({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>{children}</div>;
}

function Field({ theme, label, children }) {
  return (
    <div>
      <div style={getStyles(theme).label}>{label}</div>
      {children}
    </div>
  );
}

function Input({ theme, ...props }) {
  return <input {...props} style={getStyles(theme).input} />;
}

function Select({ theme, ...props }) {
  return <select {...props} style={getStyles(theme).select} />;
}

function Chip({ theme, tone, children }) {
  const s = getStyles(theme);
  const toneStyle =
    tone === "ok"
      ? s.chipOk
      : tone === "bad"
      ? s.chipBad
      : {};
  return <span style={{ ...s.chip, ...toneStyle }}>{children}</span>;
}

function Step({ theme, label, active }) {
  const s = getStyles(theme);
  return <div style={{ ...s.step, ...(active ? s.stepActive : {}) }}>{label}</div>;
}

function MiniBox({ theme, label, value }) {
  const s = getStyles(theme);
  return (
    <div>
      <div style={s.miniLabel}>{label}</div>
      <div style={s.miniBox}>{value}</div>
    </div>
  );
}

function Spinner({ theme }) {
  const s = getStyles(theme);
  return <span style={s.spinner} />;
}

/* =========================
   Styles (black-white-orange)
   ========================= */
function getStyles(theme) {
  const dark = theme === "dark";

  const bg = dark ? "#0B0B0E" : "#FFFFFF";
  const panel = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const card = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.03)";
  const border = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
  const text = dark ? "#F5F5F7" : "#111827";
  const sub = dark ? "rgba(245,245,247,0.70)" : "rgba(17,24,39,0.60)";
  const orange = "#F97316";

  return {
    page: {
      minHeight: "100vh",
      background: bg,
      color: text,
      paddingBottom: 170,
    },

    topBar: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      backdropFilter: "blur(14px)",
      background: dark ? "rgba(11,11,14,0.78)" : "rgba(255,255,255,0.78)",
      borderBottom: `1px solid ${border}`,
    },
    topBarInner: {
      maxWidth: 980,
      margin: "0 auto",
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    title: { fontWeight: 900, fontSize: 18 },

    pill: {
      display: "inline-flex",
      gap: 6,
      alignItems: "center",
      padding: 6,
      borderRadius: 999,
      background: panel,
      border: `1px solid ${border}`,
    },
    pillLabel: { fontSize: 12, fontWeight: 800, color: sub, marginRight: 6 },
    pillBtn: {
      border: "none",
      borderRadius: 999,
      padding: "8px 10px",
      fontWeight: 900,
      cursor: "pointer",
      background: "transparent",
      color: sub,
    },
    pillBtnActive: {
      background: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      color: text,
    },

    iconBtn: {
      border: `1px solid ${border}`,
      background: panel,
      borderRadius: 12,
      padding: "10px 12px",
      fontWeight: 900,
      cursor: "pointer",
      color: text,
    },

    content: {
      maxWidth: 980,
      margin: "0 auto",
      padding: 14,
    },

    card: {
      borderRadius: 18,
      background: card,
      border: `1px solid ${border}`,
      padding: 14,
    },

    cardHeader: {
      marginBottom: 12,
      paddingBottom: 10,
      borderBottom: `1px solid ${border}`,
    },
    cardTitle: { fontWeight: 900, fontSize: 16 },
    cardSub: { marginTop: 4, fontSize: 12, color: sub },

    sectionTitle: {
      fontWeight: 900,
      fontSize: 13,
      marginBottom: 8,
      color: text,
    },

    label: { fontSize: 12, fontWeight: 800, marginBottom: 6, color: sub },

    input: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${border}`,
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
      color: text,
      outline: "none",
      fontWeight: 700,
    },

    select: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${border}`,
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
      color: text,
      outline: "none",
      fontWeight: 800,
    },

    placeholder: {
      padding: 12,
      borderRadius: 14,
      border: `1px dashed ${border}`,
      color: sub,
      background: panel,
    },

    // status
    statusWrap: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: "calc(74px + env(safe-area-inset-bottom))",
      zIndex: 25,
      padding: 12,
      pointerEvents: "none", // agar tab bar tetap bisa
    },
    statusCard: {
      maxWidth: 980,
      margin: "0 auto",
      borderRadius: 18,
      background: dark ? "rgba(11,11,14,0.86)" : "rgba(255,255,255,0.88)",
      border: `1px solid ${border}`,
      padding: 12,
      backdropFilter: "blur(14px)",
      pointerEvents: "auto",
      boxShadow: dark ? "0 10px 30px rgba(0,0,0,0.35)" : "0 10px 30px rgba(0,0,0,0.10)",
    },
    statusHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
    statusTitle: { fontWeight: 900, fontSize: 14 },
    statusSub: { fontSize: 12, color: sub, fontWeight: 800 },

    chipRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
    chip: {
      fontSize: 12,
      fontWeight: 900,
      padding: "8px 10px",
      borderRadius: 999,
      border: `1px solid ${border}`,
      background: panel,
      color: text,
    },
    chipOk: { borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.12)" },
    chipBad: { borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.12)" },

    progressRow: { marginTop: 10, display: "grid", gap: 8 },
    progressLabel: { fontSize: 12, fontWeight: 900, color: sub },
    progressBarOuter: { height: 10, borderRadius: 999, background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", overflow: "hidden" },
    progressBarInner: { height: 10, borderRadius: 999, background: orange, transition: "width 200ms linear" },

    rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10 },

    primaryBtn: {
      width: "100%",
      marginTop: 10,
      padding: "12px 14px",
      borderRadius: 16,
      border: "none",
      background: orange,
      color: "#fff",
      fontWeight: 900,
    },
    secondaryBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${border}`,
      background: panel,
      color: text,
      fontWeight: 900,
      cursor: "pointer",
    },

    spinner: {
      width: 16,
      height: 16,
      borderRadius: 999,
      border: `2px solid ${dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.55)"}`,
      borderTopColor: "#fff",
      display: "inline-block",
      animation: "spin 0.9s linear infinite",
    },

    errorBox: {
      marginTop: 10,
      padding: 12,
      borderRadius: 14,
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.25)",
      color: dark ? "#FCA5A5" : "#991B1B",
      fontWeight: 800,
      fontSize: 12,
      whiteSpace: "pre-wrap",
    },

    // scenes
    sceneCard: {
      borderRadius: 18,
      padding: 12,
      border: `1px solid ${border}`,
      background: panel,
    },
    sceneTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    sceneBadge: {
      fontWeight: 900,
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(249,115,22,0.18)",
      border: "1px solid rgba(249,115,22,0.28)",
      color: text,
    },
    miniLabel: { fontSize: 12, fontWeight: 900, color: sub, marginBottom: 6 },
    miniBox: {
      borderRadius: 14,
      padding: 10,
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
      border: `1px solid ${border}`,
      color: text,
      fontWeight: 700,
      fontSize: 13,
      whiteSpace: "pre-wrap",
    },
    stepperRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 },
    step: {
      padding: "8px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      border: `1px solid ${border}`,
      background: panel,
      color: sub,
    },
    stepActive: { background: "rgba(249,115,22,0.22)", color: text, borderColor: "rgba(249,115,22,0.35)" },

    sceneActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, justifyContent: "space-between" },

    // tab bar
    tabBar: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 30,
      padding: 12,
      paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
      background: "transparent",
    },
    tabBarInner: {
      maxWidth: 520,
      margin: "0 auto",
      display: "flex",
      gap: 10,
      padding: 10,
      borderRadius: 18,
      background: dark ? "rgba(11,11,14,0.86)" : "rgba(255,255,255,0.88)",
      backdropFilter: "blur(16px)",
      border: `1px solid ${border}`,
      boxShadow: dark ? "0 10px 30px rgba(0,0,0,0.35)" : "0 10px 30px rgba(0,0,0,0.10)",
    },
    tabBtn: {
      flex: 1,
      border: "none",
      borderRadius: 14,
      padding: "12px 10px",
      fontWeight: 900,
      cursor: "pointer",
      background: "transparent",
      color: sub,
    },
    tabBtnActive: {
      background: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
      color: text,
    },

    credit: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: "calc(74px + env(safe-area-inset-bottom) + 6px)",
      display: "flex",
      justifyContent: "center",
      zIndex: 24,
      fontSize: 12,
      fontWeight: 900,
      color: sub,
      pointerEvents: "none",
    },
  };
}

/* Inject keyframes once */
if (typeof document !== "undefined") {
  const id = "__studio_spin_keyframes__";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`;
    document.head.appendChild(style);
  }
}
