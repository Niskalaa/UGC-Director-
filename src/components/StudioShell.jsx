import React, { useMemo, useState } from "react";
import GeneratorInteractive from "./GeneratorInteractive.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Scenes", "Settings", "Export"];

const StudioContext = React.createContext(null);
export function useStudio() {
  return React.useContext(StudioContext);
}

export default function StudioShell() {
  const [tab, setTab] = useState("Scenes");

  // global studio state
  const [projectDraft, setProjectDraft] = useState({ ...DEFAULT_PROJECT, ai_brain: "bedrock" }); // bedrock | gemini
  const [blueprint, setBlueprint] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

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
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  ...styles.tabBtn,
                  ...(tab === t ? styles.tabBtnActive : {})
                }}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </StudioContext.Provider>
  );
}

/* =========================
   TABS
   ========================= */

function ScenesTab() {
  const { blueprint, setTab } = useStudio();

  // Ambil beats/scenes dari blueprint (kita support beberapa kemungkinan struktur)
  const beats =
    blueprint?.storyboard?.beats ||
    blueprint?.SEGMENT_3?.storyboard?.beats ||
    blueprint?.segments?.storyboard?.beats ||
    [];

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>Scenes</div>
        <div style={styles.cardSub}>Per-scene workflow: plan → image → approve → video → audio (manual trigger)</div>
      </div>

      {!blueprint ? (
        <div style={styles.placeholder}>
          Belum ada blueprint. Buka tab <b>Settings</b> → isi data → klik <b>Generate Plan (once)</b>.
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => setTab("Settings")} style={styles.secondaryBtn}>
              Go to Settings
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {beats.length === 0 ? (
            <div style={styles.placeholder}>
              Blueprint ada, tapi beats tidak terbaca. (Nanti kita rapikan schema output AI supaya selalu sama.)
            </div>
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
                  <button type="button" style={styles.primaryBtn} onClick={() => alert("Next step: Generate Image (per scene)")}>
                    Generate Image
                  </button>
                  <button type="button" style={styles.secondaryBtn} onClick={() => alert("Edit prompt per scene (next step)")}>
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

  const totalDuration = Number(p.scene_count || 0) * Number(p.seconds_per_scene || 0);

  const canGeneratePlan =
    p.brand.trim() &&
    p.product_type.trim() &&
    p.material.trim() &&
    p.model_ref_url.trim() &&
    p.product_ref_url.trim();

  function update(key, value) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function updateSceneBg(idx, value) {
    setP((prev) => {
      const next = [...(prev.scene_bg_urls || [])];
      while (next.length < Number(prev.scene_count || 0)) next.push("");
      next[idx] = value;
      return { ...prev, scene_bg_urls: next };
    });
  }

  async function generatePlanOnce() {
    if (!canGeneratePlan || loadingPlan) return;

    setPlanError("");
    setLoadingPlan(true);

    try {
      // persist draft globally
      setProjectDraft(p);

      const provider = (p.ai_brain || "bedrock").toLowerCase();

      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, project: p })
      });

      const json = await r.json().catch(() => ({}));
      if (!r.ok || !json?.ok) {
        throw new Error(json?.error || `Plan failed (${r.status})`);
      }

      setBlueprint(json.blueprint);
      setTab("Scenes");
    } catch (e) {
      setPlanError(e?.message || String(e));
    } finally {
      setLoadingPlan(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>Settings</div>
        <div style={styles.cardSub}>Isi data → Generate Plan (sekali) → lalu per-scene generate image/video/audio</div>
      </div>

      {/* SECTION: AI Brain */}
      <Section title="AI Brain" sub="Default: Bedrock (DeepSeek+Claude). Gemini sebagai opsi ke-3.">
        <Grid2>
          <Field label="AI Brain">
            <Select value={p.ai_brain || "bedrock"} onChange={(e) => update("ai_brain", e.target.value)}>
              <option value="bedrock">Bedrock (DeepSeek + Claude)</option>
              <option value="gemini">Gemini (single-pass)</option>
            </Select>
          </Field>
        </Grid2>
      </Section>

      {/* SECTION: Core */}
      <Section title="Core Inputs" sub="Wajib untuk generate plan.">
        <Grid2>
          <Field label="Project name (optional)">
            <Input value={p.project_name} onChange={(e) => update("project_name", e.target.value)} placeholder="UGC Project — Feb 2026" />
          </Field>

          <Field label="Brand *">
            <Input value={p.brand} onChange={(e) => update("brand", e.target.value)} placeholder="Nama brand" />
          </Field>

          <Field label="Product type *">
            <Input value={p.product_type} onChange={(e) => update("product_type", e.target.value)} placeholder="Contoh: sunscreen, hoodie, coffee" />
          </Field>

          <Field label="Material *">
            <Input value={p.material} onChange={(e) => update("material", e.target.value)} placeholder="Contoh: cotton, serum gel, stainless" />
          </Field>

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

          <Field label="Scene count (max 10)">
            <Select value={String(p.scene_count)} onChange={(e) => update("scene_count", Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </Select>
          </Field>

          <Field label="Seconds per scene (default 8)">
            <Select value={String(p.seconds_per_scene)} onChange={(e) => update("seconds_per_scene", Number(e.target.value))}>
              {[4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={String(n)}>{n}s</option>
              ))}
            </Select>
          </Field>
        </Grid2>

        <MiniRow>
          <Chip>Estimated duration: {totalDuration}s</Chip>
          <Chip>Energy: {p.energy}</Chip>
          <Chip>Motion: {p.motion_default}</Chip>
        </MiniRow>
      </Section>

      {/* SECTION: Assets */}
      <Section title="Assets (lock identity/outfit/product)" sub="MVP: tempel URL image dulu. Nanti kita bikin uploader.">
        <Grid2>
          <Field label="Model reference URL *">
            <Input value={p.model_ref_url} onChange={(e) => update("model_ref_url", e.target.value)} placeholder="https://... (link image)" />
          </Field>
          <Field label="Product reference URL *">
            <Input value={p.product_ref_url} onChange={(e) => update("product_ref_url", e.target.value)} placeholder="https://... (link image)" />
          </Field>
        </Grid2>

        <SectionLite title="Scene background (optional) — per scene">
          {Array.from({ length: Number(p.scene_count || 0) }, (_, i) => i).map((i) => (
            <div key={i} style={styles.bgRow}>
              <div style={styles.bgLabel}>S{i + 1}</div>
              <Input value={(p.scene_bg_urls || [])[i] || ""} onChange={(e) => updateSceneBg(i, e.target.value)} placeholder="Optional background image URL" />
            </div>
          ))}
        </SectionLite>
      </Section>

      {/* SECTION: Tone */}
      <Section title="Audience & Tone" sub="1 gaya konsisten untuk semua scene.">
        <Grid2>
          <Field label="Target audience (optional)">
            <Input value={p.target_audience} onChange={(e) => update("target_audience", e.target.value)} placeholder="Contoh: cewek 18–24, pekerja kantoran" />
          </Field>
          <Field label="Tone">
            <Input value={p.tone} onChange={(e) => update("tone", e.target.value)} />
          </Field>
          <Field label="Pronoun">
            <Segment
              value={p.pronoun}
              options={[
                { value: "gue", label: "Gue" },
                { value: "aku", label: "Aku" }
              ]}
              onChange={(v) => update("pronoun", v)}
            />
          </Field>
          <Field label="Energy">
            <Select value={p.energy} onChange={(e) => update("energy", e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
          <Field label="Motion default">
            <Select value={p.motion_default} onChange={(e) => update("motion_default", e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
        </Grid2>
      </Section>

      {/* Errors */}
      {planError ? <div style={styles.errorBox}>{planError}</div> : null}

      {/* Sticky bar */}
      <div style={styles.stickyBar}>
        <div style={styles.stickyInner}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip>{p.brand.trim() ? "Core ✓" : "Core ✗"}</Chip>
            <Chip>{p.model_ref_url.trim() ? "Model ✓" : "Model ✗"}</Chip>
            <Chip>{p.product_ref_url.trim() ? "Product ✓" : "Product ✗"}</Chip>
            <Chip>AI Brain: {(p.ai_brain || "bedrock").toUpperCase()}</Chip>
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
            {loadingPlan ? "Generating…" : "Generate Plan (once)"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportTab() {
  const { blueprint } = useStudio();

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>Export</div>
        <div style={styles.cardSub}>Download blueprint + assets per scene (no stitching)</div>
      </div>

      {!blueprint ? (
        <div style={styles.placeholder}>Belum ada blueprint. Generate plan dulu di Settings.</div>
      ) : (
        <div style={styles.placeholder}>
          Next step: tombol download JSON blueprint + per-scene downloads (image/video/mp3).
        </div>
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

function SectionLite({ title, children }) {
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.55)" }}>
      <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
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

function Segment({ value, options, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: 6, borderRadius: 16, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.06)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            flex: 1,
            border: "none",
            borderRadius: 12,
            padding: "10px 10px",
            fontWeight: 900,
            cursor: "pointer",
            background: value === o.value ? "rgba(255,255,255,0.92)" : "transparent",
            boxShadow: value === o.value ? "0 6px 18px rgba(0,0,0,0.06)" : "none"
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
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

  bgRow: { display: "grid", gridTemplateColumns: "52px 1fr", gap: 10, alignItems: "center" },
  bgLabel: {
    fontWeight: 900,
    fontSize: 12,
    color: "#111827",
    textAlign: "center",
    padding: "8px 0",
    borderRadius: 12,
    background: "rgba(255,255,255,0.6)",
    border: "1px solid rgba(0,0,0,0.06)"
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
  }
};
