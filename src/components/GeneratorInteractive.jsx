import React, { useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";

const DEFAULTS = {
  provider: "bedrock",
  platform: "tiktok",
  aspect_ratio: "9:16",
  brand: "",
  product_type: "",
  material: "",
  tone: "natural gen-z",
  target_audience: "",
  product_page_url: "",
  model_ref_url: "",
  product_ref_url: "",
  project_id: "local",
};

function safeJsonParseLoose(content) {
  try {
    return JSON.parse(content);
  } catch {
    const s = String(content || "");
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error("Invalid JSON");
  }
}

function buildVisualPrompt(form) {
  // Visual prompt = image prompt (non-video)
  const parts = [];

  // product context
  const productLine = [form.brand, form.product_type].filter(Boolean).join(" ");
  if (productLine) parts.push(`Product: ${productLine}.`);
  if (form.material) parts.push(`Material: ${form.material}.`);

  // UGC style anchor
  parts.push(
    [
      "Photorealistic UGC product photo, clean commercial look",
      "natural lighting, realistic textures",
      "handheld phone camera vibe, sharp focus, high detail",
      `aspect ratio ${form.aspect_ratio}`,
    ].join(", ") + "."
  );

  // optional tone/audience
  if (form.tone) parts.push(`Tone: ${form.tone}.`);
  if (form.target_audience) parts.push(`Target audience: ${form.target_audience}.`);

  // optional hints from URL
  if (form.product_page_url) parts.push(`Reference context: ${form.product_page_url}`);

  // identity locks via reference images (handled by backend if you use them there)
  if (form.model_ref_url) parts.push("Model reference provided (keep face/outfit consistent).");
  if (form.product_ref_url) parts.push("Product reference provided (keep product identical).");

  // negatives
  parts.push(
    "Negative: blurry, low-res, over-smoothing, plastic skin, distorted text, watermark, deformed hands, extra fingers, bad anatomy, AI artifacts, cartoon, anime."
  );

  return parts.join("\n");
}

async function postJobImage({ brief, aspect_ratio }) {
  const payload = {
    type: "image",
    brief,
    settings: { aspect_ratio },
  };

  const r = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await r.text();
  let json;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`Non-JSON jobs response (${r.status}). Preview: ${String(raw).slice(0, 160)}`);
  }

  if (!r.ok) throw new Error(json?.error || `Jobs failed (${r.status})`);

  const imageUrl = json?.imageUrl || json?.image_url || json?.imageURL || "";
  return {
    id: json?.id,
    status: json?.status || "done",
    imageUrl,
    raw: json,
  };
}

export default function GeneratorInteractive() {
  const [form, setForm] = useState(DEFAULTS);

  const [visualPrompt, setVisualPrompt] = useState("");
  const [job, setJob] = useState(null); // {id,status,imageUrl}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  function showToast(msg, tone = "ok") {
    setToast({ msg, tone, ts: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  const canGen = useMemo(() => {
    // minimum requirements: brand/product/material + refs optional
    if (!String(form.brand || "").trim()) return false;
    if (!String(form.product_type || "").trim()) return false;
    if (!String(form.material || "").trim()) return false;
    return true;
  }, [form]);

  function onBuildPrompt() {
    const p = buildVisualPrompt(form);
    setVisualPrompt(p);
    setErr("");
    showToast("Visual prompt ready ✓", "ok");
  }

  async function onGenerateImage() {
    setErr("");
    setJob(null);

    const brief = visualPrompt || buildVisualPrompt(form);
    setVisualPrompt(brief);

    setBusy(true);
    try {
      const j = await postJobImage({ brief, aspect_ratio: form.aspect_ratio });
      setJob(j);

      if (j.imageUrl) showToast("Image ready ✓", "ok");
      else showToast("Job done but no image URL", "bad");
    } catch (e) {
      setErr(e?.message || String(e));
      showToast("Failed", "bad");
    } finally {
      setBusy(false);
    }
  }

  function openJson(obj) {
    const w = window.open("", "_blank");
    if (!w) return;
    const safe = (x) =>
      String(x).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    w.document.write(
      `<pre style="white-space:pre-wrap; font-family: ui-monospace, Menlo, monospace; padding:16px;">${safe(
        JSON.stringify(obj, null, 2)
      )}</pre>`
    );
    w.document.close();
  }

  return (
    <div className="ugc-page">
      {/* simple top area (reuse global topbar styles) */}
      <div className="ugc-topbar">
        <div className="ugc-topbar-inner">
          <div className="ugc-title">Generator</div>
          <div className="ugc-top-actions">
            <span className="ugc-chip">Image only</span>
            <span className="ugc-chip">/api/jobs</span>
          </div>
        </div>
      </div>

      <div className="ugc-container">
        <div className="ugc-card">
          <div className="ugc-cardheader">
            <div className="ugc-cardtitle">Inputs</div>
            <div className="ugc-cardsub">Generate visual_prompt → user clicks render image.</div>
          </div>

          <div className="ugc-grid2">
            <div>
              <div className="ugc-label">AI Brain</div>
              <select
                className="ugc-select"
                value={form.provider}
                onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
              >
                <option value="bedrock">Bedrock</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>

            <div>
              <div className="ugc-label">Aspect ratio</div>
              <select
                className="ugc-select"
                value={form.aspect_ratio}
                onChange={(e) => setForm((p) => ({ ...p, aspect_ratio: e.target.value }))}
              >
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
              </select>
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="ugc-grid2">
            <div>
              <div className="ugc-label">Brand *</div>
              <input
                className="ugc-input"
                value={form.brand}
                onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
              />
            </div>
            <div>
              <div className="ugc-label">Product type *</div>
              <input
                className="ugc-input"
                value={form.product_type}
                onChange={(e) => setForm((p) => ({ ...p, product_type: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="ugc-grid2">
            <div>
              <div className="ugc-label">Material *</div>
              <input
                className="ugc-input"
                value={form.material}
                onChange={(e) => setForm((p) => ({ ...p, material: e.target.value }))}
              />
            </div>
            <div>
              <div className="ugc-label">Tone (optional)</div>
              <input
                className="ugc-input"
                value={form.tone}
                onChange={(e) => setForm((p) => ({ ...p, tone: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="ugc-grid2">
            <div>
              <div className="ugc-label">Target audience (optional)</div>
              <input
                className="ugc-input"
                value={form.target_audience}
                onChange={(e) => setForm((p) => ({ ...p, target_audience: e.target.value }))}
              />
            </div>
            <div>
              <div className="ugc-label">Product page URL (optional)</div>
              <input
                className="ugc-input"
                value={form.product_page_url}
                onChange={(e) => setForm((p) => ({ ...p, product_page_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <div style={{ height: 14 }} />
          <div className="ugc-sectiontitle">Assets (optional)</div>

          <div className="ugc-grid2">
            <ImageUploadField
              label="Model reference (optional)"
              kind="model"
              projectId={form.project_id}
              valueUrl={form.model_ref_url}
              onUrl={(url) => setForm((p) => ({ ...p, model_ref_url: url }))}
              showPreview
              optional
            />
            <ImageUploadField
              label="Product reference (optional)"
              kind="product"
              projectId={form.project_id}
              valueUrl={form.product_ref_url}
              onUrl={(url) => setForm((p) => ({ ...p, product_ref_url: url }))}
              showPreview
              optional
            />
          </div>

          <div className="ugc-row-actions" style={{ marginTop: 14, justifyContent: "flex-end" }}>
            <button className="ugc-btn" onClick={() => setForm(DEFAULTS)}>
              Reset
            </button>

            <button className="ugc-btn" disabled={!canGen} onClick={onBuildPrompt}>
              Build visual_prompt
            </button>

            <button className="ugc-btn primary" disabled={!canGen || busy} onClick={onGenerateImage}>
              {busy ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span className="ugc-spinner" />
                  Generating…
                </span>
              ) : (
                "Generate Image"
              )}
            </button>
          </div>

          {err ? <div className="ugc-error" style={{ marginTop: 12 }}>{err}</div> : null}
        </div>

        {/* OUTPUT */}
        <div className="ugc-card" style={{ marginTop: 14 }}>
          <div className="ugc-cardheader">
            <div className="ugc-cardtitle">Output</div>
            <div className="ugc-cardsub">Visual prompt + image preview.</div>
          </div>

          {visualPrompt ? (
            <div className="ugc-row">
              <div className="ugc-row-label">visual_prompt</div>
              <div className="ugc-row-val">{visualPrompt}</div>
              <div className="ugc-row-actions" style={{ marginTop: 10 }}>
                <button className="ugc-btn small" onClick={() => navigator.clipboard.writeText(visualPrompt)}>
                  Copy
                </button>
              </div>
            </div>
          ) : (
            <div className="ugc-muted-box">Belum ada visual_prompt. Klik “Build visual_prompt”.</div>
          )}

          {job ? (
            <div className="ugc-row" style={{ marginTop: 12 }}>
              <div className="ugc-chiprow">
                <span className="ugc-chip ok">job: {job.id || "-"}</span>
                <span className="ugc-chip">{job.status}</span>
              </div>

              <div className="ugc-row-actions" style={{ marginTop: 10 }}>
                <button className="ugc-btn small" onClick={() => openJson(job.raw)}>
                  Open job JSON
                </button>
              </div>

              {job.imageUrl ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--stroke)" }}>
                    <img src={job.imageUrl} alt="generated" style={{ width: "100%", display: "block" }} />
                  </div>

                  <div className="ugc-row-actions" style={{ marginTop: 10 }}>
                    <a className="ugc-btn" href={job.imageUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                    <a className="ugc-btn" href={job.imageUrl} download="generated.png">
                      Download
                    </a>
                  </div>
                </div>
              ) : (
                <div className="ugc-muted-box" style={{ marginTop: 12 }}>
                  Job done tapi image URL kosong.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Toast */}
      {toast ? (
        <div className={`ugc-toast ${toast.tone === "ok" ? "ok" : "bad"}`}>
          {toast.msg}
        </div>
      ) : null}

      <div className="ugc-credit">Created by @adryndian</div>
    </div>
  );
}
