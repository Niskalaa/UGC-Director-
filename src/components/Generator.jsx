import { useEffect, useRef, useState } from "react";

const API_BASE = ""; // same domain (Vercel). Keep empty.

export default function Generator() {
  const [type, setType] = useState("image");
  const [brief, setBrief] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [log, setLog] = useState("");
  const pollTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const appendLog = (msg) => {
    setLog((prev) => `${prev}${prev ? "\n" : ""}${msg}`);
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

        // stop when done/failed
        if (j.status === "done" || j.status === "failed") {
          clearInterval(pollTimer.current);
          pollTimer.current = null;
          appendLog(`Polling stopped: ${j.status}`);
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
    setImageUrl("");
    setVideoUrl("");
    setLog("");
    setStatus("starting...");

    if (!brief.trim()) {
      setStatus("error");
      appendLog("Brief masih kosong.");
      return;
    }

    try {
      const r = await fetch(`${API_BASE}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, brief: brief.trim() })
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

      // If video/both, polling is needed.
      if (type === "video" || type === "both") {
        appendLog("Start polling...");
        startPolling(j.id);
      }
    } catch (e) {
      setStatus("error");
      appendLog(`Generate exception: ${String(e?.message || e)}`);
    }
  };

  const onCheckNow = async () => {
    if (!jobId) {
      appendLog("Tidak ada Job ID.");
      return;
    }
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

  const onStopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
      appendLog("Polling stopped manually.");
    }
  };

  return (
    <div style={styles.wrap}>
      <h2 style={styles.h2}>UGC Generator</h2>

      <div style={styles.card}>
        <label style={styles.label}>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} style={styles.input}>
          <option value="image">image</option>
          <option value="video">video</option>
          <option value="both">both</option>
        </select>

        <label style={styles.label}>Brief</label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Contoh: Buat UGC 5 detik produk skincare, studio lighting, natural, close-up product + model..."
          style={{ ...styles.input, height: 120, resize: "vertical" }}
        />

        <div style={styles.row}>
          <button onClick={onGenerate} style={styles.btnPrimary}>
            Generate
          </button>
          <button onClick={onCheckNow} style={styles.btn}>
            Check Now
          </button>
          <button onClick={onStopPolling} style={styles.btn}>
            Stop Poll
          </button>
        </div>

        <div style={styles.meta}>
          <div><b>Status:</b> {status || "-"}</div>
          <div><b>Job ID:</b> {jobId || "-"}</div>
        </div>
      </div>

      {(imageUrl || videoUrl) && (
        <div style={styles.card}>
          <h3 style={styles.h3}>Output</h3>

          {imageUrl && (
            <div style={{ marginBottom: 16 }}>
              <div style={styles.small}><b>Image URL</b></div>
              <a href={imageUrl} target="_blank" rel="noreferrer">{imageUrl}</a>
              <div style={{ marginTop: 10 }}>
                <img src={imageUrl} alt="generated" style={styles.img} />
              </div>
            </div>
          )}

          {videoUrl && (
            <div>
              <div style={styles.small}><b>Video URL</b></div>
              <a href={videoUrl} target="_blank" rel="noreferrer">{videoUrl}</a>
              <div style={{ marginTop: 10 }}>
                <video src={videoUrl} controls playsInline style={styles.video} />
              </div>
            </div>
          )}
        </div>
      )}

      <div style={styles.card}>
        <h3 style={styles.h3}>Log</h3>
        <pre style={styles.pre}>{log || "(empty)"}</pre>
      </div>
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 820, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui" },
  h2: { margin: "0 0 12px 0" },
  h3: { margin: "0 0 10px 0" },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    background: "#fff"
  },
  label: { display: "block", fontSize: 13, margin: "10px 0 6px 0", color: "#374151" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    outline: "none",
    fontSize: 14
  },
  row: { display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" },
  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
    cursor: "pointer"
  },
  btn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer"
  },
  meta: { marginTop: 12, fontSize: 13, color: "#111827", display: "grid", gap: 6 },
  small: { fontSize: 13, color: "#111827" },
  pre: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
    background: "#0b1020",
    color: "#d1d5db",
    padding: 12,
    borderRadius: 10,
    fontSize: 12
  },
  img: { width: "100%", maxWidth: 520, borderRadius: 12, border: "1px solid #e5e7eb" },
  video: { width: "100%", maxWidth: 520, borderRadius: 12, border: "1px solid #e5e7eb" }
};
