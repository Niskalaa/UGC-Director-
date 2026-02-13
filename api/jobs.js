// api/jobs.js
// FINAL ✅ (Riverflow-ready + HF router + undici fallback)
import { createClient } from "@supabase/supabase-js";
import { orchestrate } from "../internal/orchestrate.js";
import { fetch as undiciFetch } from "undici";

// Prefer global fetch, fallback to undici
const fetchFn = globalThis.fetch || undiciFetch;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_NEG =
  "blurry, lowres, watermark, text artifacts, distorted face, extra fingers, extra limbs, bad anatomy, ai look, overprocessed";

const OR_BASE = "https://openrouter.ai/api/v1"; // ✅ official base url
const OR_REFERRER = process.env.OPENROUTER_REFERRER || "https://xklaa.vercel.app";
const OR_APP_NAME = process.env.OPENROUTER_APP_NAME || "UGC-Director";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let jobId = null;

  try {
    if (!process.env.SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const { type, brief } = req.body || {};
    if (!type || !brief) return res.status(400).json({ error: "type & brief required" });
    if (!["image", "video", "both"].includes(type)) {
      return res.status(400).json({ error: "type must be image|video|both" });
    }

    // 1) create job row
    const { data: job, error: e1 } = await supabase
      .from("generation_jobs")
      .insert({
        type: type === "both" ? "image" : type,
        status: "processing",
        prompt: "",
        negative: "",
        provider: ""
      })
      .select("*")
      .single();

    if (e1) throw e1;
    jobId = job.id;

    // 2) orchestrate (Gemini) with fallback
    let plan;
    try {
      plan = await orchestrate({ type, brief });
    } catch (e) {
      console.error("Orchestrate failed, fallback to direct brief:", safeErr(e));
      plan = {
        image: { prompt: brief, negative: DEFAULT_NEG },
        video: { prompt: brief, negative: DEFAULT_NEG }
      };
    }

    const outputs = {};

    // 3) IMAGE via OpenRouter (Riverflow)
    if (type === "image" || type === "both") {
      const p = plan?.image?.prompt;
      if (!p) throw new Error("Orchestrator missing image.prompt");

      const neg = plan?.image?.negative || DEFAULT_NEG;

      const img = await withRetry(
        () => generateImageOpenRouter(p, neg),
        { attempts: 3, baseDelayMs: 1500 }
      );

      const path = `image/${job.id}.png`;
      await uploadToSupabase(path, img.buffer, img.contentType);

      const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);
      outputs.image_url = pub.publicUrl;

      await supabase
        .from("generation_jobs")
        .update({
          prompt: p,
          negative: neg,
          provider: "openrouter",
          output_path: path,
          output_url: pub.publicUrl,
          status: "done"
        })
        .eq("id", job.id);
    }

    // 4) VIDEO via Hugging Face Router (hf-inference)
    if (type === "video" || type === "both") {
      const p = plan?.video?.prompt;
      if (!p) throw new Error("Orchestrator missing video.prompt");

      const neg = plan?.video?.negative || DEFAULT_NEG;

      const vid = await withRetry(
        () => generateVideoHF(p, neg),
        { attempts: 3, baseDelayMs: 2000 }
      );

      const path = `video/${job.id}.mp4`;
      await uploadToSupabase(path, vid.buffer, vid.contentType);

      const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);
      outputs.video_url = pub.publicUrl;

      await supabase
        .from("generation_jobs")
        .update({
          prompt: p,
          negative: neg,
          provider: "huggingface",
          output_path: path,
          output_url: pub.publicUrl,
          status: "done"
        })
        .eq("id", job.id);
    }

    return res.status(200).json({
      id: job.id,
      status: "done",
      plan,
      ...outputs
    });
  } catch (err) {
    console.error(err);

    // best-effort mark job failed
    if (jobId) {
      try {
        await supabase.from("generation_jobs").update({ status: "failed" }).eq("id", jobId);
      } catch (e) {
        console.error("Failed to mark job failed:", safeErr(e));
      }
    }

    return res.status(500).json({ error: String(err?.message || err) });
  }
}

// ---------- helpers ----------

function safeErr(e) {
  try {
    if (!e) return "";
    if (typeof e === "string") return e;
    return e?.message ? String(e.message) : JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function uploadToSupabase(path, buffer, contentType) {
  const { error } = await supabase.storage
    .from("generations")
    .upload(path, buffer, { contentType, upsert: true });

  if (error) throw error;
}

async function withRetry(fn, { attempts = 3, baseDelayMs = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e).toLowerCase();

      const retryable =
        msg.includes("429") ||
        msg.includes("rate") ||
        msg.includes("503") ||
        msg.includes("resource_exhausted") ||
        msg.includes("temporarily") ||
        msg.includes("loading") ||
        msg.includes("fetch failed") ||
        msg.includes("etimedout") ||
        msg.includes("econnreset") ||
        msg.includes("enotfound");

      if (!retryable || i === attempts - 1) break;

      const delay = baseDelayMs * (i + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ---------- providers ----------

/**
 * OpenRouter image generation (works for sourceful/riverflow-v2-pro)
 * Env required:
 * - OPENROUTER_API_KEY
 * - OPENROUTER_IMAGE_MODEL = sourceful/riverflow-v2-pro
 */
async function generateImageOpenRouter(prompt, negative) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");

  const model = process.env.OPENROUTER_IMAGE_MODEL;
  if (!model) throw new Error("Missing OPENROUTER_IMAGE_MODEL");

  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  const call = async (modalities) => {
    const r = await fetchFn(`${OR_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OR_REFERRER,
        "X-Title": OR_APP_NAME
      },
      body: JSON.stringify({
        model,
        modalities,
        messages: [{ role: "user", content: fullPrompt }]
      })
    });

    const raw = await r.text();
    if (!r.ok) throw new Error(`OpenRouter error: ${r.status} ${raw}`);

    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(`OpenRouter returned non-JSON: ${raw.slice(0, 200)}`);
    }
    return json;
  };

  // Try image+text first, fallback to image-only if provider complains
  let json;
  try {
    json = await call(["image", "text"]);
  } catch (e) {
    const m = String(e?.message || e);
    if (m.includes("output modalities") || m.includes("No endpoints")) {
      json = await call(["image"]);
    } else {
      throw e;
    }
  }

  const msg = json?.choices?.[0]?.message;

  // Riverflow often returns in message.images
  let data = null;

  if (!data && Array.isArray(msg?.images) && msg.images.length) data = msg.images[0];

  if (!data && Array.isArray(msg?.content)) {
    const found =
      msg.content.find((c) => c?.type === "image_url")?.image_url?.url ||
      msg.content.find((c) => c?.type === "image")?.image_url?.url;
    if (found) data = found;
  }

  if (!data && typeof msg?.content === "string") data = msg.content;

  if (!data && Array.isArray(json?.images) && json.images.length) data = json.images[0];

  if (!data) {
    const shape = (() => {
      try {
        return JSON.stringify({
          msgKeys: msg ? Object.keys(msg) : null,
          contentType: Array.isArray(msg?.content) ? "array" : typeof msg?.content,
          imagesType: Array.isArray(msg?.images) ? typeof msg.images[0] : typeof msg?.images
        });
      } catch {
        return "";
      }
    })();
    throw new Error(`No image returned. responseShape=${shape}`);
  }

  let str = data;
  if (typeof data === "object" && data?.url && typeof data.url === "string") str = data.url;
  if (typeof str !== "string") throw new Error("Unsupported image payload type");

  // If URL: download
  if (str.startsWith("http://") || str.startsWith("https://")) {
    const imgRes = await fetchFn(str);
    if (!imgRes.ok) throw new Error(`Image URL download failed: ${imgRes.status} ${await imgRes.text()}`);
    const ab = await imgRes.arrayBuffer();
    const ct = imgRes.headers.get("content-type") || "image/png";
    return { buffer: Buffer.from(ab), contentType: ct };
  }

  // data url / base64
  let b64 = str;
  if (str.includes("base64,")) b64 = str.split("base64,")[1];

  const buffer = Buffer.from(b64, "base64");
  return { buffer, contentType: "image/png" };
}

/**
 * Hugging Face text-to-video (HF Router)
 * Env required:
 * - HF_TOKEN
 * Optional:
 * - HF_VIDEO_MODEL (default: THUDM/CogVideoX-2b)
 */
async function generateVideoHF(prompt, negative) {
  if (!process.env.HF_TOKEN) throw new Error("Missing HF_TOKEN");

  const model = process.env.HF_VIDEO_MODEL || "THUDM/CogVideoX-2b";
  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  const url = `https://router.huggingface.co/hf-inference/models/${model}`;

  const r = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: fullPrompt })
  });

  const ct = r.headers.get("content-type") || "";

  // HF often returns JSON (model loading/queued/errors)
  if (ct.includes("application/json")) {
    const j = await r.json().catch(() => ({}));
    const msg = j?.error || j?.message || JSON.stringify(j);
    throw new Error(`HF returned JSON (not video): ${r.status} ${msg}`);
  }

  if (!r.ok) throw new Error(`HF error: ${r.status} ${await r.text()}`);

  const arrayBuffer = await r.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, contentType: "video/mp4" };
}
