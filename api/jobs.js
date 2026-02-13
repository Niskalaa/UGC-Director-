// api/jobs.js
// FINAL ✅ (supports BOTH image models: sourceful/riverflow-v2-pro + google/gemini-3-pro-image-preview)
// - Supabase job row + upload to Storage bucket "generations" (public)
// - Gemini orchestrate fallback -> direct brief
// - OpenRouter image via https://openrouter.ai/api/v1/chat/completions
//   * Auto modalities by model:
//       - google/gemini-3-pro-image-preview  -> ["image","text"]
//       - sourceful/riverflow-v2-pro         -> tries ["image","text"] then fallback ["image"]
//   * Super-flexible parsing across providers (content[] image_url, msg.images, content string, json.images)
//   * Robust object normalization (url, image_url.url, image_url, b64_json, base64, output_url, data)
//   * Supports URL download OR data-url OR raw base64
// - HF video via https://router.huggingface.co/hf-inference/models/:model
// - fetch fallback via undici
// - retry/backoff
// - marks job failed on error
import { createClient } from "@supabase/supabase-js";
import { orchestrate } from "../internal/orchestrate.js";
import { fetch as undiciFetch } from "undici";

const fetchFn = globalThis.fetch || undiciFetch;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_NEG =
  "blurry, lowres, watermark, text artifacts, distorted face, extra fingers, extra limbs, bad anatomy, ai look, overprocessed";

const OR_BASE = "https://openrouter.ai/api/v1";
const OR_REFERRER = process.env.OPENROUTER_REFERRER || "https://xklaa.vercel.app";
const OR_APP_NAME = process.env.OPENROUTER_APP_NAME || "UGC-Director";

// You can set one default image model in ENV:
const DEFAULT_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || "sourceful/riverflow-v2-pro";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let jobId = null;

  try {
    if (!process.env.SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const { type, brief, image_model } = req.body || {};
    if (!type || !brief) return res.status(400).json({ error: "type & brief required" });
    if (!["image", "video", "both"].includes(type)) {
      return res.status(400).json({ error: "type must be image|video|both" });
    }

    // allow override per request
    const chosenImageModel = typeof image_model === "string" && image_model.trim()
      ? image_model.trim()
      : DEFAULT_IMAGE_MODEL;

    // 1) Create job row
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

    // 2) Orchestrate via Gemini (fallback if quota/429)
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

    // 3) IMAGE via OpenRouter (Riverflow + Gemini image preview supported)
    if (type === "image" || type === "both") {
      const p = plan?.image?.prompt;
      if (!p) throw new Error("Orchestrator missing image.prompt");

      const neg = plan?.image?.negative || DEFAULT_NEG;

      const img = await withRetry(
        () => generateImageOpenRouter(chosenImageModel, p, neg),
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

    // 4) VIDEO via HF Router (hf-inference)
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
      image_model: chosenImageModel,
      plan,
      ...outputs
    });
  } catch (err) {
    console.error(err);

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

// ---------- OpenRouter Image ----------

function modalitiesForModel(model) {
  const m = (model || "").toLowerCase();

  // Gemini image preview typically returns both image+text comfortably
  if (m.includes("google/gemini-3-pro-image-preview")) return [["image", "text"]];

  // Riverflow: try image+text then fallback to image-only if provider complains
  if (m.includes("sourceful/riverflow")) return [["image", "text"], ["image"]];

  // Default safest: image+text then image
  return [["image", "text"], ["image"]];
}

async function generateImageOpenRouter(model, prompt, negative) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");
  if (!model) throw new Error("Missing image model");

  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  const call = async (modalities) => {
    let r;
    try {
      r = await fetchFn(`${OR_BASE}/chat/completions`, {
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
    } catch (e) {
      const cause = e?.cause?.message ? ` | cause: ${e.cause.message}` : "";
      throw new Error(`OpenRouter fetch failed${cause}`);
    }

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

  // Try modalities list in order
  let last;
  for (const mods of modalitiesForModel(model)) {
    try {
      last = await call(mods);
      break;
    } catch (e) {
      const m = String(e?.message || e);
      // If it's a modalities mismatch/endpoints complaint, continue to next mods
      if (m.includes("output modalities") || m.includes("No endpoints")) continue;
      throw e;
    }
  }
  if (!last) throw new Error("OpenRouter failed for all modalities attempts");

  return parseOpenRouterImage(last);
}

function parseOpenRouterImage(json) {
  const msg = json?.choices?.[0]?.message;

  // Extract data candidate
  let data = null;

  // A) message.content[] with image_url
  if (!data && Array.isArray(msg?.content)) {
    const found =
      msg.content.find((c) => c?.type === "image_url")?.image_url?.url ||
      msg.content.find((c) => c?.type === "image")?.image_url?.url ||
      msg.content.find((c) => c?.type === "image_url")?.image_url ||
      msg.content.find((c) => c?.type === "image")?.image_url;
    if (found) data = found;
  }

  // B) message.images[0]
  if (!data && Array.isArray(msg?.images) && msg.images.length) data = msg.images[0];

  // C) message.content string
  if (!data && typeof msg?.content === "string") data = msg.content;

  // D) top-level images (rare)
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

  // Normalize to a string (url or data-url or base64)
  let str = data;

  if (typeof data === "object" && data) {
    if (typeof data.url === "string") str = data.url;
    else if (typeof data.image_url === "string") str = data.image_url;
    else if (typeof data.image_url?.url === "string") str = data.image_url.url;
    else if (typeof data.image?.url === "string") str = data.image.url;
    else if (typeof data.output_url === "string") str = data.output_url;
    else if (typeof data.b64_json === "string") str = `data:image/png;base64,${data.b64_json}`;
    else if (typeof data.base64 === "string") str = `data:image/png;base64,${data.base64}`;
    else if (typeof data.data === "string") str = data.data;
  }

  if (typeof str !== "string") {
    const keys = (() => {
      try {
        return Object.keys(data || {}).join(",");
      } catch {
        return "";
      }
    })();
    throw new Error(`Unsupported image payload type. keys=${keys}`);
  }

  return stringToImageBuffer(str);
}

async function stringToImageBuffer(str) {
  // If it's an http(s) URL, download it
  if (str.startsWith("http://") || str.startsWith("https://")) {
    const imgRes = await fetchFn(str);
    if (!imgRes.ok) throw new Error(`Image URL download failed: ${imgRes.status} ${await imgRes.text()}`);
    const ab = await imgRes.arrayBuffer();
    const ct = imgRes.headers.get("content-type") || "image/png";
    return { buffer: Buffer.from(ab), contentType: ct };
  }

  // Data URL base64
  let b64 = str;
  if (str.includes("base64,")) b64 = str.split("base64,")[1];

  const buffer = Buffer.from(b64, "base64");
  return { buffer, contentType: "image/png" };
}

// ---------- Hugging Face Video ----------

async function generateVideoHF(prompt, negative) {
  if (!process.env.HF_TOKEN) throw new Error("Missing HF_TOKEN");

  const model = process.env.HF_VIDEO_MODEL || "zai-org/CogVideoX-2b";
  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  const url = `https://router.huggingface.co/hf-inference/models/${model}`;

  let r;
  try {
    r = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: fullPrompt })
    });
  } catch (e) {
    const cause = e?.cause?.message ? ` | cause: ${e.cause.message}` : "";
    throw new Error(`HF fetch failed${cause}`);
  }

  const ct = r.headers.get("content-type") || "";

  // HF often returns JSON for status/errors (loading/queued/rate limit)
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
