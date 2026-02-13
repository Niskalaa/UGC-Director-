import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "";

// Simple “model selector” (front-end labels). API tetap pakai ENV model id.
const MODEL_PRESETS = {
  image: [{ key: "sd35", label: "Stable Diffusion 3.5 Large (Bedrock)" }],
  video: [{ key: "ray2", label: "Luma Ray2 (Bedrock)" }]
};

export default function GeneratorInteractive() {
  const [mode, setMode] = useState("image"); // image | video | both
  const [imageModelKey, setImageModelKey] = useState("sd35");
  const [videoModelKey, setVideoModelKey] = useState("ray2");

  const [brief, setBrief] = useState("");
  const [negative, setNegative] = useState(
    "blurry, lowres, watermark, text, distorted, bad anatomy, extra fingers, extra limbs, ai look"
  );

  const [aspect, setAspect] = useState("1:1");
  const [quality, setQuality] = useState("standard"); // draft | standard | high
  const [seed, setSeed] = useState("");
  const [videoSeconds, setVideoSeconds] = useState(5);

  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [log, setLog] = useState("");

  const pollTimer = useRef(null);

  useEffect(() => {
    return () => pollTimer.current && clearInterval(pollTimer.current);
  }, []);

  const appendLog = (msg) => setLog((p) => `${p}${p ? "\n" : ""}${msg}`);

  const selectedImageModel = useMemo(
    () => MODEL_PRESETS.image.find((m) => m.key === imageModelKey),
    [imageModelKey]
  );

  const selectedVideoModel = useMemo(
    () => MODEL_PRESETS.video.find((m) => m.key === videoModelKey),
    [videoModelKey]
  );

  const resetOutputs = () => {
    setImageUrl("");
    setVideoUrl("");
    setStatus("");
    setLog("");
  };

  const startPolling = (id) => {
    if (pollTimer.current) clearInterval(pollTimer.current);

    pollTimer.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/jobs/${id}`);
        const j = await r.json();

        if (!r.ok) {
          setStatus("error");
          appendLog(`Poll error: ${JSON.stringify(j)}`);
          clearInterval(pollTimer.current);
          pollTimer.current = null;
          return;
        }

        setStatus(j.status || "processing");
        if (j.image_url) setImageUrl(j.image_url);
        if (j.video_url) setVideoUrl(j.video_url);

        if (j.status === "done" || j.status === "failed") {
          appendLog(`Polling stopped: ${j.status}`);
          clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
      } catch (e) {
        setStatus("error");
        appendLog(`Poll exception: ${String(e?.message || e)}`);
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }, 3500);
  };

  const onGenerate = async () => {
    resetOutputs();

    if (!brief.trim()) {
      setStatus("error");
      appendLog("Brief masih kosong.");
      return;
    }

    setStatus("starting...");
    try {
      const payload = {
        type: mode,
        brief: brief.trim(),
        negative: negative?.trim() || "",
        settings: {
          aspect_ratio: aspect,
          quality,
          seed: seed ? Number(seed) : undefined,
          video_seconds: Number(videoSeconds)
        },
        models: {
          image: selectedImageModel?.key,
          video: selectedVideoModel?.key
        }
      };

      const r = await fetch(`${API_BASE}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const j = await r.json();
      if (!r.ok) {
        setStatus("error");
        appendLog(`Generate error: ${JSON.stringify(j)}`);
        return;
      }

      setJobId(j.id);
      setStatus(j.status || "processing");
      if (j.image_url) setImageUrl(j.image_url);
      if (j.video_url) setVideoUrl(j.video_url);

      appendLog(`Job created: ${j.id}`);
      appendLog(`Status: ${j.status}`);

      if (mode === "video" || mode === "both") {
        appendLog("Start polling...");
        startPolling(j.id);
      }
    } catch (e) {
      setStatus("error");
      appendLog(`Generate exception: ${String(e?.message || e)}`);
    }
  };

  const onCheckNow = async () => {
    if (!jobId) return appendLog("Tidak ada Job ID.");

    try {
      const r = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      const j = await r.json();

      if (!r.ok) {
        setStatus("error");
        appendLog(`Check error: ${JSON.stringify(j)}`);
        return;
      }

      setStatus(j.status || "processing");
      if (j.image_url) setImageUrl(j.image_url);
      if (j.video_url) setVideoUrl(j.video_url);

      appendLog(`Checked: ${j.status}`);
    } catch (e) {
      setStatus("error");
      appendLog(`Check exception: ${String(e?.message || e)}`);
    }
  };

  const onStopPoll = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
      appendLog("Polling stopped manually.");
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <h2 style={{ margin: 0 }}>UGC Director — Interactive Generator</h2>
        <div style={S.badge}>{status || "idle"}</div>
      </div>

      <div style={S.grid}>
        <div style={S.card}>
          <div style={S.row2}>
            <div>
              <div style={S.label}>Mode</div>
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={S.input}>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div>
              <div style={S.label}>Aspect</div>
              <select value={aspect} onChange={(e) => setAspect(e.target.value)} style={S.input}>
                <option value="1:1">1:1 (Square)</option>
                <option value="9:16">9:16 (Reels/TikTok)</option>
                <option value="16:9">16:9 (YouTube)</option>
                <option value="4:5">4:5 (IG Feed)</option>
              </select>
            </div>
          </div>

          <div style={S.row2}>
            <div>
              <div style={S.label}>Quality</div>
              <select value={quality} onChange={(e) => setQuality(e.target.value)} style={S.input}>
                <option value="draft">Draft</option>
                <option value="standard">Standard</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <div style={S.label}>Seed (optional)</div>
              <input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="e.g. 42"
                style={S.input}
                inputMode="numeric"
              />
            </div>
          </div>

          {(mode === "video" || mode === "both") && (
            <div style={S.row2}>
              <div>
                <div style={S.label}>Video seconds</div>
                <input
                  type="range"
                  min="3"
                  max="10"
                  value={videoSeconds}
                  onChange={(e) => setVideoSeconds(e.target.value)}
                  style={{ width: "100%" }}
                />
                <div style={S.mini}>{videoSeconds}s</div>
              </div>
              <div style={{ opacity: 0.8, fontSize: 12 }}>
                Ray2 async — auto poll sampai selesai
              </div>
            </div>
          )}

          <div style={S.label}>Brief</div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            style={{ ...S.input, height: 140, resize: "vertical" }}
            placeholder="Contoh: UGC skincare, studio lighting, model memegang produk, close-up label..."
          />

          <div style={S.label}>Negative (optional)</div>
          <textarea
            value={negative}
            onChange={(e) => setNegative(e.target.value)}
            style={{ ...S.input, height: 90, resize: "vertical" }}
          />

          <div style={S.hr} />

          <div style={S.row2}>
            <div>
              <div style={S.label}>Image model</div>
              <select
                value={imageModelKey}
                onChange={(e) => setImageModelKey(e.target.value)}
                style={S.input}
                disabled={mode === "video"}
              >
                {MODEL_PRESETS.image.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={S.label}>Video model</div>
              <select
                value={videoModelKey}
                onChange={(e) => setVideoModelKey(e.target.value)}
                style={S.input}
                disabled={mode === "image"}
              >
                {MODEL_PRESETS.video.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={S.rowBtns}>
            <button style={S.btnPrimary} onClick={onGenerate}>Generate</button>
            <button style={S.btn} onClick={onCheckNow}>Check Now</button>
            <button style={S.btn} onClick={onStopPoll}>Stop Poll</button>
          </div>

          <div style={S.meta}>
            <div><b>Job ID:</b> {jobId || "-"}</div>
          </div>
        </div>

        <div style={S.card}>
          <h3 style={{ marginTop: 0 }}>Output</h3>

          {!imageUrl && !videoUrl && <div style={{ opacity: 0.7 }}>Belum ada output.</div>}

          {imageUrl && (
            <div style={{ marginTop: 10 }}>
              <div style={S.small}><b>Image</b></div>
              <a href={imageUrl} target="_blank" rel="noreferrer">{imageUrl}</a>
              <div style={{ marginTop: 10 }}>
                <img src={imageUrl} alt="generated" style={S.media} />
              </div>
            </div>
          )}

          {videoUrl && (
            <div style={{ marginTop: 16 }}>
              <div style={S.small}><b>Video</b></div>
              <a href={videoUrl} target="_blank" rel="noreferrer">{videoUrl}</a>
              <div style={{ marginTop: 10 }}>
                <video src={videoUrl} controls playsInline style={S.media} />
              </div>
            </div>
          )}

          <div style={S.hr} />
          <h3 style={{ marginBottom: 8 }}>Log</h3>
          <pre style={S.pre}>{log || "(empty)"}</pre>
        </div>
      </div>
    </div>
  );
}

const S = {
  wrap: { maxWidth: 1100, margin: "18px auto", padding: "0 14px", fontFamily: "system-ui" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  badge: { padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", fontSize: 12, opacity: 0.9 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  card: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#fff" },
  label: { fontSize: 12, margin: "10px 0 6px", color: "#374151" },
  input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  rowBtns: { display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" },
  btnPrimary: { padding: "10px 14px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" },
  btn: { padding: "10px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" },
  meta: { marginTop: 10, fontSize: 13 },
  hr: { height: 1, background: "#e5e7eb", margin: "12px 0" },
  pre: { whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, background: "#0b1020", color: "#d1d5db", padding: 12, borderRadius: 10, fontSize: 12 },
  small: { fontSize: 13 },
  mini: { fontSize: 12, opacity: 0.75, marginTop: 4 },
  media: { width: "100%", maxWidth: 520, borderRadius: 12, border: "1px solid #e5e7eb" }
};
