import React, { useMemo, useState } from "react";
import GeneratorInteractive from "./GeneratorInteractive.jsx";

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
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>Settings</div>
        <div style={styles.cardSub}>Project defaults, models, ElevenLabs</div>
      </div>

      <div style={styles.placeholder}>
        Settings UI (form lengkap) kita isi setelah shell beres.
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

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,237,213,1) 100%)",
    paddingBottom: 86 // space for tabbar
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
    pointerEvents: "auto"
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
  }
};
