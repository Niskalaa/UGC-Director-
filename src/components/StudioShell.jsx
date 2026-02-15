import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";

// LocalStorage keys
const LS_BLUEPRINT = "ugc.blueprint.v1";
const LS_DRAFT = "ugc.draft.v1";
const LS_LANG = "ugc_lang";
const LS_THEME = "ugc_theme";

// ---- helpers
function safeJsonParse(str, fallback = null) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function readTextSafe(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await readTextSafe(res);
  const data = text ? safeJsonParse(text, null) : null;

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(String(msg));
  }

  // kalau server balikin plain JSON object
  return data ?? {};
}

async function getJson(url) {
  const res = await fetch(url, { method: "GET" });
  const text = await readTextSafe(res);
  const data = text ? safeJsonParse(text, null) : null;

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return data ?? {};
}

// Poll /api/jobs/:id until done/failed (max ~45s)
async function pollJob(jobId, { intervalMs = 1200, maxMs = 45000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const j = await getJson(`/api/jobs/${jobId}`);
    if (j?.status === "done" || j?.status === "failed") return j;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Polling timeout (job still running).");
}

// UI bits
function Segmented({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`seg-btn ${value === opt.value ? "is-active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Tabs({ value, onChange, items }) {
  return (
    <div className="tabbar">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          className={`tab ${value === it.value ? "is-active" : ""}`}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <div className="field-head">
        <div className="field-label">{label}</div>
        {hint ? <div className="field-hint">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, disabled, rightSlot }) {
  return (
    <div className={`input-wrap ${disabled ? "is-disabled" : ""}`}>
      <input
        className="input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {rightSlot ? <div className="input-right">{rightSlot}</div> : null}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      className="select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---- main
export default function StudioShell({ onLogout }) {
  // Theme
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(LS_THEME) || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  // Language
  const [lang, setLang] = useState(() => localStorage.getItem(LS_LANG) || "id");
  useEffect(() => localStorage.setItem(LS_LANG, lang), [lang]);

  // Tabs (IMPORTANT: we do NOT unmount tab pages -> use hidden)
  const [tab, setTab] = useState("settings");

  // Draft (settings)
  const [draft, setDraft] = useState(() => {
    const v = safeJsonParse(localStorage.getItem(LS_DRAFT), null);
    return (
      v || {
        scene_count: 4,
        seconds_per_scene: 8,
        aspect_ratio: "9:16",
        platform: "tiktok",
        product_url: "",
        brand: "",
        product_type: "",
        material: "",
        tone: "natural gen-z",
        target_audience: "",
        model_ref_url: "",
        product_ref_url: "",
      }
    );
  });

  // Persist draft (debounced)
  const saveTimer = useRef(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(LS_DRAFT, JSON.stringify(draft));
    }, 200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft]);

  // Blueprint
  const [blueprint, setBlueprint] = useState(() => {
    const v = safeJsonParse(localStorage.getItem(LS_BLUEPRINT), null);
    return v || null;
  });

  useEffect(() => {
    if (blueprint) localStorage.setItem(LS_BLUEPRINT, JSON.stringify(blueprint));
  }, [blueprint]);

  // Status / UI state
  const [busy, setBusy] = useState(false);
  const [statusOpen, setStatusOpen] = useState(true);
  const [statusText, setStatusText] = useState("Ready — BEDROCK");
  const [error, setError] = useState("");

  // Scenes -> generated images
  const [sceneImages, setSceneImages] = useState(() => ({}));
  const [generatingScene, setGeneratingScene] = useState(() => ({}));

  // derived scenes
  const scenes = useMemo(() => {
    if (!blueprint?.scenes || !Array.isArray(blueprint.scenes)) return [];
    return blueprint.scenes;
  }, [blueprint]);

  // ---- actions
  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const handleClearDraft = useCallback(() => {
    // “clean” draft (tanpa nuker default struktur)
    setDraft((d) => ({
      ...d,
      product_url: "",
      brand: "",
      product_type: "",
      material: "",
      tone: "natural gen-z",
      target_audience: "",
      model_ref_url: "",
      product_ref_url: "",
    }));
    setError("");
    setStatusText("Draft cleared.");
  }, []);

  const handleAnalyzeUrl = useCallback(async () => {
    setError("");
    const url = (draft.product_url || "").trim();
    if (!url) {
      setError("Isi Product URL dulu.");
      return;
    }

    setBusy(true);
    setStatusText("Analyzing product URL...");
    try {
      const data = await postJson("/api/scrape", { url });

      // best-effort mapping
      setDraft((d) => ({
        ...d,
        brand: d.brand || data.brand || data.brand_name || "",
        product_type: d.product_type || data.product_type || "",
        material: d.material || data.material || "",
        target_audience: d.target_audience || data.target_audience || "",
      }));

      setStatusText("Analyze success. Fields filled.");
    } catch (e) {
      setError(e?.message || String(e));
      setStatusText("Analyze failed.");
    } finally {
      setBusy(false);
    }
  }, [draft.product_url, draft.brand, draft.product_type, draft.material, draft.target_audience]);

  const handleGenerateBlueprint = useCallback(async () => {
    setError("");

    // minimal validation
    if (!draft.brand?.trim()) return setError("missing brand");
    if (!draft.product_type?.trim()) return setError("missing product type");
    if (!draft.material?.trim()) return setError("missing material");

    // Backend analyze.js kamu memang butuh dua ref URL.
    // Blueprint generator kamu juga (dari laporan) kadang expect keduanya ada.
    if (!draft.model_ref_url?.trim() || !draft.product_ref_url?.trim()) {
      return setError("model_ref_url & product_ref_url required");
    }

    setBusy(true);
    setStatusText("Generating blueprint...");
    try {
      const payload = {
        ...draft,
        scene_count: Number(draft.scene_count || 4),
        seconds_per_scene: Number(draft.seconds_per_scene || 8),
      };

      const bp = await postJson("/api/plan", payload);
      setBlueprint(bp);
      setTab("scenes");
      setStatusText("Blueprint generated successfully.");
    } catch (e) {
      setError(e?.message || String(e));
      setStatusText("Blueprint failed.");
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const handleClearBlueprint = useCallback(() => {
    setBlueprint(null);
    localStorage.removeItem(LS_BLUEPRINT);
    setSceneImages({});
    setGeneratingScene({});
    setError("");
    setStatusText("Blueprint cleared.");
  }, []);

  const handleGenerateSceneImage = useCallback(
    async (sceneIndex) => {
      if (!blueprint?.scenes?.[sceneIndex]) return;

      setError("");
      const sc = blueprint.scenes[sceneIndex];
      const sceneId = String(sc.scene_number ?? sceneIndex + 1);

      // build visual prompt (pakai visual_direction + sedikit guardrail)
      const briefParts = [
        `Scene ${sceneId}`,
        sc.visual_direction || "",
        `On-screen text: ${sc.onscreen_text || ""}`,
        `Style: photorealistic, natural lighting, handheld phone vibe, sharp focus, realistic fabric texture, commercial clean look.`,
        `Aspect ratio: ${draft.aspect_ratio || "9:16"}`,
      ].filter(Boolean);

      const payload = {
        type: "image",
        brief: briefParts.join("\n"),
        settings: {
          aspect_ratio: draft.aspect_ratio || "9:16",
          seed: Math.floor(Math.random() * 1000000),
        },
      };

      setGeneratingScene((p) => ({ ...p, [sceneId]: true }));
      setStatusText(`Generating image for Scene ${sceneId}...`);

      try {
        const result = await postJson("/api/jobs", payload);

        // backend bisa balikin image_url langsung
        if (result?.image_url) {
          setSceneImages((prev) => ({ ...prev, [sceneId]: result.image_url }));
          setStatusText(`Scene ${sceneId} image ready.`);
          return;
        }

        // atau id/job_id untuk polling
        const jobId = result?.id || result?.job_id;
        if (!jobId) throw new Error("Unexpected /api/jobs response (no id).");

        const polled = await pollJob(jobId);
        const out = polled?.image_url || polled?.output_url;
        if (!out) throw new Error("Job done but no output_url/image_url.");

        setSceneImages((prev) => ({ ...prev, [sceneId]: out }));
        setStatusText(`Scene ${sceneId} image ready.`);
      } catch (e) {
        console.error("[StudioShell] Image generation error:", e);
        setError(e?.message || String(e));
        setStatusText(`Scene ${sceneId} failed.`);
      } finally {
        setGeneratingScene((p) => ({ ...p, [sceneId]: false }));
      }
    },
    [blueprint, draft.aspect_ratio]
  );

  // Export JSON
  const handleDownloadJson = useCallback(() => {
    const obj = blueprint || {};
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blueprint.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [blueprint]);

  // UI layout config
  const tabItems = useMemo(
    () => [
      { value: "settings", label: "Settings" },
      { value: "scenes", label: "Scenes" },
      { value: "export", label: "Export" },
    ],
    []
  );

  return (
    <div className="app">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">UGC Studio</div>

          <div className="topbar-actions">
            <Segmented
              value={lang}
              options={[
                { value: "id", label: "ID" },
                { value: "en", label: "EN" },
              ]}
              onChange={setLang}
            />

            <button type="button" className="btn ghost" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? "Light" : "Dark"}
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={onLogout}
              style={{ marginLeft: 6 }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main container */}
      <div className="container">
        {/* SETTINGS (hidden, not unmounted) */}
        <section hidden={tab !== "settings"} className="card">
          <div className="card-title">Settings</div>

          <div className="grid2">
            <Field label="Scene Count">
              <Select
                value={String(draft.scene_count)}
                onChange={(v) => setDraft((d) => ({ ...d, scene_count: Number(v) }))}
                options={[
                  { value: "4", label: "4 beats" },
                  { value: "5", label: "5 beats" },
                  { value: "6", label: "6 beats" },
                ]}
              />
            </Field>

            <Field label="Seconds per Scene">
              <Select
                value={String(draft.seconds_per_scene)}
                onChange={(v) => setDraft((d) => ({ ...d, seconds_per_scene: Number(v) }))}
                options={[
                  { value: "5", label: "5s" },
                  { value: "6", label: "6s" },
                  { value: "8", label: "8s" },
                ]}
              />
            </Field>

            <Field label="Aspect ratio">
              <Select
                value={draft.aspect_ratio}
                onChange={(v) => setDraft((d) => ({ ...d, aspect_ratio: v }))}
                options={[
                  { value: "9:16", label: "9:16" },
                  { value: "1:1", label: "1:1" },
                  { value: "16:9", label: "16:9" },
                ]}
              />
            </Field>

            <Field label="Platform">
              <Select
                value={draft.platform}
                onChange={(v) => setDraft((d) => ({ ...d, platform: v }))}
                options={[
                  { value: "tiktok", label: "TikTok" },
                  { value: "reels", label: "Reels" },
                  { value: "shorts", label: "Shorts" },
                ]}
              />
            </Field>
          </div>

          <Field label="Product URL" hint="Optional. Click Analyze to auto-fill fields.">
            <Input
              value={draft.product_url}
              onChange={(v) => setDraft((d) => ({ ...d, product_url: v }))}
              placeholder="https://shopee.co.id/..."
              rightSlot={
                <button
                  type="button"
                  className="btn"
                  onClick={handleAnalyzeUrl}
                  disabled={busy}
                >
                  Analyze
                </button>
              }
            />
          </Field>

          <div className="grid2">
            <Field label="Brand *">
              <Input
                value={draft.brand}
                onChange={(v) => setDraft((d) => ({ ...d, brand: v }))}
                placeholder="Zalora"
              />
            </Field>

            <Field label="Product type *">
              <Input
                value={draft.product_type}
                onChange={(v) => setDraft((d) => ({ ...d, product_type: v }))}
                placeholder="Baju koko"
              />
            </Field>

            <Field label="Material *">
              <Input
                value={draft.material}
                onChange={(v) => setDraft((d) => ({ ...d, material: v }))}
                placeholder="Katun"
              />
            </Field>

            <Field label="Tone">
              <Input
                value={draft.tone}
                onChange={(v) => setDraft((d) => ({ ...d, tone: v }))}
                placeholder="natural gen-z"
              />
            </Field>

            <Field label="Target audience">
              <Input
                value={draft.target_audience}
                onChange={(v) => setDraft((d) => ({ ...d, target_audience: v }))}
                placeholder="pria 18–34"
              />
            </Field>
          </div>

          <div className="divider" />

          <div className="card-title" style={{ marginTop: 2 }}>
            Reference Images
          </div>

          <div className="grid2">
            <Field label="Model (required)">
              <ImageUploadField
                kind="model"
                projectId="ugc-director"
                onUrl={(url) => setDraft((d) => ({ ...d, model_ref_url: url }))}
                currentUrl={draft.model_ref_url}
              />
            </Field>

            <Field label="Product (required)">
              <ImageUploadField
                kind="product"
                projectId="ugc-director"
                onUrl={(url) => setDraft((d) => ({ ...d, product_ref_url: url }))}
                currentUrl={draft.product_ref_url}
              />
            </Field>
          </div>

          {error ? <div className="alert">{error}</div> : null}

          <div className="row">
            <button type="button" className="btn ghost" onClick={handleClearDraft} disabled={busy}>
              Clear
            </button>
            <button type="button" className="btn primary" onClick={handleGenerateBlueprint} disabled={busy}>
              Generate Blueprint
            </button>
          </div>
        </section>

        {/* SCENES */}
        <section hidden={tab !== "scenes"} className="card">
          <div className="card-title">Scenes</div>
          <div className="muted">plan → image → approve → video → audio</div>

          {!blueprint ? (
            <div className="empty">
              No blueprint yet. Generate it in Settings.
            </div>
          ) : scenes.length === 0 ? (
            <div className="empty">Blueprint loaded, but no scenes found.</div>
          ) : (
            <div className="scene-list">
              {scenes.map((sc, idx) => {
                const sceneId = String(sc.scene_number ?? idx + 1);
                const img = sceneImages[sceneId];
                const isGen = !!generatingScene[sceneId];

                return (
                  <div key={sceneId} className="scene">
                    <div className="scene-head">
                      <div className="chip">S{sceneId}</div>
                      <div className="scene-title">
                        <div className="scene-name">SCENE</div>
                        <div className="scene-sub">
                          {Number(sc.duration_seconds || draft.seconds_per_scene)}s • {sc.motion || sc.camera_movement || "—"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleGenerateSceneImage(idx)}
                        disabled={isGen}
                      >
                        {isGen ? "Generating..." : "Generate Image"}
                      </button>
                    </div>

                    <div className="scene-body">
                      <div className="kv">
                        <div className="k">Visual</div>
                        <div className="v">{sc.visual_direction || "—"}</div>
                      </div>
                      <div className="kv">
                        <div className="k">On-screen</div>
                        <div className="v">{sc.onscreen_text || "—"}</div>
                      </div>
                      <div className="kv">
                        <div className="k">VO</div>
                        <div className="v">{sc.voiceover || "—"}</div>
                      </div>

                      {img ? (
                        <div className="img-wrap">
                          <img src={img} alt={`Scene ${sceneId}`} />
                          <a className="link" href={img} target="_blank" rel="noreferrer">
                            Open image
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* EXPORT */}
        <section hidden={tab !== "export"} className="card">
          <div className="card-title">Export</div>

          {!blueprint ? (
            <div className="empty">No blueprint yet.</div>
          ) : (
            <>
              <div className="row">
                <button type="button" className="btn" onClick={handleDownloadJson}>
                  Download JSON
                </button>
                <button type="button" className="btn ghost" onClick={handleClearBlueprint}>
                  Clear Blueprint
                </button>
              </div>

              <pre className="code">
                {JSON.stringify(blueprint, null, 2)}
              </pre>
            </>
          )}
        </section>
      </div>

      {/* Status Dock (fixed above tabbar) */}
      <div className={`statusDock ${statusOpen ? "" : "is-min"}`}>
        <div className="statusHead">
          <div className="statusTitle">Status</div>
          <div className="statusActions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setStatusOpen((v) => !v)}
            >
              {statusOpen ? "Minimize" : "Show"}
            </button>
          </div>
        </div>

        <div className="statusBody" hidden={!statusOpen}>
          <div className="statusLine">{statusText}</div>

          {/* simple progress bar (avoid flicker) */}
          <div className={`bar ${busy ? "is-running" : ""}`}>
            <div className="barFill" />
          </div>

          {error ? <div className="miniError">{error}</div> : null}
        </div>
      </div>

      {/* Bottom tabs */}
      <Tabs value={tab} onChange={setTab} items={tabItems} />
    </div>
  );
}
