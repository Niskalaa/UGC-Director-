import React, { useMemo, useState } from "react";
import GeneratorInteractive from "./GeneratorInteractive.jsx";
import { DEFAULT_PROJECT } from "../studio/studioStore.js";

const TABS = ["Scenes", "Settings", "Export"];

export default function StudioShell() {
  const [tab, setTab] = useState("Scenes");

  const content = useMemo(() => {
    if (tab === "Scenes") return <ScenesTab />;
    if (tab === "Settings") return <SettingsTab />;
    return <ExportTab />;
  }, [tab]);

  return (
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
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScenesTab() {
  // Untuk sementara: render generator lama kamu disini
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>Scenes</div>
        <div style={styles.cardSub}>Generate plan & per-scene assets</div>
      </div>

      <GeneratorInteractive />
    </div>
  );
}

function SettingsTab() {
  const [p, setP] = React.useState({ ...DEFAULT_PROJECT });

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
      const next = [...prev.scene_bg_urls];
      next[idx] = value;
      return { ...prev, scene_bg_urls: next };
    });
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>Settings</div>
        <div style={styles.cardSub}>Create Project (lengkap) → Generate Plan (sekali)</div>
      </div>

      {/* SECTION: Core */}
      <Section title="Core Inputs" sub="Wajib diisi untuk generate plan.">
        <Grid2>
          <Field label="Project name (optional)">
            <Input
              value={p.project_name}
              onChange={(e) => update("project_name", e.target.value)}
              placeholder="UGC Project — Feb 2026"
            />
          </Field>

          <Field label="Brand *">
            <Input value={p.brand} onChange={(e) => update("brand", e.target.value)} placeholder="Nama brand" />
          </Field>

          <Field label="Product type *">
            <Input
              value={p.product_type}
              onChange={(e) => update("product_type", e.target.value)}
              placeholder="Contoh: sunscreen, hoodie, coffee"
            />
          </Field>

          <Field label="Material *">
            <Input
              value={p.material}
              onChange={(e) => update("material", e.target.value)}
              placeholder="Contoh: cotton, serum gel, stainless"
            />
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
            <Select
              value={String(p.scene_count)}
              onChange={(e) => update("scene_count", Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Seconds per scene (default 8)">
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

        <MiniRow>
          <Chip>Estimated duration: {totalDuration}s</Chip>
          <Chip>Style: {p.tone}</Chip>
          <Chip>Energy: {p.energy}</Chip>
        </MiniRow>
      </Section>

      {/* SECTION: Assets */}
      <Section title="Assets" sub="Untuk lock identity/outfit/product. (MVP: tempel URL dulu)">
        <Grid2>
          <Field label="Model reference URL *">
            <Input
              value={p.model_ref_url}
              onChange={(e) => update("model_ref_url", e.target.value)}
              placeholder="https://... (link image)"
            />
          </Field>

          <Field label="Product reference URL *">
            <Input
              value={p.product_ref_url}
              onChange={(e) => update("product_ref_url", e.target.value)}
              placeholder="https://... (link image)"
            />
          </Field>
        </Grid2>

        <SectionLite title="Scene background (optional) — per scene">
          {Array.from({ length: p.scene_count }, (_, i) => i).slice(0, 10).map((i) => (
            <div key={i} style={styles.bgRow}>
              <div style={styles.bgLabel}>S{i + 1}</div>
              <Input
                value={p.scene_bg_urls[i] || ""}
                onChange={(e) => updateSceneBg(i, e.target.value)}
                placeholder="Optional background image URL"
              />
            </div>
          ))}
        </SectionLite>

        <MiniRow>
          <Chip>Background default: {p.background_mode_default}</Chip>
          <Chip>Motion default: {p.motion_default}</Chip>
        </MiniRow>
      </Section>

      {/* SECTION: Audience & Tone */}
      <Section title="Audience & Tone" sub="1 gaya konsisten untuk semua scene.">
        <Grid2>
          <Field label="Target audience (optional)">
            <Input
              value={p.target_audience}
              onChange={(e) => update("target_audience", e.target.value)}
              placeholder="Contoh: cewek 18–24, pekerja kantoran"
            />
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

          <Field label="Persona">
            <Select value={p.persona} onChange={(e) => update("persona", e.target.value)}>
              <option value="honest-reviewer">Honest reviewer</option>
              <option value="excited-friend">Excited friend</option>
              <option value="expert-demo">Expert demo</option>
            </Select>
          </Field>

          <Field label="Energy">
            <Select value={p.energy} onChange={(e) => update("energy", e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>

          <Field label="Pace">
            <Select value={p.pace} onChange={(e) => update("pace", e.target.value)}>
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </Select>
          </Field>
        </Grid2>
      </Section>

      {/* SECTION: Claims & Compliance */}
      <Section title="Claims & Compliance" sub="Jika allowed kosong → pakai placeholder <benefit_1>, <benefit_2>.">
        <Field label="Claims allowed (optional, 1 per baris)">
          <Textarea
            value={p.claims_allowed}
            onChange={(e) => update("claims_allowed", e.target.value)}
            placeholder="contoh:\ntahan lama\nringan\nmudah dipakai"
          />
        </Field>

        <Field label="Claims disallowed (prefilled)">
          <Textarea
            value={p.claims_disallowed}
            onChange={(e) => update("claims_disallowed", e.target.value)}
          />
        </Field>

        <MiniRow>
          <Toggle
            checked={p.compliance_strict}
            onChange={(v) => update("compliance_strict", v)}
            label="Strict compliance mode"
          />
        </MiniRow>
      </Section>

      {/* SECTION: Background & Motion */}
      <Section title="Background & Motion" sub="Default global. Per scene bisa override nanti di Scenes tab.">
        <Grid2>
          <Field label="Background mode default">
            <Select
              value={p.background_mode_default}
              onChange={(e) => update("background_mode_default", e.target.value)}
            >
              <option value="reference">Reference (recommended)</option>
              <option value="enhance">Enhance</option>
              <option value="replace">Replace</option>
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

      {/* SECTION: Audio */}
      <Section title="Audio (ElevenLabs)" sub="MP3 per scene. Voice konsisten semua scene.">
        <Grid2>
          <Field label="ElevenLabs API key (optional for now)">
            <Input placeholder="sk-..." value={""} onChange={() => {}} disabled />
          </Field>
          <Field label="Voice (later)">
            <Input placeholder="Default voice" value={""} onChange={() => {}} disabled />
          </Field>
        </Grid2>

        <div style={styles.placeholder}>
          Kita sambungkan input API key + voice picker setelah plan generator wiring selesai.
        </div>
      </Section>

      {/* Sticky Generate bar */}
      <div style={styles.stickyBar}>
        <div style={styles.stickyInner}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip>{p.brand.trim() ? "Core ✓" : "Core ✗"}</Chip>
            <Chip>{p.model_ref_url.trim() ? "Model ✓" : "Model ✗"}</Chip>
            <Chip>{p.product_ref_url.trim() ? "Product ✓" : "Product ✗"}</Chip>
          </div>

          <button
            style={{
              ...styles.primaryBtn,
              opacity: canGeneratePlan ? 1 : 0.5,
              cursor: canGeneratePlan ? "pointer" : "not-allowed"
            }}
            disabled={!canGeneratePlan}
            onClick={() => alert("Next: wiring Generate Plan (DeepSeek + Claude) — step berikutnya.")}
          >
            Generate Plan (once)
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportTab() {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>Export</div>
        <div style={styles.cardSub}>Download per scene (no stitching)</div>
      </div>

      <div style={styles.placeholder}>
        Export UI: download blueprint + asset per scene (satu-satu).
      </div>
    </div>
  );
}
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

function Textarea(props) {
  return (
    <textarea
      {...props}
      rows={4}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.9)",
        outline: "none",
        fontWeight: 600,
        resize: "vertical"
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

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 14,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.7)",
        fontWeight: 900,
        cursor: "pointer"
      }}
    >
      {checked ? "ON" : "OFF"} — {label}
    </button>
  );
}
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,237,213,1) 100%)",
    paddingBottom: 110 // space for tabbar
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
  bgRow: {
  display: "grid",
  gridTemplateColumns: "52px 1fr",
  gap: 10,
  alignItems: "center"
},
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
stickyBar: {
  position: "sticky",
  bottom: 0,
  marginTop: 16,
  paddingTop: 12
},
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
}
  
};
