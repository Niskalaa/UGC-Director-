// src/components/StudioShell.jsx - V1 Implementation
// Production-grade component with V1 blueprint support

import React, { useEffect, useMemo, useState, useCallback } from "react";
import ImageUploadField from "./ImageUploadField.jsx";

// ============================================================================
// CONSTANTS
// ============================================================================

const LS_BLUEPRINT = "ugc.blueprint.v1";
const LS_DRAFT = "ugc.draft.v1";
const LS_THEME = "ugc.theme";

const TABS = ["settings", "scenes", "vo", "export"];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

function clip(text, maxLength = 180) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength - 1) + "…" : text;
}

// ============================================================================
// V1 BLUEPRINT PARSERS
// ============================================================================

/**
 * Extract scenes/beats from V1 blueprint structure
 * Supports both new V1 format and legacy formats for backward compatibility
 */
function extractScenes(blueprint) {
  if (!blueprint) return [];
  
  // V1 format: storyboard.beats (primary)
  const v1Beats = blueprint?.storyboard?.beats;
  if (Array.isArray(v1Beats) && v1Beats.length > 0) {
    return v1Beats.map((beat, idx) => ({
      ...beat,
      id: beat.id || `B${idx + 1}`,
      idx,
    }));
  }
  
  // Legacy format: vo.scenes
  const voScenes = blueprint?.vo?.scenes;
  if (Array.isArray(voScenes) && voScenes.length > 0) {
    return voScenes.map((scene, idx) => ({
      id: scene.id || `S${idx + 1}`,
      idx,
      time_window: `${scene.start_seconds || idx * 8}s-${scene.end_seconds || (idx + 1) * 8}s`,
      goal: scene.goal || "",
      action: scene.description || "",
      on_screen_text: scene.on_screen || "",
      shot: scene.camera_angle || scene.shot_type || "",
      visual_prompt: scene.visual_prompt || "",
    }));
  }
  
  // Legacy format: beats or scenes
  const legacyBeats = blueprint?.beats || blueprint?.scenes;
  if (Array.isArray(legacyBeats) && legacyBeats.length > 0) {
    return legacyBeats.map((beat, idx) => ({
      id: beat.id || `S${idx + 1}`,
      idx,
      time_window: beat.time_window || `${idx * 8}s-${(idx + 1) * 8}s`,
      goal: beat.goal || "",
      action: beat.action || beat.description || "",
      on_screen_text: beat.on_screen || beat.onscreen_text || "",
    }));
  }
  
  return [];
}

function extractMeta(blueprint) {
  return blueprint?.meta || null;
}

function extractLocks(blueprint) {
  return blueprint?.locks || null;
}

function extractVO(blueprint) {
  return blueprint?.vo || null;
}

function extractVideoPrompt(blueprint) {
  return blueprint?.video_prompt || null;
}

function extractPlaceholders(blueprint) {
  return blueprint?.placeholders_if_no_scrape || [];
}

function extractValidation(blueprint) {
  return blueprint?.validation || null;
}

// ============================================================================
// API HELPER
// ============================================================================

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  const text = await response.text();
  const data = safeJsonParse(text) ?? { raw: text };
  
  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return data;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StudioShell({ onLogout }) {
  // Theme state
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(LS_THEME);
    if (saved) return saved;
    const current = document.documentElement.getAttribute("data-theme");
    return current === "dark" ? "dark" : "light";
  });
  
  // UI state
  const [tab, setTab] = useState("settings");
  const [statusExpanded, setStatusExpanded] = useState(false);
  
  // Data state
  const [draft, setDraft] = useState(() => 
    safeJsonParse(localStorage.getItem(LS_DRAFT)) || {}
  );
  
  const [blueprint, setBlueprint] = useState(() => 
    safeJsonParse(localStorage.getItem(LS_BLUEPRINT))
  );
  
  // Loading & error state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  
  // Persist theme
  useEffect(() => {
    localStorage.setItem(LS_THEME, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  
  // Persist draft
  useEffect(() => {
    localStorage.setItem(LS_DRAFT, JSON.stringify(draft));
  }, [draft]);
  
  // Persist blueprint
  useEffect(() => {
    if (blueprint) {
      localStorage.setItem(LS_BLUEPRINT, JSON.stringify(blueprint));
    } else {
      localStorage.removeItem(LS_BLUEPRINT);
    }
  }, [blueprint]);
  
  // Extract blueprint segments
  const scenes = useMemo(() => extractScenes(blueprint), [blueprint]);
  const meta = useMemo(() => extractMeta(blueprint), [blueprint]);
  const locks = useMemo(() => extractLocks(blueprint), [blueprint]);
  const vo = useMemo(() => extractVO(blueprint), [blueprint]);
  const videoPrompt = useMemo(() => extractVideoPrompt(blueprint), [blueprint]);
  const placeholders = useMemo(() => extractPlaceholders(blueprint), [blueprint]);
  const validation = useMemo(() => extractValidation(blueprint), [blueprint]);
  
  // Update draft field
  const updateDraft = useCallback((key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);
  
  // Generate blueprint
  const handleGenerate = useCallback(async () => {
    setError("");
    setGenerating(true);
    
    try {
      // Validate required fields
      if (!draft.brand || !draft.product_type || !draft.material) {
        throw new Error("Brand, Product Type, and Material are required");
      }
      
      const payload = {
        project: draft,
        provider: "bedrock",
      };
      
      console.log("[StudioShell] Generating blueprint...");
      
      const result = await postJson("/api/plan", payload);
      
      if (!result.ok || !result.blueprint) {
        throw new Error(result.error || "Failed to generate blueprint");
      }
      
      setBlueprint(result.blueprint);
      setTab("scenes");
      setStatusExpanded(false);
      
      console.log("[StudioShell] Blueprint generated successfully");
      
    } catch (err) {
      console.error("[StudioShell] Generation error:", err);
      setError(err.message || "Failed to generate blueprint");
    } finally {
      setGenerating(false);
    }
  }, [draft]);
  
  // Toggle theme
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);
  
  // ============================================================================
  // RENDER: SETTINGS TAB
  // ============================================================================
  
  function SettingsTab() {
    return (
      <div className="ugc-container">
        <div className="ugc-card">
          <div className="ugc-cardheader">
            <div className="ugc-cardtitle">Project Settings</div>
            <div className="ugc-cardsub">Configure your UGC ad parameters</div>
          </div>
          
          <div className="ugc-grid2">
            <div>
              <div className="ugc-label">Brand *</div>
              <input
                className="ugc-input"
                value={draft.brand || ""}
                onChange={(e) => { setDraft(prev => ({...prev, FIELDNAME: e.target.value})); }}

                placeholder="e.g., Nike"
              />
            </div>
            
            <div>
              <div className="ugc-label">Product Type *</div>
              <input
                className="ugc-input"
                value={draft.product_type || ""}
                onChange={(e) => updateDraft("product_type", e.target.value)}
                placeholder="e.g., Baju tidur"
              />
            </div>
            
            <div>
              <div className="ugc-label">Material *</div>
              <input
                className="ugc-input"
                value={draft.material || ""}
                onChange={(e) => updateDraft("material", e.target.value)}
                placeholder="e.g., Katun premium"
              />
            </div>
            
            <div>
              <div className="ugc-label">Product Name</div>
              <input
                className="ugc-input"
                value={draft.product_name || ""}
                onChange={(e) => updateDraft("product_name", e.target.value)}
                placeholder="e.g., Premium Koko Shirt"
              />
            </div>
            
            <div>
              <div className="ugc-label">Category</div>
              <input
                className="ugc-input"
                value={draft.category || ""}
                onChange={(e) => updateDraft("category", e.target.value)}
                placeholder="e.g., Fashion"
              />
            </div>
            
            <div>
              <div className="ugc-label">Tone</div>
              <input
                className="ugc-input"
                value={draft.tone || ""}
                onChange={(e) => updateDraft("tone", e.target.value)}
                placeholder="e.g., natural gen-z"
              />
            </div>
            
            <div>
              <div className="ugc-label">Target Audience</div>
              <input
                className="ugc-input"
                value={draft.target_audience || ""}
                onChange={(e) => updateDraft("target_audience", e.target.value)}
                placeholder="e.g., pria 18-34"
              />
            </div>
            
            <div>
              <div className="ugc-label">Scene Count</div>
              <select
                className="ugc-select"
                value={draft.scene_count || 4}
                onChange={(e) => updateDraft("scene_count", Number(e.target.value))}
              >
                {[3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} beats</option>
                ))}
              </select>
            </div>
            
            <div>
              <div className="ugc-label">Seconds per Scene</div>
              <select
                className="ugc-select"
                value={draft.seconds_per_scene || "3-4s"}
                onChange={(e) => updateDraft("seconds_per_scene", e.target.value)}
              >
                <option value="3s">3s</option>
                <option value="3-4s">3-4s</option>
                <option value="4s">4s</option>
                <option value="4-5s">4-5s</option>
                <option value="5s">5s</option>
              </select>
            </div>
            
            <div>
              <div className="ugc-label">Product URL (optional)</div>
              <input
                className="ugc-input"
                value={draft.scrape_url || ""}
                onChange={(e) => updateDraft("scrape_url", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          
          <div style={{ marginTop: 20 }}>
            <div className="ugc-label">Reference Assets</div>
            <div className="ugc-grid2">
              <ImageUploadField
                label="Model Reference"
                valueUrl={draft.model_ref_url || ""}
                onUrl={(url) => updateDraft("model_ref_url", url)}
                projectId={draft.project_id || "default"}
                kind="model"
              />
              
              <ImageUploadField
                label="Product Reference"
                valueUrl={draft.product_ref_url || ""}
                onUrl={(url) => updateDraft("product_ref_url", url)}
                projectId={draft.project_id || "default"}
                kind="product"
              />
            </div>
          </div>
          
          {error && (
            <div className="ugc-error" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}
          
          <div className="ugc-row-actions" style={{ marginTop: 20 }}>
            <button
  type="button"
  className="ugc-btn"
  onClick={() => {
    if (window.confirm("Clear current blueprint? This cannot be undone.")) {
      setBlueprint(null);
      localStorage.removeItem(LS_BLUEPRINT);
    }
  }}
  disabled={generating || !blueprint}
>
  Clear Blueprint
</button>

            
            <button
              type="button"
              className="ugc-btn primary"
              onClick={handleGenerate}
              disabled={generating || !draft.brand || !draft.product_type || !draft.material}
            >
              {generating ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span className="ugc-spinner" />
                  Generating...
                </span>
              ) : (
                "Generate Blueprint"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // RENDER: SCENES TAB
  // ============================================================================
  
  function ScenesTab() {
    if (!blueprint) {
      return (
        <div className="ugc-container">
          <div className="ugc-card">
            <div className="ugc-muted-box">
              No blueprint yet. Generate one in the Settings tab.
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="ugc-container">
        <div className="ugc-card">
          <div className="ugc-cardheader">
            <div className="ugc-cardtitle">Storyboard Beats</div>
            <div className="ugc-cardsub">
              {scenes.length} beats with embedded negative prompts
            </div>
          </div>
          
          {scenes.length === 0 ? (
            <div className="ugc-muted-box">
              Blueprint exists but no scenes/beats found.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {scenes.map((beat) => {
                const negatives = beat.negative_prompt || [];
                
                return (
                  <div key={beat.id} className="ugc-beat-card">
                    <div className="ugc-beat-header">
                      <span className="ugc-chip ok">{beat.id}</span>
                      {beat.time_window && (
                        <span className="ugc-chip">{beat.time_window}</span>
                      )}
                      {beat.goal && (
                        <span className="ugc-chip" style={{ 
                          background: "var(--orange2)", 
                          borderColor: "var(--orange)" 
                        }}>
                          {beat.goal}
                        </span>
                      )}
                    </div>
                    
                    {beat.action && (
                      <div className="ugc-beat-field">
                        <span className="ugc-beat-label">Action:</span>
                        <span className="ugc-beat-value">{beat.action}</span>
                      </div>
                    )}
                    
                    {beat.on_screen_text && (
                      <div className="ugc-beat-field">
                        <span className="ugc-beat-label">On-screen:</span>
                        <span className="ugc-beat-value" style={{ fontStyle: "italic" }}>
                          {beat.on_screen_text}
                        </span>
                      </div>
                    )}
                    
                    {negatives.length > 0 && (
                      <div className="ugc-beat-negatives">
                        <div className="ugc-beat-label">Negative Prompts:</div>
                        <div className="ugc-negative-tags">
                          {negatives.slice(0, 6).map((neg, idx) => (
                            <span key={idx} className="ugc-chip bad">
                              {neg}
                            </span>
                          ))}
                          {negatives.length > 6 && (
                            <span className="ugc-chip">
                              +{negatives.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Locks Section */}
        {locks && (
          <div className="ugc-card" style={{ marginTop: 16 }}>
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">Identity & Product Locks</div>
              <div className="ugc-cardsub">Consistency enforcement rules</div>
            </div>
            
            <div style={{ display: "grid", gap: 8 }}>
              {locks.identity_lock && (
                <div className="ugc-lock-item">
                  <span className="ugc-chip ok">Identity Lock</span>
                  <span className="ugc-muted">
                    {locks.identity_lock.model_identity_source}
                  </span>
                </div>
              )}
              
              {locks.outfit_lock && (
                <div className="ugc-lock-item">
                  <span className="ugc-chip ok">Outfit Lock</span>
                  <span className="ugc-muted">
                    {locks.outfit_lock.outfit_source}
                  </span>
                </div>
              )}
              
              {locks.product_lock && (
                <div className="ugc-lock-item">
                  <span className="ugc-chip ok">Product Lock</span>
                  <span className="ugc-muted">
                    {locks.product_lock.product_image_source}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Placeholders Section */}
        {placeholders.length > 0 && (
          <div className="ugc-card" style={{ marginTop: 16 }}>
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">Placeholders</div>
              <div className="ugc-cardsub">Manual fill required (no scrape data)</div>
            </div>
            
            <div className="ugc-placeholder-grid">
              {placeholders.map((placeholder, idx) => (
                <span key={idx} className="ugc-chip" style={{ 
                  background: "var(--orange2)",
                  borderColor: "var(--orange)"
                }}>
                  {placeholder}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Validation Section */}
        {validation && (
          <div className="ugc-card" style={{ marginTop: 16 }}>
            <div className="ugc-cardheader">
              <div className="ugc-cardtitle">Validation Status</div>
            </div>
            
            <div className="ugc-chip" style={{
              background: validation.passed 
                ? "rgba(34,197,94,0.14)" 
                : "rgba(239,68,68,0.14)",
              borderColor: validation.passed 
                ? "rgba(34,197,94,0.35)" 
                : "rgba(239,68,68,0.35)",
            }}>
              {validation.passed ? "✓ All checks passed" : "✗ Issues detected"}
            </div>
            
            {validation.issues && validation.issues.length > 0 && (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {validation.issues.map((issue, idx) => (
                  <div key={idx} className="ugc-error">
                    {issue}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // ============================================================================
  // RENDER: VO TAB
  // ============================================================================
  
  function VOTab() {
    if (!vo) {
      return (
        <div className="ugc-container">
          <div className="ugc-card">
            <div className="ugc-muted-box">
              No voice-over data available. Generate a blueprint first.
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="ugc-container">
        <div className="ugc-card">
          <div className="ugc-cardheader">
            <div className="ugc-cardtitle">Voice-Over Script</div>
            <div className="ugc-cardsub">Natural language script with beat references</div>
          </div>
          
          {vo.style && (
            <div className="ugc-field-row">
              <div className="ugc-label">Style</div>
              <div className="ugc-muted">{vo.style}</div>
            </div>
          )}
          
          {vo.constraints && (
            <div className="ugc-field-row">
              <div className="ugc-label">Constraints</div>
              <div className="ugc-constraint-chips">
                {vo.constraints.total_duration_seconds && (
                  <span className="ugc-chip">
                    Duration: {vo.constraints.total_duration_seconds}s
                  </span>
                )}
                {vo.constraints.word_count_target && (
                  <span className="ugc-chip">
                    Words: {vo.constraints.word_count_target}
                  </span>
                )}
              </div>
            </div>
          )}
          
          {vo.negative_claims && vo.negative_claims.length > 0 && (
            <div className="ugc-field-row">
              <div className="ugc-label">Negative Claims (Must Avoid)</div>
              <div className="ugc-negative-tags">
                {vo.negative_claims.map((claim, idx) => (
                  <span key={idx} className="ugc-chip bad">
                    {claim}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {vo.script && vo.script.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="ugc-label">Script Lines</div>
              <div style={{ display: "grid", gap: 10 }}>
                {vo.script.map((line, idx) => (
                  <div key={idx} className="ugc-vo-line">
                    <div className="ugc-vo-header">
                      <span className="ugc-chip ok">{line.beat_id}</span>
                    </div>
                    <div className="ugc-vo-text">{line.line}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // RENDER: EXPORT TAB
  // ============================================================================
  
  function ExportTab() {
    const downloadBlueprint = useCallback(() => {
      const blob = new Blob([JSON.stringify(blueprint, null, 2)], { 
        type: "application/json" 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blueprint_v1_${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, [blueprint]);
    
    const openBlueprint = useCallback(() => {
      const win = window.open("", "_blank");
      if (!win) return;
      
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Blueprint JSON</title>
  <style>
    body { 
      font-family: ui-monospace, monospace; 
      padding: 20px; 
      background: #1a1a1a; 
      color: #e0e0e0; 
    }
    pre { 
      white-space: pre-wrap; 
      word-wrap: break-word; 
    }
  </style>
</head>
<body>
  <pre>${JSON.stringify(blueprint, null, 2).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body>
</html>`;
      
      win.document.write(html);
      win.document.close();
    }, [blueprint]);
    
    if (!blueprint) {
      return (
        <div className="ugc-container">
          <div className="ugc-card">
            <div className="ugc-muted-box">
              No blueprint available. Generate one in the Settings tab.
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="ugc-container">
        <div className="ugc-card">
          <div className="ugc-cardheader">
            <div className="ugc-cardtitle">Export Blueprint</div>
            <div className="ugc-cardsub">Download or view as JSON</div>
          </div>
          
          {meta && (
            <div className="ugc-meta-grid">
              <div className="ugc-meta-item">
                <div className="ugc-label">Version</div>
                <div className="ugc-chip">{meta.generator_version}</div>
              </div>
              
              <div className="ugc-meta-item">
                <div className="ugc-label">Language</div>
                <div className="ugc-chip">{meta.language}</div>
              </div>
              
              <div className="ugc-meta-item">
                <div className="ugc-label">Platform</div>
                <div className="ugc-chip">{meta.platform}</div>
              </div>
              
              <div className="ugc-meta-item">
                <div className="ugc-label">Aspect Ratio</div>
                <div className="ugc-chip">{meta.aspect_ratio}</div>
              </div>
              
              <div className="ugc-meta-item">
                <div className="ugc-label">Duration</div>
                <div className="ugc-chip">{meta.duration_seconds}s</div>
              </div>
              
              <div className="ugc-meta-item">
                <div className="ugc-label">Compliance</div>
                <div className="ugc-chip">{meta.compliance_mode}</div>
              </div>
            </div>
          )}
          
          <div className="ugc-row-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="ugc-btn"
              onClick={openBlueprint}
            >
              Open JSON
            </button>
            
            <button
              type="button"
              className="ugc-btn primary"
              onClick={downloadBlueprint}
            >
              Download JSON
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // RENDER: MAIN LAYOUT
  // ============================================================================
  
  const currentTab = useMemo(() => {
    switch (tab) {
      case "scenes": return <ScenesTab />;
      case "vo": return <VOTab />;
      case "export": return <ExportTab />;
      default: return <SettingsTab />;
    }
  }, [tab, draft, blueprint, generating, error]);
  
  return (
    <div className="ugc-page">
      {/* Topbar */}
      <div className="ugc-topbar">
        <div className="ugc-topbar-inner">
          <div className="ugc-title">UGC Studio</div>
          
          <div className="ugc-top-actions">
            <button
              type="button"
              className="ugc-pill-btn"
              onClick={toggleTheme}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            
            {onLogout && (
              <button
                type="button"
                className="ugc-pill-btn"
                onClick={onLogout}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      {currentTab}
      
      {/* Status Dock */}
      <div className={`ugc-status ${statusExpanded ? "" : "collapsed"}`}>
        <div className="ugc-status-inner">
          <div className="ugc-status-head">
            <div className="ugc-status-title">Status</div>
            <button
              type="button"
              className="ugc-btn small"
              onClick={() => setStatusExpanded(!statusExpanded)}
            >
              {statusExpanded ? "Minimize" : "Expand"}
            </button>
          </div>
          
          {statusExpanded ? (
            <div className="ugc-chiprow">
              <span className="ugc-chip ok">Core ✓</span>
              <span className="ugc-chip">
                Beats: {scenes.length}
              </span>
              {meta && (
                <span className="ugc-chip">
                  {meta.duration_seconds}s
                </span>
              )}
            </div>
          ) : (
            <div className="ugc-progress">
              <div className="ugc-progress-track">
                <div className="ugc-progress-shimmer" />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom Tabbar */}
      <div className="ugc-tabbar">
        <div className="ugc-tabbar-inner">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`ugc-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Credit */}
      <div className="ugc-credit">UGC Studio V1 • Created by @adryndian</div>
    </div>
  );
}
