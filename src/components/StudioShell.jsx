// src/components/StudioShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Settings", "Scenes", "Export"];

const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

/* =========================
   Blueprint Normalizer
   - bikin "beats" konsisten untuk UI
   ========================= */

function normalizeBlueprint(raw) {
  if (!raw) return { raw: null, beats: [], meta: {} };

  // 1) Schema "baru" (yang kamu harapkan)
  const beatsA =
    raw?.storyboard?.beats ||
    raw?.SEGMENT_3?.storyboard?.beats ||
    raw?.segments?.storyboard?.beats ||
    raw?.blueprint?.storyboard?.beats;

  if (Array.isArray(beatsA) && beatsA.length) {
    return {
      raw,
      beats: beatsA.map((b, idx) => ({
        id: b.id || `S${idx + 1}`,
        goal: b.goal || b.purpose || "SCENE",
        time_window: b.time_window || b.duration || b.duration_seconds ? `${b.duration_seconds || ""}s` : "",
        action: b.action || b.visual || b.visual_elements?.join(", ") || "",
        on_screen_text: b.on_screen_text || b.text_overlay || "",
        camera: b.camera || b.camera_movement || "",
        negative_prompt: Array.isArray(b.negative_prompt) ? b.negative_prompt : []
      })),
      meta: {
        project_id: raw?.project_id || raw?.meta?.project_id
      }
    };
  }

  // 2) Schema file kamu: ugc_prompt_os_v1.scene_breakdown[]
  const v1 = raw?.ugc_prompt_os_v1;
  const scenes = v1?.scene_breakdown;

  if (Array.isArray(scenes) && scenes.length) {
    const overlays = Array.isArray(v1?.gen_z_optimization?.text_overlays)
      ? v1.gen_z_optimization.text_overlays
      : [];

    const beats = scenes.map((s, idx) => ({
      id: `S${s.scene_number || idx + 1}`,
      goal: s.purpose || "SCENE",
      time_window: `${Number(s.duration_seconds || 0) || ""}s`.trim(),
      action: Array.isArray(s.visual_elements) ? s.visual_elements.join(", ") : "",
      on_screen_text: overlays[idx] || "",
      camera: s.camera_movement || "",
      negative_prompt: [] // schema ini belum punya negative_prompt per scene
    }));

    return {
      raw,
      beats,
      meta: {
        project_id: v1?.project_id,
        brand: v1?.brand,
        platform: v1?.platform,
        aspect_ratio: v1?.aspect_ratio
      }
    };
  }

  // fallback
  return { raw, beats: [], meta: {} };
}

/* =========================
   Tiny Toast (tanpa library)
   ========================= */
function useToast() {
  const [toast, setToast] = useState(null);
  function show(message, type = "ok", ms = 2200) {
    setToast({ message, type });
    window.clearTimeout(show._t);
    show._t = window.setTimeout(() => setToast(null), ms);
  }
  return { toast, show, clear: () => setToast(null) };
}

/* =========================
   Main
   ========================= */

export default function StudioShell() {
  const [tab, setTab] = useState("Settings");

  // global studio state
  const [projectDraft, setProjectDraft] = useState({
    ...DEFAULT_PROJECT,
    ai_brain: "bedrock",
    // optional link autofill
    product_page_url: ""
  });

  const [blueprint, setBlueprint] = useState(null);
  const normalized = useMemo(() => normalizeBlueprint(blueprint), [blueprint]);

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [statusCollapsed, setStatusCollapsed] = useState(false);

  // progress/ETA
  const [elapsedSec, setElapsedSec] = useState(0);
  const startRef = useRef(0);
  const abortRef = useRef(null);

  const { toast, show: toastShow } = useToast();

  // theme + lang
  const [dark, setDark] = useState(true);
  const [lang, setLang] = useState("id"); // id | en

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const t = useMemo(() => {
    const dict = {
      id: {
        studio: "Studio",
        settings: "Settings",
        scenes: "Scenes",
        export: "Export",
        language: "Bahasa",
        dark: "Dark",
        light: "Light",
        aiBrain: "AI Brain",
        autofillLink: "Auto-fill dari Link",
        pageUrl: "Product / Landing page URL",
        autofillImages: "Auto-fill dari Images",
        formatTiming: "Format & Timing",
        platform: "Platform",
        ratio: "Aspect ratio",
        sceneCount: "Scene count",
        secondsPer: "Seconds / scene",
        coreInputs: "Core Inputs",
        brand: "Brand",
        productType: "Product type",
        material: "Material",
        assetsOptional: "Assets (optional)",
        modelRef: "Model reference",
        productRef: "Product reference",
        status: "Status",
        minimize: "Minimize",
        show: "Show",
        provider: "Provider",
        eta: "ETA",
        elapsed: "Elapsed",
        generate: "Generate Plan",
        generating: "Generating…",
        cancel: "Cancel",
        openJson: "Open JSON",
        downloadJson: "Download JSON",
        noBlueprint: "Belum ada blueprint. Generate dulu di Settings.",
        beatsNotReadable: "Blueprint ada, tapi beats tidak terbaca.",
        success: "Generate success ✓",
        analyzeSuccess: "Auto-fill sukses ✓",
        analyzeFail: "Auto-fill gagal"
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
        autofillLink: "Auto-fill from Link",
        pageUrl: "Product / Landing page URL",
        autofillImages: "Auto-fill from Images",
        formatTiming: "Format & Timing",
        platform: "Platform",
        ratio: "Aspect ratio",
        sceneCount: "Scene count",
        secondsPer: "Seconds / scene",
        coreInputs: "Core Inputs",
        brand: "Brand",
        productType: "Product type",
        material: "Material",
        assetsOptional: "Assets (optional)",
        modelRef: "Model reference",
        productRef: "Product reference",
        status: "Status",
        minimize: "Minimize",
        show: "Show",
        provider: "Provider",
        eta: "ETA",
        elapsed: "Elapsed",
        generate: "Generate Plan",
        generating: "Generating…",
        cancel: "Cancel",
        openJson: "Open JSON",
        downloadJson: "Download JSON",
        noBlueprint: "No blueprint yet. Generate from Settings.",
        beatsNotReadable: "Blueprint exists, but beats not readable.",
        success: "Generate success ✓",
        analyzeSuccess: "Auto-fill success ✓",
        analyzeFail: "Auto-fill failed"
      }
    };
    return dict[lang] || dict.id;
  }, [lang]);

  const ctx = {
    tab,
    setTab,
    projectDraft,
    setProjectDraft,
    blueprint,
    setBlueprint,
    normalized,
    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,
    statusCollapsed,
    setStatusCollapsed,
    elapsedSec,
    setElapsedSec,
    dark,
    setDark,
    lang,
    setLang,
    toast,
    toastShow
  };

  const content = useMemo(() => {
    if (tab === "Settings") return <SettingsTab />;
    if (tab === "Scenes") return <ScenesTab />;
    return <ExportTab />;
  }, [tab]);

  return (
    <StudioContext.Provider value={ctx}>
      <div className="ugc-page">
        <TopBar />

        <div className="ugc-container">{content}</div>

        <StatusDock />

        <BottomTabs />

        {/* static credit */}
        <div className="ugc-credit">Created by @adryndian</div>

        {/* toast */}
        {toast ? (
          <div className={`ugc-toast ${toast.type === "bad" ? "bad" : "ok"}`}>
            {toast.message}
          </div>
        ) : null}
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   TOP BAR
   ========================= */

function TopBar() {
  const { lang, setLang, dark, setDark } = useStudio();
  const labelLang = lang === "id" ? "Bahasa" : "Language";
  return (
    <div className="ugc-topbar">
      <div className="ugc-topbar-inner">
        <div className="ugc-title">Studio</div>
        <div className="ugc-top-actions">
          <div className="ugc-pill">
            <span className="ugc-pill-label">{labelLang}</span>
            <button
              className={`ugc-pill-btn ${lang === "id" ? "active" : ""}`}
              onClick={() => setLang("id")}
              type="button"
            >
              ID
            </button>
            <button
              className={`ugc-pill-btn ${lang === "en" ? "active" : ""}`}
              onClick={() => setLang("en")}
              type="button"
            >
              EN
            </button>
          </div>

          <button className="ugc-btn ghost" onClick={() => setDark((v) => !v)} type="button">
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   BOTTOM TABS
   ========================= */

function BottomTabs() {
  const { tab, setTab } = useStudio();
  return (
    <div className="ugc-tabbar">
      <div className="ugc-tabbar-inner">
        {TABS.map((t) => (
          <button
            key={t}
            className={`ugc-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
            type="button"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

/* =========================
   STATUS DOCK (minimize)
   ========================= */

function StatusDock() {
  const {
    projectDraft,
    blueprint,
    normalized,
    loadingPlan,
    planError,
    statusCollapsed,
    setStatusCollapsed,
    elapsedSec
  } = useStudio();

  const sceneCount = Number(projectDraft.scene_count || 0);
  const secondsPer = Number(projectDraft.seconds_per_scene || 0);
  const est = sceneCount * secondsPer;

  const coreOk = Boolean((projectDraft.brand || "").trim() && (projectDraft.product_type || "").trim() && (projectDraft.material || "").trim());
  const modelOk = Boolean((projectDraft.model_ref_url || "").trim());
  const productOk = Boolean((projectDraft.product_ref_url || "").trim());

  const provider = (projectDraft.ai_brain || "bedrock").toUpperCase();

  // "fake progress" tapi stabil & gak stuck: max 92% sebelum selesai
  const progress = useMemo(() => {
    if (!loadingPlan) return blueprint ? 100 : 0;
    const p = est > 0 ? Math.min(0.92, elapsedSec / Math.max(8, est)) : Math.min(0.92, elapsedSec / 20);
    return Math.round(p * 100);
  }, [loadingPlan, elapsedSec, est, blueprint]);

  return (
    <div className={`ugc-status ${statusCollapsed ? "collapsed" : ""}`}>
      <div className="ugc-status-inner">
        <div className="ugc-status-head">
          <div className="ugc-status-title">Status</div>
          <button
            className="ugc-btn ghost small"
            type="button"
            onClick={() => setStatusCollapsed((v) => !v)}
          >
            {statusCollapsed ? "Show" : "Minimize"}
          </button>
        </div>

        {!statusCollapsed ? (
          <>
            <div className="ugc-chiprow">
              <Chip tone={coreOk ? "ok" : "bad"}>Core {coreOk ? "✓" : "✗"}</Chip>
              <Chip tone={modelOk ? "ok" : "bad"}>Model {modelOk ? "✓" : "✗"}</Chip>
              <Chip tone={productOk ? "ok" : "bad"}>Product {productOk ? "✓" : "✗"}</Chip>
              <Chip>≈ {est || 0}s</Chip>
              <Chip>{provider}</Chip>
              <Chip>{normalized?.beats?.length ? `${normalized.beats.length} scenes` : ""}</Chip>
            </div>

            <div className="ugc-progress">
              <div className="ugc-progress-track">
                <div className="ugc-progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <div className="ugc-progress-meta">
                <span>Elapsed: {fmtTime(elapsedSec)}</span>
                {loadingPlan ? <span className="ugc-spinner" /> : null}
              </div>
            </div>

            {planError ? <div className="ugc-error">{planError}</div> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* =========================
   TABS
   ========================= */

function ScenesTab() {
  const { normalized, setTab } = useStudio();
  const beats = normalized?.beats || [];

  if (!normalized?.raw) {
    return (
      <Card>
        <CardHeader title="Scenes" />
        <div className="ugc-muted">Belum ada blueprint. Generate dulu di Settings.</div>
        <div style={{ marginTop: 12 }}>
          <button className="ugc-btn primary" type="button" onClick={() => setTab("Settings")}>
            Go to Settings
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Scenes" sub="plan → image → approve → video → audio" />
      {beats.length === 0 ? (
        <div className="ugc-muted-box">Blueprint ada, tapi beats tidak terbaca.</div>
      ) : (
        <div className="ugc-list">
          {beats.map((b, idx) => (
            <div className="ugc-scene" key={`${b.id}-${idx}`}>
              <div className="ugc-scene-top">
                <div className="ugc-badge">{b.id}</div>
                <div className="ugc-scene-title">{b.goal}</div>
                {b.time_window ? <Chip>{b.time_window}</Chip> : null}
              </div>

              {b.action ? (
                <div className="ugc-row">
                  <div className="ugc-row-label">Action</div>
                  <div className="ugc-row-val">{b.action}</div>
                </div>
              ) : null}

              {b.on_screen_text ? (
                <div className="ugc-row">
                  <div className="ugc-row-label">On-screen</div>
                  <div className="ugc-row-val">{b.on_screen_text}</div>
                </div>
              ) : null}

              {b.camera ? (
                <div className="ugc-row">
                  <div className="ugc-row-label">Camera</div>
                  <div className="ugc-row-val">{b.camera}</div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SettingsTab() {
  const {
    projectDraft,
    setProjectDraft,
    setBlueprint,
    setTab,
    loadingPlan,
    setLoadingPlan,
    planError,
    setPlanError,
    setElapsedSec,
    toastShow
  } = useStudio();

  const [p, setP] = useState(projectDraft);
  const [analyzingImg, setAnalyzingImg] = useState(false);
  const [analyzingLink, setAnalyzingLink] = useState(false);

  useEffect(() => {
    // keep draft in sync on mount changes
    setP(projectDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coreOk =
    (p.brand || "").trim() &&
    (p.product_type || "").trim() &&
    (p.material || "").trim() &&
    (p.platform || "").trim() &&
    (p.aspect_ratio || "").trim() &&
    String(p.scene_count || "").trim() &&
    String(p.seconds_per_scene || "").trim();

  const canGenerate = Boolean(coreOk); // assets optional sesuai request kamu

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  async function autoFillFromImages() {
    if (analyzingImg) return;
    if (!(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim()) return;

    setPlanError("");
    setAnalyzingImg(true);
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
      const json = raw ? JSON.parse(raw) : null;
      if (!r.ok || !json?.ok) throw new Error(json?.error || `Analyze failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : f.brand || "",
        product_type: prev.product_type?.trim() ? prev.product_type : f.product_type || "",
        material: prev.material?.trim() ? prev.material : f.material || "",
        tone: prev.tone?.trim() ? prev.tone : f.tone || prev.tone || "natural gen-z"
      }));

      toastShow("Auto-fill success ✓", "ok");
    } catch (e) {
      setPlanError(`${String(e?.message || e)}`);
      toastShow("Auto-fill failed", "bad");
    } finally {
      setAnalyzingImg(false);
    }
  }

  async function autoFillFromLink() {
    if (analyzingLink) return;
    if (!(p.product_page_url || "").trim()) return;

    setPlanError("");
    setAnalyzingLink(true);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_page_url: p.product_page_url
        })
      });
      const raw = await r.text();
      const json = raw ? JSON.parse(raw) : null;
      if (!r.ok || !json?.ok) throw new Error(json?.error || `Analyze failed (${r.status})`);

      const f = json.fields || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : f.brand || "",
        product_type: prev.product_type?.trim() ? prev.product_type : f.product_type || "",
        material: prev.material?.trim() ? prev.material : f.material || "",
        tone: prev.tone?.trim() ? prev.tone : f.tone || prev.tone || "natural gen-z"
      }));

      toastShow("Auto-fill success ✓", "ok");
    } catch (e) {
      setPlanError(`${String(e?.message || e)}`);
      toastShow("Auto-fill failed", "bad");
    } finally {
      setAnalyzingLink(false);
    }
  }

  async function generatePlanOnce() {
    if (!canGenerate || loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);

    setElapsedSec(0);
    const started = Date.now();
    const tick = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 250);

    const provider = (p.ai_brain || "bedrock").toLowerCase();

    const ctrl = new AbortController();
    // expose abort to Status cancel
    window.__ugcAbort = () => ctrl.abort();

    const timeoutMs = 120000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      // persist draft
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
        throw new Error(`Non-JSON response (${r.status}). Preview: ${String(raw).slice(0, 200)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Plan failed (${r.status})`);
      if (!json?.blueprint) throw new Error("Plan OK tapi blueprint kosong.");

      setBlueprint(json.blueprint);
      toastShow("Generate success ✓", "ok");
      setTab("Scenes");
    } catch (e) {
      if (e?.name === "AbortError") {
        setPlanError(`Canceled / timeout.`);
      } else {
        setPlanError(e?.message || String(e));
      }
      toastShow("Generate failed", "bad");
    } finally {
      clearTimeout(timer);
      clearInterval(tick);
      setLoadingPlan(false);
      window.__ugcAbort = null;
    }
  }

  return (
    <Card>
      <CardHeader title="Settings" />

      <Section title="AI Brain">
        <Field label="AI Brain">
          <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
            <option value="bedrock">Bedrock</option>
            <option value="gemini">Gemini</option>
          </Select>
        </Field>
      </Section>

      <Section title="Auto-fill (optional)">
        <Field label="Product / Landing page URL">
          <Input
            value={p.product_page_url || ""}
            onChange={(e) => update("product_page_url", e.target.value)}
            placeholder="https://..."
          />
        </Field>

        <div className="ugc-row-actions">
          <button
            className="ugc-btn ghost"
            type="button"
            disabled={analyzingLink || !(p.product_page_url || "").trim()}
            onClick={autoFillFromLink}
          >
            {analyzingLink ? "Analyzing…" : "Auto-fill from Link"}
          </button>

          <button
            className="ugc-btn ghost"
            type="button"
            disabled={analyzingImg || !(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim()}
            onClick={autoFillFromImages}
          >
            {analyzingImg ? "Analyzing…" : "Auto-fill from Images"}
          </button>
        </div>
      </Section>

      <Section title="Format & Timing">
        <Grid2>
          <Field label="Platform">
            <Select value={p.platform} onChange={(e) => update("platform", e.target.value)}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram Reels</option>
              <option value="facebook">Facebook Reels</option>
              <option value="youtube">YouTube Shorts</option>
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
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Seconds / scene">
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
      </Section>

      <Section title="Core Inputs">
        <Grid2>
          <Field label="Brand *">
            <Input value={p.brand || ""} onChange={(e) => update("brand", e.target.value)} placeholder="Brand" />
          </Field>
          <Field label="Product type *">
            <Input
              value={p.product_type || ""}
              onChange={(e) => update("product_type", e.target.value)}
              placeholder="sunscreen, hoodie, coffee"
            />
          </Field>
          <Field label="Material *">
            <Input
              value={p.material || ""}
              onChange={(e) => update("material", e.target.value)}
              placeholder="cotton, serum gel, stainless"
            />
          </Field>
        </Grid2>
      </Section>

      <Section title="Assets (optional)">
        <Grid2>
          <ImageUploadField
            label="Model reference"
            kind="model"
            projectId={p.project_id || "local"}
            valueUrl={p.model_ref_url}
            onUrl={(url) => update("model_ref_url", url)}
            optional
            hideUrl
            showPreview
          />
          <ImageUploadField
            label="Product reference"
            kind="product"
            projectId={p.project_id || "local"}
            valueUrl={p.product_ref_url}
            onUrl={(url) => update("product_ref_url", url)}
            optional
            hideUrl
            showPreview
          />
        </Grid2>
      </Section>

      {planError ? <div className="ugc-error">{planError}</div> : null}

      <div className="ugc-generate">
        <button
          className={`ugc-btn primary ${loadingPlan ? "loading" : ""}`}
          type="button"
          disabled={!canGenerate || loadingPlan}
          onClick={generatePlanOnce}
        >
          {loadingPlan ? "Generating…" : "Generate Plan"}
        </button>

        {loadingPlan ? (
          <button
            className="ugc-btn ghost"
            type="button"
            onClick={() => window.__ugcAbort?.()}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </Card>
  );
}

function ExportTab() {
  const { blueprint } = useStudio();

  function download() {
    const data = JSON.stringify(blueprint, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blueprint.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function openJson() {
    const data = JSON.stringify(blueprint, null, 2);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<pre style="white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${escapeHtml(data)}</pre>`);
    w.document.close();
  }

  return (
    <Card>
      <CardHeader title="Export" />
      {!blueprint ? (
        <div className="ugc-muted">Belum ada blueprint.</div>
      ) : (
        <div className="ugc-row-actions">
          <button className="ugc-btn ghost" type="button" onClick={openJson}>
            Open JSON
          </button>
          <button className="ugc-btn primary" type="button" onClick={download}>
            Download JSON
          </button>
        </div>
      )}
    </Card>
  );
}

/* =========================
   UI atoms
   ========================= */

function Card({ children }) {
  return <div className="ugc-card">{children}</div>;
}

function CardHeader({ title, sub }) {
  return (
    <div className="ugc-cardheader">
      <div className="ugc-cardtitle">{title}</div>
      {sub ? <div className="ugc-cardsub">{sub}</div> : null}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="ugc-sectiontitle">{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function Grid2({ children }) {
  return <div className="ugc-grid2">{children}</div>;
}

function Field({ label, children }) {
  return (
    <div>
      <div className="ugc-label">{label}</div>
      {children}
    </div>
  );
}

function Input(props) {
  return <input {...props} className="ugc-input" />;
}

function Select(props) {
  return <select {...props} className="ugc-select" />;
}

function Chip({ children, tone }) {
  return <span className={`ugc-chip ${tone ? tone : ""}`}>{children}</span>;
}

function fmtTime(sec) {
  const s = Math.max(0, Number(sec || 0));
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
