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
   MAIN
   ========================= */
export default function StudioShell() {
  const [tab, setTab] = useState("Settings");

  // Global state
  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" });
  const [blueprint, setBlueprint] = useState(null);

  // UI state
  const [theme, setTheme] = useState("dark"); // "dark" | "light"
  const [lang, setLang] = useState("id"); // "id" | "en"
  const [statusCollapsed, setStatusCollapsed] = useState(false);

  // Generate state
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);

  // Toast
  const [toast, setToast] = useState(null); // {type:'ok'|'err', msg:string}
  const toastTimerRef = useRef(null);

  function showToast(type, msg, ms = 2400) {
    setToast({ type, msg });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }

  // timer for loading
  useEffect(() => {
    if (!loadingPlan) return;
    setElapsedSec(0);
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loadingPlan]);

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
    elapsedSec,
    theme,
    setTheme,
    lang,
    setLang,
    statusCollapsed,
    setStatusCollapsed,
    showToast
  };

  const content = useMemo(() => {
    if (tab === "Scenes") return <ScenesTab />;
    if (tab === "Export") return <ExportTab />;
    return <SettingsTab />;
  }, [tab]);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <StudioContext.Provider value={ctx}>
      <div style={styles.page}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <div style={styles.topInner}>
            <div style={styles.brand}>Studio</div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <LangToggle lang={lang} setLang={setLang} styles={styles} />
              <ThemeToggle theme={theme} setTheme={setTheme} styles={styles} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={styles.content}>{content}</div>

        {/* Status (sticky bottom panel, can minimize) */}
        <StatusPanel />

        {/* Bottom tabs */}
        <div style={styles.tabBar}>
          <div style={styles.tabInner}>
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

          {/* Credit (fixed, not scroll) */}
          <div style={styles.credit}>Created by @adryndian</div>
        </div>

        {/* Toast */}
        {toast ? (
          <div style={styles.toastWrap}>
            <div style={{ ...styles.toast, ...(toast.type === "ok" ? styles.toastOk : styles.toastErr) }}>
              {toast.msg}
            </div>
          </div>
        ) : null}
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   TABS
   ========================= */

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
    elapsedSec,
    lang,
    showToast
  } = useStudio();

  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);

  const [p, setP] = useState(projectDraft);

  // link autofill (optional)
  const [linkUrl, setLinkUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);

  useEffect(() => {
    // keep draft in sync if projectDraft changed outside
    setP(projectDraft);
  }, [projectDraft]);

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  // minimal required for plan
  const requiredOk =
    (p.brand || "").trim() &&
    (p.product_type || "").trim() &&
    (p.material || "").trim() &&
    (p.platform || "").trim() &&
    (p.aspect_ratio || "").trim() &&
    Number(p.scene_count || 0) > 0 &&
    Number(p.seconds_per_scene || 0) > 0;

  const totalDuration = Number(p.scene_count || 0) * Number(p.seconds_per_scene || 0);

  async function generatePlanOnce() {
    if (!requiredOk || loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);
    setProjectDraft(p);

    const provider = String(p.ai_brain || "bedrock").toLowerCase();
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
        throw new Error(`Non-JSON response (${r.status}). Preview: ${String(raw).slice(0, 220)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Plan failed (${r.status})`);
      if (!json?.blueprint) throw new Error("Plan OK tapi blueprint kosong. Cek /api/plan response.");

      setBlueprint(json.blueprint);
      showToast("ok", lang === "id" ? "Generate sukses ✓" : "Generate success ✓");
      setTab("Scenes");
    } catch (e) {
      const msg =
        e?.name === "AbortError"
          ? `Timeout after ${Math.round(timeoutMs / 1000)}s`
          : e?.message || String(e);
      setPlanError(msg);
      showToast("err", msg);
    } finally {
      clearTimeout(timer);
      setLoadingPlan(false);
    }
  }

  async function autoFillFromImages() {
    if (imgBusy) return;
    if (!(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim()) return;

    setPlanError("");
    setImgBusy(true);

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
        tone: prev.tone?.trim() ? prev.tone : (f.tone || prev.tone || ""),
        target_audience: prev.target_audience?.trim() ? prev.target_audience : (f.target_audience || prev.target_audience || "")
      }));

      showToast("ok", lang === "id" ? "Auto-fill dari gambar sukses ✓" : "Image auto-fill success ✓");
    } catch (e) {
      const msg = e?.message || String(e);
      setPlanError(msg);
      showToast("err", msg);
    } finally {
      setImgBusy(false);
    }
  }

  async function autoFillFromLink() {
    if (linkBusy) return;
    const url = (linkUrl || "").trim();
    if (!url) return;

    setPlanError("");
    setLinkBusy(true);

    try {
      // NOTE: kamu bilang ada scrape.js → kita pakai /api/scrape
      const r = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, lang: lang })
      });

      const raw = await r.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Non-JSON scrape response (${r.status}): ${String(raw).slice(0, 180)}`);
      }

      if (!r.ok || !json?.ok) throw new Error(json?.error || `Scrape failed (${r.status})`);

      const f = json.fields || json.data || {};
      setP((prev) => ({
        ...prev,
        brand: prev.brand?.trim() ? prev.brand : (f.brand || ""),
        product_type: prev.product_type?.trim() ? prev.product_type : (f.product_type || ""),
        material: prev.material?.trim() ? prev.material : (f.material || ""),
        target_audience: prev.target_audience?.trim() ? prev.target_audience : (f.target_audience || prev.target_audience || ""),
        tone: prev.tone?.trim() ? prev.tone : (f.tone || prev.tone || "")
      }));

      showToast("ok", lang === "id" ? "Auto-fill dari link sukses ✓" : "Link auto-fill success ✓");
    } catch (e) {
      const msg = e?.message || String(e);
      setPlanError(msg);
      showToast("err", msg);
    } finally {
      setLinkBusy(false);
    }
  }

  return (
    <div style={styles.card}>
      <CardHeader title={lang === "id" ? "Settings" : "Settings"} />

      {/* AI Brain */}
      <Section title={lang === "id" ? "AI Brain" : "AI Brain"}>
        <Grid>
          <Field label={lang === "id" ? "Provider" : "Provider"}>
            <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
              <option value="bedrock">Bedrock</option>
              <option value="gemini">Gemini</option>
            </Select>
          </Field>
        </Grid>
      </Section>

      {/* Auto-fill optional */}
      <Section title={lang === "id" ? "Auto-fill (optional)" : "Auto-fill (optional)"}>
        <Grid>
          <Field label={lang === "id" ? "Product page URL" : "Product page URL"}>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>

          <button
            type="button"
            style={{ ...styles.secondaryBtn, opacity: linkUrl.trim() && !linkBusy ? 1 : 0.55 }}
            disabled={!linkUrl.trim() || linkBusy}
            onClick={autoFillFromLink}
          >
            {linkBusy ? (lang === "id" ? "Loading…" : "Loading…") : (lang === "id" ? "Auto-fill from Link" : "Auto-fill from Link")}
          </button>

          <button
            type="button"
            style={{
              ...styles.secondaryBtn,
              opacity: (p.model_ref_url || "").trim() && (p.product_ref_url || "").trim() && !imgBusy ? 1 : 0.55
            }}
            disabled={imgBusy || !(p.model_ref_url || "").trim() || !(p.product_ref_url || "").trim()}
            onClick={autoFillFromImages}
          >
            {imgBusy ? (lang === "id" ? "Analyzing…" : "Analyzing…") : (lang === "id" ? "Auto-fill from Images" : "Auto-fill from Images")}
          </button>
        </Grid>
      </Section>

      {/* Format & Timing */}
      <Section title={lang === "id" ? "Format & Timing" : "Format & Timing"}>
        <Grid>
          <Field label={lang === "id" ? "Platform" : "Platform"}>
            <Select value={p.platform} onChange={(e) => update("platform", e.target.value)}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram Reels</option>
              <option value="facebook">Facebook Reels</option>
              <option value="youtube">YouTube Shorts</option>
            </Select>
          </Field>

          <Field label={lang === "id" ? "Aspect ratio" : "Aspect ratio"}>
            <Select value={p.aspect_ratio} onChange={(e) => update("aspect_ratio", e.target.value)}>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
            </Select>
          </Field>

          <Field label={lang === "id" ? "Scene count" : "Scene count"}>
            <Select value={String(p.scene_count)} onChange={(e) => update("scene_count", Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={lang === "id" ? "Seconds/scene" : "Seconds/scene"}>
            <Select value={String(p.seconds_per_scene)} onChange={(e) => update("seconds_per_scene", Number(e.target.value))}>
              {[4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={String(n)}>
                  {n}s
                </option>
              ))}
            </Select>
          </Field>

          <Chip>{lang === "id" ? `Estimated duration: ${totalDuration || 0}s` : `Estimated duration: ${totalDuration || 0}s`}</Chip>
        </Grid>
      </Section>

      {/* Core inputs */}
      <Section title={lang === "id" ? "Core" : "Core"}>
        <Grid>
          <Field label={lang === "id" ? "Brand *" : "Brand *"}>
            <Input value={p.brand || ""} onChange={(e) => update("brand", e.target.value)} placeholder="Brand" />
          </Field>

          <Field label={lang === "id" ? "Product type *" : "Product type *"}>
            <Input value={p.product_type || ""} onChange={(e) => update("product_type", e.target.value)} placeholder="e.g. hoodie, sunscreen" />
          </Field>

          <Field label={lang === "id" ? "Material *" : "Material *"}>
            <Input value={p.material || ""} onChange={(e) => update("material", e.target.value)} placeholder="e.g. cotton, serum gel" />
          </Field>

          <Field label={lang === "id" ? "Tone" : "Tone"}>
            <Input value={p.tone || ""} onChange={(e) => update("tone", e.target.value)} placeholder="natural gen-z" />
          </Field>

          <Field label={lang === "id" ? "Target audience" : "Target audience"}>
            <Input value={p.target_audience || ""} onChange={(e) => update("target_audience", e.target.value)} placeholder="e.g. teens, moms, men 18–30" />
          </Field>
        </Grid>
      </Section>

      {/* Assets optional */}
      <Section title={lang === "id" ? "Assets (optional)" : "Assets (optional)"}>
        <Grid>
          <ImageUploadField
            label={lang === "id" ? "Model reference" : "Model reference"}
            kind="model"
            projectId={p.project_id || "local"}
            valueUrl={p.model_ref_url}
            onUrl={(url) => update("model_ref_url", url)}
            hideUrl={true}
            showPreview={true}
            optional={true}
          />
          <ImageUploadField
            label={lang === "id" ? "Product reference" : "Product reference"}
            kind="product"
            projectId={p.project_id || "local"}
            valueUrl={p.product_ref_url}
            onUrl={(url) => update("product_ref_url", url)}
            hideUrl={true}
            showPreview={true}
            optional={true}
          />
        </Grid>
      </Section>

      {/* Error */}
      {planError ? <div style={styles.errorBox}>{planError}</div> : null}

      {/* CTA */}
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          style={{
            ...styles.primaryBtn,
            opacity: requiredOk && !loadingPlan ? 1 : 0.55,
            cursor: requiredOk && !loadingPlan ? "pointer" : "not-allowed"
          }}
          disabled={!requiredOk || loadingPlan}
          onClick={generatePlanOnce}
        >
          {loadingPlan ? (
            <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
              <Spinner />
              {lang === "id" ? `Generating… (${elapsedSec}s)` : `Generating… (${elapsedSec}s)`}
            </span>
          ) : (
            lang === "id" ? "Generate Plan" : "Generate Plan"
          )}
        </button>
      </div>
    </div>
  );
}

function ScenesTab() {
  const { blueprint, lang, showToast } = useStudio();
  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);

  const scenes = useMemo(() => extractScenesRobust(blueprint), [blueprint]);

  return (
    <div style={styles.card}>
      <CardHeader
        title={lang === "id" ? "Scenes" : "Scenes"}
        sub={lang === "id" ? "plan → image → approve → video → audio" : "plan → image → approve → video → audio"}
      />

      {!blueprint ? (
        <div style={styles.placeholder}>{lang === "id" ? "Belum ada blueprint. Generate dulu di Settings." : "No blueprint yet. Generate in Settings."}</div>
      ) : scenes.length === 0 ? (
        <div style={styles.placeholder}>
          {lang === "id" ? "Blueprint ada, tapi scenes/beats tidak terbaca." : "Blueprint exists, but scenes/beats not readable."}
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => {
                try {
                  const jsonStr = JSON.stringify(blueprint, null, 2);
                  const w = window.open("", "_blank");
                  if (w) {
                    w.document.write(`<pre style="white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, monospace; padding: 12px;">${escapeHtml(jsonStr)}</pre>`);
                    w.document.close();
                  }
                } catch {
                  showToast("err", "Failed to open JSON");
                }
              }}
            >
              Open JSON
            </button>

            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => downloadJson(blueprint, "blueprint.json")}
            >
              Download JSON
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {scenes.map((s, idx) => (
            <div key={s.id || idx} style={styles.sceneCard}>
              <div style={styles.sceneTop}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={styles.sceneBadge}>{s.id || `S${idx + 1}`}</div>
                  <div style={{ fontWeight: 900 }}>{s.goal || (lang === "id" ? "SCENE" : "SCENE")}</div>
                  {s.time_window ? <Chip>{s.time_window}</Chip> : null}
                </div>
                <Chip>{lang === "id" ? "Draft" : "Draft"}</Chip>
              </div>

              <div style={styles.sceneGrid}>
                <div>
                  <div style={styles.miniLabel}>{lang === "id" ? "Action" : "Action"}</div>
                  <div style={styles.miniBox}>{s.action || "—"}</div>
                </div>

                <div>
                  <div style={styles.miniLabel}>{lang === "id" ? "On-screen text" : "On-screen text"}</div>
                  <div style={styles.miniBox}>{s.on_screen_text || "—"}</div>
                </div>

                <div>
                  <div style={styles.miniLabel}>{lang === "id" ? "VO" : "VO"}</div>
                  <div style={styles.miniBox}>{s.vo || "—"}</div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={styles.miniLabel}>{lang === "id" ? "Negative prompt" : "Negative prompt"}</div>
                <div style={styles.miniBox}>{(s.negative_prompt || []).slice(0, 10).join(", ") || "—"}</div>
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
          ))}
        </div>
      )}
    </div>
  );
}

function ExportTab() {
  const { blueprint, lang } = useStudio();
  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);

  return (
    <div style={styles.card}>
      <CardHeader title={lang === "id" ? "Export" : "Export"} />
      {!blueprint ? (
        <div style={styles.placeholder}>{lang === "id" ? "Belum ada blueprint." : "No blueprint yet."}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <button type="button" style={styles.primaryBtn} onClick={() => downloadJson(blueprint, "blueprint.json")}>
            Download JSON
          </button>
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() => {
              const jsonStr = JSON.stringify(blueprint, null, 2);
              const w = window.open("", "_blank");
              if (w) {
                w.document.write(`<pre style="white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, monospace; padding: 12px;">${escapeHtml(jsonStr)}</pre>`);
                w.document.close();
              }
            }}
          >
            Open JSON
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================
   STATUS PANEL (sticky, minimize)
   ========================= */

function StatusPanel() {
  const {
    projectDraft,
    blueprint,
    loadingPlan,
    planError,
    elapsedSec,
    statusCollapsed,
    setStatusCollapsed,
    lang
  } = useStudio();

  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);

  // readiness
  const coreOk =
    (projectDraft.brand || "").trim() &&
    (projectDraft.product_type || "").trim() &&
    (projectDraft.material || "").trim() &&
    (projectDraft.platform || "").trim() &&
    (projectDraft.aspect_ratio || "").trim();

  const modelOk = Boolean((projectDraft.model_ref_url || "").trim());
  const productOk = Boolean((projectDraft.product_ref_url || "").trim());

  const est = Number(projectDraft.scene_count || 0) * Number(projectDraft.seconds_per_scene || 0);
  const provider = String(projectDraft.ai_brain || "bedrock").toUpperCase();

  return (
    <div style={{ ...styles.statusWrap, ...(statusCollapsed ? styles.statusWrapCollapsed : {}) }}>
      <div style={styles.statusCard}>
        <div style={styles.statusTop}>
          <div style={{ fontWeight: 900 }}>{lang === "id" ? "Status" : "Status"}</div>
          <button type="button" style={styles.miniBtn} onClick={() => setStatusCollapsed((v) => !v)}>
            {statusCollapsed ? (lang === "id" ? "Show" : "Show") : (lang === "id" ? "Minimize" : "Minimize")}
          </button>
        </div>

        {!statusCollapsed ? (
          <>
            <div style={styles.statusChips}>
              <Chip tone={coreOk ? "ok" : "bad"}>{coreOk ? "Core ✓" : "Core ×"}</Chip>
              <Chip tone={modelOk ? "ok" : "bad"}>{modelOk ? "Model ✓" : "Model ×"}</Chip>
              <Chip tone={productOk ? "ok" : "bad"}>{productOk ? "Product ✓" : "Product ×"}</Chip>
              <Chip>{lang === "id" ? `≈ ${est || 0}s` : `≈ ${est || 0}s`}</Chip>
              <Chip>{`Provider: ${provider}`}</Chip>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={styles.miniLabel}>{lang === "id" ? "Progress" : "Progress"}</div>
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: loadingPlan ? `${Math.min(90, 8 + elapsedSec * 5)}%` : blueprint ? "100%" : "0%"
                  }}
                />
              </div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Chip>{loadingPlan ? `Elapsed: 0:${String(elapsedSec).padStart(2, "0")}` : blueprint ? "Done ✓" : "Idle"}</Chip>
                {loadingPlan ? (
                  <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <Spinner />
                    <span style={{ fontWeight: 800, opacity: 0.8 }}>{lang === "id" ? "Generating…" : "Generating…"}</span>
                  </span>
                ) : null}
              </div>

              {planError ? <div style={{ ...styles.errorBox, marginTop: 10 }}>{planError}</div> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* =========================
   UI ATOMS
   ========================= */

function CardHeader({ title, sub }) {
  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);
  return (
    <div style={styles.cardHeader}>
      <div style={styles.cardTitle}>{title}</div>
      {sub ? <div style={styles.cardSub}>{sub}</div> : null}
    </div>
  );
}

function Section({ title, children }) {
  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{children}</div>
    </div>
  );
}

function Grid({ children }) {
  // 1 column (mobile-first). Kalau desktop, tetap aman.
  return <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>{children}</div>;
}

function Field({ label, children }) {
  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);
  return (
    <div>
      <div style={styles.label}>{label}</div>
      {children}
    </div>
  );
}

function Input(props) {
  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);
  return <input {...props} style={styles.input} />;
}

function Select(props) {
  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);
  return <select {...props} style={styles.select} />;
}

function Chip({ children, tone }) {
  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);
  const toneStyle =
    tone === "ok"
      ? styles.chipOk
      : tone === "bad"
      ? styles.chipBad
      : null;

  return <span style={{ ...styles.chip, ...(toneStyle || {}) }}>{children}</span>;
}

function Step({ label, active }) {
  const styles = useMemo(() => makeStyles(useStudio().theme), [useStudio().theme]);
  return <div style={{ ...styles.step, ...(active ? styles.stepActive : {}) }}>{label}</div>;
}

function Spinner() {
  // Uses @keyframes spin in global.css (you already have it)
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 999,
        border: "2px solid rgba(255,255,255,0.25)",
        borderTopColor: "rgba(249,115,22,1)",
        display: "inline-block",
        animation: "spin 0.9s linear infinite"
      }}
    />
  );
}

function LangToggle({ lang, setLang, styles }) {
  return (
    <div style={styles.pill}>
      <span style={{ opacity: 0.75, fontWeight: 800, fontSize: 12, marginRight: 10 }}>Bahasa</span>
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
  );
}

function ThemeToggle({ theme, setTheme, styles }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" style={styles.pillBtnSolo} onClick={() => setTheme(next)}>
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

/* =========================
   SCENES EXTRACTION (ROBUST)
   ========================= */

function extractScenesRobust(blueprint) {
  if (!blueprint) return [];

  // Common wrappers
  const root =
    blueprint?.ugc_prompt_os_v1 ||
    blueprint?.blueprint?.ugc_prompt_os_v1 ||
    blueprint?.blueprint ||
    blueprint;

  // Case A: classic storyboard beats
  const beats =
    root?.storyboard?.beats ||
    root?.SEGMENT_3?.storyboard?.beats ||
    root?.segments?.storyboard?.beats ||
    root?.scene_plans ||
    null;

  // Case B: your uploaded schema: ugc_prompt_os_v1.scene_breakdown + voiceover_spec.script
  const sb = root?.scene_breakdown || null;
  const voScript = root?.voiceover_spec?.script || root?.vo?.script || null;

  // 1) If beats array exists, map it
  if (Array.isArray(beats) && beats.length) {
    return beats.map((b, idx) => ({
      id: b.id || b.scene_id || `S${idx + 1}`,
      goal: b.goal || b.purpose || b.title || "",
      time_window: b.time_window || b.time || "",
      action: b.action || b.camera_movement || b.visual || "",
      on_screen_text: b.on_screen_text || b.onscreen || b.text_overlay || "",
      vo: b.vo || b.voiceover || "",
      negative_prompt: Array.isArray(b.negative_prompt) ? b.negative_prompt : []
    }));
  }

  // 2) If scene_breakdown exists, map with VO script join by scene index
  if (Array.isArray(sb) && sb.length) {
    const voByScene = new Map();
    if (Array.isArray(voScript)) {
      for (const line of voScript) {
        const n = Number(line?.scene);
        if (!Number.isFinite(n)) continue;
        voByScene.set(n, String(line?.text || ""));
      }
    }

    return sb.map((s, idx) => {
      const n = idx + 1;
      const visuals = Array.isArray(s.visual_elements) ? s.visual_elements.join(", ") : "";
      const neg = Array.isArray(s.negative_prompts) ? s.negative_prompts : Array.isArray(s.negative_prompt) ? s.negative_prompt : [];
      return {
        id: `S${n}`,
        goal: s.purpose || "",
        time_window: s.time_window || "",
        action: [s.camera_movement, s.camera_angle, visuals].filter(Boolean).join(" • "),
        on_screen_text: "",
        vo: voByScene.get(n) || "",
        negative_prompt: neg
      };
    });
  }

  return [];
}

/* =========================
   HELPERS
   ========================= */

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* =========================
   STYLES (black-white-orange)
   ========================= */

function makeStyles(theme) {
  const isDark = theme === "dark";

  const bg = isDark ? "#07070A" : "#fff7ed";
  const cardBg = isDark ? "rgba(17,17,20,0.92)" : "rgba(255,255,255,0.92)";
  const cardBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
  const text = isDark ? "#F5F5F6" : "#0B1220";
  const subText = isDark ? "rgba(245,245,246,0.70)" : "rgba(11,18,32,0.62)";
  const orange = "#f97316";

  return {
    page: {
      minHeight: "100vh",
      background: bg,
      color: text,
      paddingBottom: 150
    },

    topBar: {
      position: "sticky",
      top: 0,
      zIndex: 30,
      background: isDark ? "rgba(7,7,10,0.82)" : "rgba(255,247,237,0.85)",
      borderBottom: `1px solid ${cardBorder}`,
      backdropFilter: "blur(14px)"
    },
    topInner: {
      maxWidth: 980,
      margin: "0 auto",
      padding: "14px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    brand: {
      fontWeight: 900,
      fontSize: 18,
      letterSpacing: -0.2
    },

    content: {
      maxWidth: 980,
      margin: "0 auto",
      padding: 14
    },

    card: {
      borderRadius: 18,
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      boxShadow: isDark ? "0 14px 45px rgba(0,0,0,0.55)" : "0 12px 35px rgba(0,0,0,0.08)",
      padding: 14
    },
    cardHeader: {
      marginBottom: 12,
      paddingBottom: 10,
      borderBottom: `1px solid ${cardBorder}`
    },
    cardTitle: { fontWeight: 900, fontSize: 16 },
    cardSub: { marginTop: 4, fontSize: 12, color: subText },

    sectionTitle: { fontWeight: 900, fontSize: 13, color: text },

    label: { fontSize: 12, fontWeight: 800, marginBottom: 6, color: subText },

    input: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${cardBorder}`,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)",
      color: text,
      outline: "none",
      fontWeight: 700
    },
    select: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${cardBorder}`,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)",
      color: text,
      outline: "none",
      fontWeight: 800
    },

    primaryBtn: {
      width: "100%",
      padding: "14px 14px",
      borderRadius: 16,
      border: "none",
      background: orange,
      color: "white",
      fontWeight: 900
    },
    secondaryBtn: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 16,
      border: `1px solid ${cardBorder}`,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
      color: text,
      fontWeight: 900
    },

    placeholder: {
      padding: 12,
      borderRadius: 14,
      border: `1px dashed ${cardBorder}`,
      color: subText,
      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.65)"
    },

    // Scenes
    sceneCard: {
      borderRadius: 18,
      padding: 12,
      border: `1px solid ${cardBorder}`,
      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.70)"
    },
    sceneTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    sceneBadge: {
      fontWeight: 900,
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 999,
      background: isDark ? "rgba(249,115,22,0.22)" : "rgba(249,115,22,0.14)",
      border: "1px solid rgba(249,115,22,0.28)",
      color: isDark ? "#FFE7D5" : "#7c2d12"
    },
    sceneGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 },
    miniLabel: { fontSize: 12, fontWeight: 900, color: subText, marginBottom: 6 },
    miniBox: {
      borderRadius: 14,
      padding: 10,
      background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.9)",
      border: `1px solid ${cardBorder}`,
      color: text,
      fontWeight: 700,
      fontSize: 13,
      whiteSpace: "pre-wrap"
    },
    stepperRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
    step: {
      padding: "8px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      border: `1px solid ${cardBorder}`,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
      color: text
    },
    stepActive: {
      background: "rgba(249,115,22,0.18)",
      border: "1px solid rgba(249,115,22,0.25)"
    },
    sceneActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },

    chip: {
      fontSize: 12,
      fontWeight: 900,
      padding: "8px 10px",
      borderRadius: 999,
      border: `1px solid ${cardBorder}`,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
      color: text
    },
    chipOk: {
      borderColor: "rgba(34,197,94,0.28)",
      background: "rgba(34,197,94,0.12)",
      color: isDark ? "#BBF7D0" : "#14532d"
    },
    chipBad: {
      borderColor: "rgba(239,68,68,0.28)",
      background: "rgba(239,68,68,0.12)",
      color: isDark ? "#FECACA" : "#7f1d1d"
    },

    errorBox: {
      padding: 12,
      borderRadius: 14,
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.18)",
      color: isDark ? "#FECACA" : "#b91c1c",
      fontWeight: 900
    },

    // Tabs bottom
    tabBar: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 40,
      padding: 12,
      paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
      pointerEvents: "none"
    },
    tabInner: {
      maxWidth: 520,
      margin: "0 auto",
      display: "flex",
      gap: 10,
      padding: 10,
      borderRadius: 18,
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      boxShadow: isDark ? "0 14px 40px rgba(0,0,0,0.55)" : "0 12px 30px rgba(0,0,0,0.10)",
      backdropFilter: "blur(14px)",
      pointerEvents: "auto"
    },
    tabBtn: {
      flex: 1,
      border: "none",
      borderRadius: 14,
      padding: "12px 10px",
      fontWeight: 900,
      cursor: "pointer",
      background: "transparent",
      color: text
    },
    tabBtnActive: {
      background: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.92)",
      boxShadow: isDark ? "0 10px 24px rgba(0,0,0,0.40)" : "0 10px 22px rgba(0,0,0,0.10)"
    },
    credit: {
      marginTop: 10,
      textAlign: "center",
      fontSize: 12,
      fontWeight: 900,
      color: subText,
      pointerEvents: "none"
    },

    // Status panel
    statusWrap: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: "calc(92px + env(safe-area-inset-bottom))",
      zIndex: 35,
      padding: 12
    },
    statusWrapCollapsed: {
      bottom: "calc(92px + env(safe-area-inset-bottom))"
    },
    statusCard: {
      maxWidth: 520,
      margin: "0 auto",
      borderRadius: 18,
      background: cardBg, // <= not too transparent
      border: `1px solid ${cardBorder}`,
      boxShadow: isDark ? "0 14px 45px rgba(0,0,0,0.55)" : "0 12px 30px rgba(0,0,0,0.10)",
      padding: 12
    },
    statusTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10
    },
    statusChips: {
      marginTop: 10,
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center"
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      overflow: "hidden",
      border: `1px solid ${cardBorder}`
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      background: orange,
      transition: "width 260ms ease"
    },

    miniBtn: {
      border: `1px solid ${cardBorder}`,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)",
      color: text,
      borderRadius: 999,
      padding: "10px 12px",
      fontWeight: 900
    },

    // Pills (language)
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 999,
      border: `1px solid ${cardBorder}`,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)"
    },
    pillBtn: {
      border: `1px solid ${cardBorder}`,
      background: "transparent",
      color: text,
      borderRadius: 999,
      padding: "8px 10px",
      fontWeight: 900,
      cursor: "pointer"
    },
    pillBtnActive: {
      background: isDark ? "rgba(255,255,255,0.10)" : "rgba(249,115,22,0.14)",
      borderColor: "rgba(249,115,22,0.30)"
    },
    pillBtnSolo: {
      border: `1px solid ${cardBorder}`,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)",
      color: text,
      borderRadius: 999,
      padding: "10px 12px",
      fontWeight: 900,
      cursor: "pointer"
    },

    // Toast
    toastWrap: {
      position: "fixed",
      left: 0,
      right: 0,
      top: 14,
      zIndex: 60,
      display: "flex",
      justifyContent: "center",
      pointerEvents: "none"
    },
    toast: {
      pointerEvents: "none",
      borderRadius: 999,
      padding: "10px 14px",
      fontWeight: 900,
      border: `1px solid ${cardBorder}`,
      background: cardBg,
      boxShadow: isDark ? "0 14px 30px rgba(0,0,0,0.55)" : "0 10px 24px rgba(0,0,0,0.10)"
    },
    toastOk: { borderColor: "rgba(34,197,94,0.35)" },
    toastErr: { borderColor: "rgba(239,68,68,0.35)" }
  };
}
