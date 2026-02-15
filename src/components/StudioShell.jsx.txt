// src/components/StudioShell.jsx - COMPLETELY REVISED
// All bugs fixed + new features added

import React, { useEffect, useMemo, useState, useCallback } from "react";
import ImageUploadField from "./ImageUploadField.jsx";

// ============================================================================
// CONSTANTS
// ============================================================================

const LS_BLUEPRINT = "ugc.blueprint.v1";
const LS_DRAFT = "ugc.draft.v1";
const LS_THEME = "ugc.theme";

// FIXED: Correct tab order (settings-scenes-video-vo)
const TABS = ["settings", "scenes", "video", "vo"];

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

// ============================================================================
// V1 BLUEPRINT PARSERS
// ============================================================================

function extractScenes(blueprint) {
  if (!blueprint) return [];
  
  const v1Beats = blueprint?.storyboard?.beats;
  if (Array.isArray(v1Beats) && v1Beats.length > 0) {
    return v1Beats.map((beat, idx) => ({
      ...beat,
      id: beat.id || `B${idx + 1}`,
      idx,
    }));
  }
  
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
  
  // Data state
  const [draft, setDraft] = useState(() => 
    safeJsonParse(localStorage.getItem(LS_DRAFT)) || {}
  );
  
  const [blueprint, setBlueprint] = useState(() => 
    safeJsonParse(localStorage.getItem(LS_BLUEPRINT))
  );
  
  // Loading & error state
  const [generating, setGenerating] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");
  
  // Scene images state
  const [sceneImages, setSceneImages] = useState({});
  const [generatingImages, setGeneratingImages] = useState({});
  
  // Video state
  const [sceneVideos, setSceneVideos] = useState({});
  const [generatingVideos, setGeneratingVideos] = useState({});
  
  // UI state for collapsible sections
  const [expandedScenes, setExpandedScenes] = useState({});
  const [showJsonMode, setShowJsonMode] = useState({});
  const [showExpertControls, setShowExpertControls] = useState(false);
  
  // Expert controls state
  const [expertParams, setExpertParams] = useState({
    image: {
      steps: 30,
      cfg_scale: 7,
      sampler: "DPM++ 2M Karras"
    },
    video: {
      fps: 24,
      duration: 5,
      motion: 3
    },
    audio: {
      voice: "natural",
      speed: 1.0,
      pitch: 1.0
    }
  });
  
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
  
  // Generate blueprint
  const handleGenerate = useCallback(async () => {
    setError("");
    setGenerating(true);
    
    try {
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
      
      console.log("[StudioShell] Blueprint generated successfully");
      
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.message || String(err);
      console.error("[StudioShell] Generation error:", errorMsg);
      setError(errorMsg);
    } finally {
      setGenerating(false);
    }
  }, [draft]);
  
  // Analyze URL (scraper)
  const handleAnalyzeUrl = useCallback(async () => {
    if (!draft.scrape_url) {
      setError("Please enter a product URL first");
      return;
    }
    
    setError("");
    setScraping(true);
    
    try {
      console.log("[StudioShell] Analyzing URL:", draft.scrape_url);
      
      const result = await postJson("/api/analyze", {
        url: draft.scrape_url
      });
      
      if (!result.ok) {
        throw new Error(result.error || "Failed to analyze URL");
      }
      
      // Merge scraped data into draft
      setDraft(prev => ({
        ...prev,
        ...result.data
      }));
      
      console.log("[StudioShell] URL analyzed successfully");
      
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.message || String(err);
      console.error("[StudioShell] Scraping error:", errorMsg);
      setError(errorMsg);
    } finally {
      setScraping(false);
    }
  }, [draft.scrape_url]);
  
  // Generate image for scene
  const handleGenerateImage = useCallback(async (sceneId, prompt) => {
  setError("");
  setGeneratingImages(prev => ({ ...prev, [sceneId]: true }));

  try {
    const payload = {
      type: "image",
      brief: prompt,
      negative: "",
      settings: {
        quality: "standard",
        aspect_ratio: "9:16",
        seed: Math.floor(Math.random() * 1000000),
      },
    };

    const result = await postJson("/api/jobs", payload);

    // ✅ sukses langsung dari result
    if (result?.image_url) {
      setSceneImages(prev => ({ ...prev, [sceneId]: result.image_url }));
      return;
    }

    // kalau server balikin format lain
    if (result?.output_url) {
      setSceneImages(prev => ({ ...prev, [sceneId]: result.output_url }));
      return;
    }

    // kalau cuma balikin id, baru butuh polling (optional)
    if (result?.id || result?.job_id) {
      throw new Error("Job created but no image_url returned. Add polling if needed.");
    }

    throw new Error("Unexpected /api/jobs response (no image_url).");
  } catch (err) {
    console.error("[StudioShell] Image generation error:", err);
    setError(`Image failed: ${err?.message || String(err)}`);
  } finally {
    setGeneratingImages(prev => ({ ...prev, [sceneId]: false }));
  }
}, []); 
  
  // Generate video for scene
  const handleGenerateVideo = useCallback(async (sceneId, prompt) => {
  setError("");
  setGeneratingVideos(prev => ({ ...prev, [sceneId]: true }));

  try {
    const payload = {
      type: "video",
      brief: prompt,
      negative: "",
      settings: {
        video_seconds: 5,
        aspect_ratio: "9:16",
        seed: Math.floor(Math.random() * 1000000),
      },
    };

    const result = await postJson("/api/jobs", payload);

    // kalau backend kamu return video_url langsung
    if (result?.video_url) {
      setSceneVideos(prev => ({ ...prev, [sceneId]: result.video_url }));
      return;
    }

    // atau output_url
    if (result?.output_url) {
      setSceneVideos(prev => ({ ...prev, [sceneId]: result.output_url }));
      return;
    }

    // kalau cuma return id, polling perlu (optional)
    if (result?.id || result?.job_id) {
      throw new Error("Job created but no video_url returned. Add polling if needed.");
    }

    throw new Error("Unexpected /api/jobs response (no video_url).");
  } catch (err) {
    console.error("[StudioShell] Video generation error:", err);
    setError(`Video failed: ${err?.message || String(err)}`);
  } finally {
    setGeneratingVideos(prev => ({ ...prev, [sceneId]: false }));
  }
}, []);
      
  
  // Poll job status helper
  
  // Clear blueprint
  const handleClearBlueprint = useCallback(() => {
    if (window.confirm("Clear current blueprint? This cannot be undone.")) {
      setBlueprint(null);
      setSceneImages({});
      setSceneVideos({});
      localStorage.removeItem(LS_BLUEPRINT);
    }
  }, []);
  
  // Toggle theme
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);
  
  // Toggle scene expanded
  const toggleSceneExpanded = useCallback((sceneId) => {
    setExpandedScenes(prev => ({ ...prev, [sceneId]: !prev[sceneId] }));
  }, []);
  
  // Toggle JSON mode
  const toggleJsonMode = useCallback((sceneId) => {
    setShowJsonMode(prev => ({ ...prev, [sceneId]: !prev[sceneId] }));
  }, []);
  
  // ============================================================================
  // RENDER: SETTINGS TAB
  // ============================================================================
  
  function SettingsTab() {
    return (
      <div className="ugc-container">
        <div className="ugc-card compact">
          <div className="ugc-cardheader compact">
            <div className="ugc-cardtitle">Project Settings</div>
          </div>
          
          <div className="ugc-grid2">
            <div>
              <div className="ugc-label">Brand *</div>
              <input
                className="ugc-input"
                value={draft.brand || ""}
                onChange={(e) => setDraft(prev => ({...prev, brand: e.target.value}))}
                placeholder="e.g., Nike"
              />
            </div>
            
            <div>
              <div className="ugc-label">Product Type *</div>
              <input
                className="ugc-input"
                value={draft.product_type || ""}
                onChange={(e) => setDraft(prev => ({...prev, product_type: e.target.value}))}
                placeholder="e.g., Baju koko"
              />
            </div>
            
            <div>
              <div className="ugc-label">Material *</div>
              <input
                className="ugc-input"
                value={draft.material || ""}
                onChange={(e) => setDraft(prev => ({...prev, material: e.target.value}))}
                placeholder="e.g., Katun premium"
              />
            </div>
            
            <div>
              <div className="ugc-label">Product Name</div>
              <input
                className="ugc-input"
                value={draft.product_name || ""}
                onChange={(e) => setDraft(prev => ({...prev, product_name: e.target.value}))}
                placeholder="e.g., Premium Shirt"
              />
            </div>
            
            <div>
              <div className="ugc-label">Category</div>
              <input
                className="ugc-input"
                value={draft.category || ""}
                onChange={(e) => setDraft(prev => ({...prev, category: e.target.value}))}
                placeholder="e.g., Fashion"
              />
            </div>
            
            <div>
              <div className="ugc-label">Tone</div>
              <input
                className="ugc-input"
                value={draft.tone || ""}
                onChange={(e) => setDraft(prev => ({...prev, tone: e.target.value}))}
                placeholder="e.g., natural gen-z"
              />
            </div>
            
            <div>
              <div className="ugc-label">Target Audience</div>
              <input
                className="ugc-input"
                value={draft.target_audience || ""}
                onChange={(e) => setDraft(prev => ({...prev, target_audience: e.target.value}))}
                placeholder="e.g., pria 18-34"
              />
            </div>
            
            <div>
              <div className="ugc-label">Scene Count</div>
              <select
                className="ugc-select"
                value={draft.scene_count || 4}
                onChange={(e) => setDraft(prev => ({...prev, scene_count: Number(e.target.value)}))}
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
                onChange={(e) => setDraft(prev => ({...prev, seconds_per_scene: e.target.value}))}
              >
                <option value="3s">3s</option>
                <option value="3-4s">3-4s</option>
                <option value="4s">4s</option>
                <option value="4-5s">4-5s</option>
                <option value="5s">5s</option>
              </select>
            </div>
            
            <div className="ugc-grid2-full">
              <div className="ugc-label">Product URL</div>
              <div className="ugc-input-group">
                <input
                  className="ugc-input"
                  value={draft.scrape_url || ""}
                  onChange={(e) => setDraft(prev => ({...prev, scrape_url: e.target.value}))}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  className="ugc-btn"
                  onClick={handleAnalyzeUrl}
                  disabled={scraping || !draft.scrape_url}
                >
                  {scraping ? "Analyzing..." : "Analyze"}
                </button>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: 16 }}>
            <div className="ugc-label">Reference Images</div>
            <div className="ugc-grid2">
              <ImageUploadField
                label="Model"
                valueUrl={draft.model_ref_url || ""}
                onUrl={(url) => setDraft(prev => ({...prev, model_ref_url: url}))}
                projectId={draft.project_id || "default"}
                kind="model"
              />
              
              <ImageUploadField
                label="Product"
                valueUrl={draft.product_ref_url || ""}
                onUrl={(url) => setDraft(prev => ({...prev, product_ref_url: url}))}
                projectId={draft.project_id || "default"}
                kind="product"
              />
            </div>
          </div>
          
          {error && (
            <div className="ugc-error compact" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
          
          <div className="ugc-row-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="ugc-btn"
              onClick={handleClearBlueprint}
              disabled={generating || !blueprint}
            >
              Clear
            </button>
            
            <button
              type="button"
              className="ugc-btn primary"
              onClick={handleGenerate}
              disabled={generating || !draft.brand || !draft.product_type || !draft.material}
            >
              {generating ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="ugc-spinner" />
                  Generating...
                </span>
              ) : (
                "Generate Blueprint"
              )}
            </button>
          </div>
        </div>
        
        {/* STATUS - Only in Settings Tab */}
        {blueprint && (
          <div className="ugc-card compact" style={{ marginTop: 12 }}>
            <div className="ugc-chiprow">
              <span className="ugc-chip ok">Blueprint Ready</span>
              <span className="ugc-chip">Beats: {scenes.length}</span>
              {meta && <span className="ugc-chip">{meta.duration_seconds}s</span>}
            </div>
          </div>
        )}
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
          <div className="ugc-muted-box compact">
            No blueprint yet. Generate one in Settings.
          </div>
        </div>
      );
    }
    
    return (
      <div className="ugc-container">
        {scenes.length === 0 ? (
          <div className="ugc-muted-box compact">
            Blueprint exists but no scenes found.
          </div>
        ) : (
          <div className="ugc-scenes-grid">
            {scenes.map((beat) => {
              const isExpanded = expandedScenes[beat.id];
              const isJsonMode = showJsonMode[beat.id];
              const hasImage = sceneImages[beat.id];
              const isGeneratingImage = generatingImages[beat.id];
              const negatives = beat.negative_prompt || [];
              
              const naturalPrompt = beat.action || beat.visual_prompt || "Scene description";
              
              return (
                <div key={beat.id} className="ugc-scene-card">
                  <div className="ugc-scene-header">
                    <div className="ugc-scene-meta">
                      <span className="ugc-chip ok">{beat.id}</span>
                      {beat.time_window && (
                        <span className="ugc-chip">{beat.time_window}</span>
                      )}
                      {beat.goal && (
                        <span className="ugc-chip warning">{beat.goal}</span>
                      )}
                    </div>
                    
                    <div className="ugc-scene-actions">
                      <button
                        className="ugc-btn-icon"
                        onClick={() => toggleJsonMode(beat.id)}
                        title={isJsonMode ? "Natural view" : "JSON view"}
                      >
                        {isJsonMode ? "📝" : "{ }"}
                      </button>
                      <button
                        className="ugc-btn-icon"
                        onClick={() => toggleSceneExpanded(beat.id)}
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    </div>
                  </div>
                  
                  {hasImage ? (
                    <div className="ugc-scene-image">
                      <img src={hasImage} alt={beat.id} />
                    </div>
                  ) : (
                    <div className="ugc-scene-placeholder">
                      {isGeneratingImage ? (
                        <div className="ugc-scene-generating">
                          <span className="ugc-spinner" />
                          <span>Generating...</span>
                        </div>
                      ) : (
                        <button
                          className="ugc-btn small"
                          onClick={() => handleGenerateImage(beat.id, naturalPrompt)}
                        >
                          Generate Image
                        </button>
                      )}
                    </div>
                  )}
                  
                  {isExpanded && (
                    <div className="ugc-scene-prompt">
                      {isJsonMode ? (
                        <pre className="ugc-json-view">
                          {JSON.stringify(beat, null, 2)}
                        </pre>
                      ) : (
                        <>
                          {beat.action && (
                            <div className="ugc-prompt-field">
                              <strong>Action:</strong> {beat.action}
                            </div>
                          )}
                          
                          {beat.on_screen_text && (
                            <div className="ugc-prompt-field">
                              <strong>Text:</strong> <em>{beat.on_screen_text}</em>
                            </div>
                          )}
                          
                          {negatives.length > 0 && (
                            <div className="ugc-prompt-field">
                              <strong>Avoid:</strong>
                              <div className="ugc-negative-tags compact">
                                {negatives.slice(0, 4).map((neg, idx) => (
                                  <span key={idx} className="ugc-chip bad small">
                                    {neg}
                                  </span>
                                ))}
                                {negatives.length > 4 && (
                                  <span className="ugc-chip small">
                                    +{negatives.length - 4}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {scenes.length > 0 && (
          <div className="ugc-card compact" style={{ marginTop: 12 }}>
            <button
              className="ugc-expert-toggle"
              onClick={() => setShowExpertControls(!showExpertControls)}
            >
              <span>⚙️ Expert Controls</span>
              <span>{showExpertControls ? "−" : "+"}</span>
            </button>
            
            {showExpertControls && (
              <div className="ugc-expert-panel">
                <div className="ugc-expert-section">
                  <div className="ugc-label">Image Generation</div>
                  <div className="ugc-grid2">
                    <div>
                      <label className="ugc-label small">Steps</label>
                      <input
                        type="number"
                        className="ugc-input small"
                        value={expertParams.image.steps}
                        onChange={(e) => setExpertParams(prev => ({
                          ...prev,
                          image: {...prev.image, steps: Number(e.target.value)}
                        }))}
                        min="10"
                        max="50"
                      />
                    </div>
                    <div>
                      <label className="ugc-label small">CFG Scale</label>
                      <input
                        type="number"
                        className="ugc-input small"
                        value={expertParams.image.cfg_scale}
                        onChange={(e) => setExpertParams(prev => ({
                          ...prev,
                          image: {...prev.image, cfg_scale: Number(e.target.value)}
                        }))}
                        min="1"
                        max="20"
                        step="0.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // ============================================================================
  // RENDER: VIDEO TAB
  // ============================================================================
  
  function VideoTab() {
    if (!blueprint) {
      return (
        <div className="ugc-container">
          <div className="ugc-muted-box compact">
            No blueprint yet. Generate one in Settings.
          </div>
        </div>
      );
    }
    
    return (
      <div className="ugc-container">
        <div className="ugc-scenes-grid">
          {scenes.map((beat) => {
            const hasVideo = sceneVideos[beat.id];
            const isGeneratingVideo = generatingVideos[beat.id];
            const hasImage = sceneImages[beat.id];
            const naturalPrompt = beat.action || beat.visual_prompt || "Scene description";
            
            return (
              <div key={beat.id} className="ugc-scene-card">
                <div className="ugc-scene-header">
                  <div className="ugc-scene-meta">
                    <span className="ugc-chip ok">{beat.id}</span>
                    {beat.time_window && (
                      <span className="ugc-chip">{beat.time_window}</span>
                    )}
                  </div>
                </div>
                
                {hasVideo ? (
                  <div className="ugc-scene-video">
                    <video src={hasVideo} controls />
                  </div>
                ) : (
                  <div className="ugc-scene-placeholder">
                    {isGeneratingVideo ? (
                      <div className="ugc-scene-generating">
                        <span className="ugc-spinner" />
                        <span>Generating video...</span>
                      </div>
                    ) : (
                      <>
                        {hasImage && (
                          <img src={hasImage} alt={beat.id} style={{ opacity: 0.5 }} />
                        )}
                        <button
                          className="ugc-btn primary"
                          onClick={() => handleGenerateVideo(beat.id, naturalPrompt)}
                          disabled={!hasImage}
                        >
                          {hasImage ? "Generate Video" : "Generate Image First"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {scenes.length > 0 && (
          <div className="ugc-card compact" style={{ marginTop: 12 }}>
            <button
              className="ugc-expert-toggle"
              onClick={() => setShowExpertControls(!showExpertControls)}
            >
              <span>⚙️ Video Expert Controls</span>
              <span>{showExpertControls ? "−" : "+"}</span>
            </button>
            
            {showExpertControls && (
              <div className="ugc-expert-panel">
                <div className="ugc-expert-section">
                  <div className="ugc-grid2">
                    <div>
                      <label className="ugc-label small">FPS</label>
                      <select
                        className="ugc-select small"
                        value={expertParams.video.fps}
                        onChange={(e) => setExpertParams(prev => ({
                          ...prev,
                          video: {...prev.video, fps: Number(e.target.value)}
                        }))}
                      >
                        <option value="24">24 fps</option>
                        <option value="30">30 fps</option>
                        <option value="60">60 fps</option>
                      </select>
                    </div>
                    <div>
                      <label className="ugc-label small">Duration</label>
                      <input
                        type="number"
                        className="ugc-input small"
                        value={expertParams.video.duration}
                        onChange={(e) => setExpertParams(prev => ({
                          ...prev,
                          video: {...prev.video, duration: Number(e.target.value)}
                        }))}
                        min="3"
                        max="10"
                      />
                    </div>
                  </div>
                </div>
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
          <div className="ugc-muted-box compact">
            No voice-over data. Generate blueprint first.
          </div>
        </div>
      );
    }
    
    return (
      <div className="ugc-container">
        <div className="ugc-card compact">
          {vo.style && (
            <div className="ugc-field-row compact">
              <span className="ugc-label">Style:</span>
              <span className="ugc-muted">{vo.style}</span>
            </div>
          )}
          
          {vo.script && vo.script.length > 0 && (
            <div className="ugc-vo-scripts">
              {vo.script.map((line, idx) => (
                <div key={idx} className="ugc-vo-line compact">
                  <span className="ugc-chip ok small">{line.beat_id}</span>
                  <span className="ugc-vo-text">{line.line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="ugc-card compact" style={{ marginTop: 12 }}>
          <button
            className="ugc-expert-toggle"
            onClick={() => setShowExpertControls(!showExpertControls)}
          >
            <span>⚙️ Audio Expert Controls</span>
            <span>{showExpertControls ? "−" : "+"}</span>
          </button>
          
          {showExpertControls && (
            <div className="ugc-expert-panel">
              <div className="ugc-grid2">
                <div>
                  <label className="ugc-label small">Voice</label>
                  <select
                    className="ugc-select small"
                    value={expertParams.audio.voice}
                    onChange={(e) => setExpertParams(prev => ({
                      ...prev,
                      audio: {...prev.audio, voice: e.target.value}
                    }))}
                  >
                    <option value="natural">Natural</option>
                    <option value="energetic">Energetic</option>
                    <option value="calm">Calm</option>
                  </select>
                </div>
                <div>
                  <label className="ugc-label small">Speed</label>
                  <input
                    type="number"
                    className="ugc-input small"
                    value={expertParams.audio.speed}
                    onChange={(e) => setExpertParams(prev => ({
                      ...prev,
                      audio: {...prev.audio, speed: Number(e.target.value)}
                    }))}
                    min="0.5"
                    max="2.0"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          )}
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
      case "video": return <VideoTab />;
      case "vo": return <VOTab />;
      default: return <SettingsTab />;
    }
  }, [tab, draft, blueprint, generating, error, sceneImages, generatingImages, sceneVideos, generatingVideos, expandedScenes, showJsonMode, showExpertControls]);
  
  return (
    <div className="ugc-page">
      <div className="ugc-topbar">
        <div className="ugc-topbar-inner">
          <div className="ugc-title">UGC Studio</div>
          
          <div className="ugc-top-actions">
            <button
              type="button"
              className="ugc-pill-btn"
              onClick={toggleTheme}
            >
              {theme === "dark" ? "☀️" : "🌙"}
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
      
      {currentTab}
      
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
    </div>
  );
}
