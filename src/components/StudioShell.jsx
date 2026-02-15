// src/components/StudioShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const LS_THEME = "ugc_theme"; // "dark" | "light"
const LS_LANG = "ugc_lang";   // "id" | "en"
const TABS = ["Settings", "Scenes", "Export"];

const i18n = {
  id: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Bahasa",
    light: "Light",
    dark: "Dark",
    logout: "Logout",
    provider: "AI Brain",
    autofillLink: "Product page URL (optional)",
    autofillBtn: "Auto-fill from Link",
    analyzing: "Analyzing…",
    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds / scene",
    core: "Core",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    tone: "Tone (optional)",
    targetAudience: "Target audience (optional)",
    assets: "Assets (optional)",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    saveDraft: "Save Draft",
    generate: "Generate Plan",
    generating: "Generating…",
    status: "Status",
    show: "Show",
    minimize: "Minimize",
    noBlueprint: "No blueprint yet. Generate it in Settings.",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    providerLabel: "Provider",
  },
  en: {
    studio: "Studio",
    settings: "Settings",
    scenes: "Scenes",
    export: "Export",
    language: "Language",
    light: "Light",
    dark: "Dark",
    logout: "Logout",
    provider: "AI Brain",
    autofillLink: "Product page URL (optional)",
    autofillBtn: "Auto-fill from Link",
    analyzing: "Analyzing…",
    formatTiming: "Format & Timing",
    platform: "Platform",
    aspectRatio: "Aspect ratio",
    sceneCount: "Scene count",
    secondsPerScene: "Seconds / scene",
    core: "Core",
    brand: "Brand *",
    productType: "Product type *",
    material: "Material *",
    tone: "Tone (optional)",
    targetAudience: "Target audience (optional)",
    assets: "Assets (optional)",
    modelRef: "Model reference (optional)",
    productRef: "Product reference (optional)",
    saveDraft: "Save Draft",
    generate: "Generate Plan",
    generating: "Generating…",
    status: "Status",
    show: "Show",
    minimize: "Minimize",
    noBlueprint: "No blueprint yet. Generate it in Settings.",
    openJson: "Open JSON",
    downloadJson: "Download JSON",
    providerLabel: "Provider",
  },
};

function safeJsonParseLoose(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const m = String(raw).match(/\{[\s\S]*\}$/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    return null;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** ========= blueprint parser (support multiple formats) ========= */
function extractScenes(bp) {
  if (!bp) return [];
  // newest: ugc_blueprint_v1.creative_specs.scenes
  const a = bp?.ugc_blueprint_v1?.creative_specs?.scenes;
  if (Array.isArray(a)) return a;

  // older: creative_specs.scenes
  const b = bp?.creative_specs?.scenes;
  if (Array.isArray(b)) return b;

  // storyboard beats
  const beats = bp?.storyboard?.beats;
  if (Array.isArray(beats)) return beats.map((x, i) => ({ ...x, id: x.id || `S${i + 1}` }));

  const beats2 = bp?.segments?.storyboard?.beats;
  if (Array.isArray(beats2)) return beats2.map((x, i) => ({ ...x, id: x.id || `S${i + 1}` }));

  return [];
}

function LangToggle({ lang, setLang }) {
  const t = i18n[lang] || i18n.id;
  return (
    <div className="ugc-pill">
      <span className="ugc-pill-label">{t.language}</span>
      <button
        type="button"
        className={`ugc-pill-btn ${lang === "id" ? "active" : ""}`}
        onClick={() => setLang("id")}
      >
        ID
      </button>
      <button
        type="button"
        className={`ugc-pill-btn ${lang === "en" ? "active" : ""}`}
        onClick={() => setLang("en")}
      >
        EN
      </button>
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="ugc-pill-btn" onClick={() => setTheme(next)}>
      {next === "dark" ? "Dark" : "Light"}
    </button>
  );
}

function OpenDownloadBlueprintButtons({ blueprint, t }) {
  function openJson() {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `
      <pre style="white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; padding:16px;">
${escapeHtml(JSON.stringify(blueprint, null, 2))}
      </pre>`;
    w.document.write(html);
    w.document.close();
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "blueprint.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button type="button" className="ugc-btn small" onClick={openJson}>
        {t.openJson}
      </button>
      <button type="button" className="ugc-btn small" onClick={downloadJson}>
        {t.downloadJson}
      </button>
    </div>
  );
}

export default function StudioShell({ onLogout }) {
  const [tab, setTab] = useState("Settings");
  const [lang, setLang] = useState(() => localStorage.getItem(LS_LANG) || "id");
  const [theme, setTheme] = useState(() => localStorage.getItem(LS_THEME) || "dark");

  const [projectDraft, setProjectDraft] = useState(() => {
    try {
      const raw = localStorage.getItem(DEFAULT_PROJECT);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [blueprint, setBlueprint] = useState(() => {
    try {
      const raw = localStorage.getItem(`${DEFAULT_PROJECT}::blueprint`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);

  const t = i18n[lang] || i18n.id;

  // persist lang/theme
  useEffect(() => {
    localStorage.setItem(LS_LANG, lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(LS_THEME, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // persist drafts
  useEffect(() => {
    try {
      localStorage.setItem(DEFAULT_PROJECT, JSON.stringify(projectDraft || {}));
    } catch {}
  }, [projectDraft]);

  useEffect(() => {
    try {
      localStorage.setItem(`${DEFAULT_PROJECT}::blueprint`, JSON.stringify(blueprint || null));
    } catch {}
  }, [blueprint]);

  const scenes = useMemo(() => extractScenes(blueprint), [blueprint]);

  async function generatePlan() {
    setPlanError("");
    setLoadingPlan(true);
    try {
      const payload = {
        project: projectDraft,
        provider: (projectDraft?.provider || "bedrock").toLowerCase(),
        lang,
      };

      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await r.text();
      const json = raw ? safeJsonParseLoose(raw) : null;

      if (!r.ok || !json) throw new Error(json?.error || `Plan failed (${r.status})`);
      setBlueprint(json);
      setTab("Scenes");
      setStatusOpen(false);
    } catch (e) {
      setPlanError(e?.message || String(e));
    } finally {
      setLoadingPlan(false);
    }
  }

  function SettingsTab() {
    const p = projectDraft || {};
    const setP = (fn) => setProjectDraft((prev) => (typeof fn === "function" ? fn(prev || {}) : fn));

    function update(key, value) {
      setP((prev) => ({ ...(prev || {}), [key]: value }));
    }

    return (
      <div className="ugc-container">
        <div className="ugc-card">
          <div className="ugc-cardheader">
            <div className="ugc-cardtitle">{t.settings}</div>
            <div className="ugc-cardsub">{t.formatTiming}</div>
          </div>

          <div className="ugc-grid2">
            <div>
              <div className="ugc-label">{t.secondsPerScene}</div>
              <select
                className="ugc-select"
                value={p.seconds_per_scene || "8s"}
                onChange={(e) => update("seconds_per_scene", e.target.value)}
              >
                <option value="6s">6s</option>
                <option value="8s">8s</option>
                <option value="10s">10s</option>
              </select>
            </div>

            <div>
              <div className="ugc-label">{t.sceneCount}</div>
              <select
                className="ugc-select"
                value={String(p.scene_count || 4)}
                onChange={(e) => update("scene_count", Number(e.target.value))}
              >
                {[3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="ugc-label">{t.brand}</div>
              <input
                className="ugc-input"
                value={p.brand || ""}
                onChange={(e) => update("brand", e.target.value)}
                placeholder="Zalora"
              />
            </div>

            <div>
              <div className="ugc-label">{t.productType}</div>
              <input
                className="ugc-input"
                value={p.product_type || ""}
                onChange={(e) => update("product_type", e.target.value)}
                placeholder="Baju koko"
              />
            </div>

            <div>
              <div className="ugc-label">{t.material}</div>
              <input
                className="ugc-input"
                value={p.material || ""}
                onChange={(e) => update("material", e.target.value)}
                placeholder="Katun"
              />
            </div>

            <div>
              <div className="ugc-label">{t.tone}</div>
              <input
                className="ugc-input"
                value={p.tone || ""}
                onChange={(e) => update("tone", e.target.value)}
                placeholder="natural gen-z"
              />
            </div>

            <div>
              <div className="ugc-label">{t.targetAudience}</div>
              <input
                className="ugc-input"
                value={p.target_audience || ""}
                onChange={(e) => update("target_audience", e.target.value)}
                placeholder="pria 18-34"
              />
            </div>

            <div>
              <div className="ugc-label">{t.autofillLink}</div>
              <input
                className="ugc-input"
                value={p.product_page_url || ""}
                onChange={(e) => update("product_page_url", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div className="ugc-label">{t.assets}</div>

          <div className="ugc-grid2">
            <div>
              <div className="ugc-label">{t.modelRef}</div>
              <ImageUploadField
                kind="model"
                projectId={DEFAULT_PROJECT}
                value={p.model_ref_url || ""}
                onUrl={(url) => update("model_ref_url", url)}
              />
            </div>

            <div>
              <div className="ugc-label">{t.productRef}</div>
              <ImageUploadField
                kind="product"
                projectId={DEFAULT_PROJECT}
                value={p.product_ref_url || ""}
                onUrl={(url) => update("product_ref_url", url)}
              />
            </div>
          </div>

          {planError ? <div style={{ marginTop: 12 }} className="ugc-muted-box">{planError}</div> : null}

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="ugc-btn" onClick={() => setBlueprint(null)}>
              {t.saveDraft}
            </button>

            <button
              type="button"
              className="ugc-btn primary"
              onClick={generatePlan}
              disabled={loadingPlan}
            >
              {loadingPlan ? t.generating : t.generate}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function ScenesTab() {
    return (
      <div className="ugc-container">
        <div className="ugc-card">
          <div className="ugc-cardheader">
            <div className="ugc-cardtitle">{t.scenes}</div>
            <div className="ugc-cardsub">plan → image → approve → video → audio</div>
          </div>

          {!blueprint ? (
            <div className="ugc-muted-box">{t.noBlueprint}</div>
          ) : scenes.length === 0 ? (
            <div className="ugc-muted-box">Blueprint exists, but scenes/beats not readable.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {scenes.map((s, idx) => {
                const id = s.id || `S${idx + 1}`;
                const title = s.on_screen || s.title || s.headline || `Scene ${idx + 1}`;
                const cam = s.camera_angle || s.shot || s.camera || "";
                const range = s.time_range || s.time || s.duration || "";
                return (
                  <div key={id} className="ugc-card" style={{ padding: 12, boxShadow: "none" }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="ugc-chip ok">{id}</span>
                      <span style={{ fontWeight: 900 }}>{String(title)}</span>
                      {range ? <span className="ugc-chip">{String(range)}</span> : null}
                      {cam ? <span className="ugc-chip">{String(cam)}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {blueprint ? (
            <div style={{ marginTop: 12 }}>
              <OpenDownloadBlueprintButtons blueprint={blueprint} t={t} />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function ExportTab() {
    return (
      <div className="ugc-container">
        <div className="ugc-card">
          <div className="ugc-cardheader">
            <div className="ugc-cardtitle">{t.export}</div>
            <div className="ugc-cardsub">Blueprint JSON</div>
          </div>

          {blueprint ? (
            <OpenDownloadBlueprintButtons blueprint={blueprint} t={t} />
          ) : (
            <div className="ugc-muted-box">{t.noBlueprint}</div>
          )}
        </div>
      </div>
    );
  }

  const content = useMemo(() => {
    if (tab === "Scenes") return <ScenesTab />;
    if (tab === "Export") return <ExportTab />;
    return <SettingsTab />;
  }, [tab, blueprint, scenes, loadingPlan, planError, lang]);

  // status chips (dummy values; nanti bisa kamu hook ke progress real)
  const chips = [
    { label: "Core ✓", ok: true },
    { label: "Model ×", ok: false },
    { label: "Product ×", ok: false },
    { label: "≈ 32s", ok: null },
  ];

  return (
    <div className="ugc-page">
      {/* Topbar */}
      <div className="ugc-topbar">
        <div className="ugc-topbar-inner">
          <div className="ugc-title">{t.studio}</div>

          <div className="ugc-top-actions">
            <LangToggle lang={lang} setLang={setLang} />
            <ThemeToggle theme={theme} setTheme={setTheme} />
            {typeof onLogout === "function" ? (
              <button type="button" className="ugc-pill-btn" onClick={onLogout}>
                {t.logout}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main content */}
      {content}

      {/* Status Dock */}
      <div className={`ugc-status ${statusOpen ? "" : "collapsed"}`}>
        <div className="ugc-status-inner">
          <div className="ugc-status-head">
            <div className="ugc-status-title">{t.status}</div>
            <button
              type="button"
              className="ugc-btn small"
              onClick={() => setStatusOpen((v) => !v)}
            >
              {statusOpen ? t.minimize : t.show}
            </button>
          </div>

          {/* collapsed view: keep animation */}
          {!statusOpen ? (
            <div className="ugc-progress">
              <div className="ugc-progress-track">
                <div className="ugc-progress-shimmer" />
              </div>
            </div>
          ) : (
            <>
              <div className="ugc-chiprow">
                {chips.map((c, i) => (
                  <span
                    key={i}
                    className={`ugc-chip ${
                      c.ok === true ? "ok" : c.ok === false ? "bad" : ""
                    }`}
                  >
                    {c.label}
                  </span>
                ))}
                <span className="ugc-chip">{t.providerLabel}: BEDROCK</span>
              </div>

              <div className="ugc-progress">
                <div className="ugc-progress-track">
                  <div className="ugc-progress-shimmer" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Credit */}
      <div className="ugc-credit">Created by @adryndian</div>

      {/* Bottom Navigation (moved from top) */}
      <div className="ugc-tabbar">
        <div className="ugc-tabbar-inner">
          {TABS.map((x) => (
            <button
              key={x}
              type="button"
              className={`ugc-tab ${tab === x ? "active" : ""}`}
              onClick={() => setTab(x)}
            >
              {x === "Settings" ? t.settings : x === "Scenes" ? t.scenes : t.export}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
