// api/jobs.js
// ✅ Updated: Gemini-orchestrate fallback + OpenRouter Images API (api.openrouter.ai) + HF router.huggingface.co
// ✅ Added: fetch fallback via undici (fix "fetch failed" on some runtimes)
// ✅ Added: retry/backoff + mark job failed on error
import { createClient } from "@supabase/supabase-js";
import { orchestrate } from "../internal/orchestrate.js";
import { fetch as undiciFetch } from "undici";

// Use global fetch if available, otherwise undici
const fetchFn = globalThis.fetch || undiciFetch;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_NEG =
  "blurry, lowres, watermark, text artifacts, distorted face, extra fingers, extra limbs, bad anatomy, ai look, overprocessed";

const OR_BASE = "https://api.openrouter.ai/v1"; // IMPORTANT: api.openrouter.ai (not openrouter.ai)
const OR_REFERRER = process.env.OPENROUTER_REFERRER || "https://xklaa.vercel.app";
const OR_APP_NAME = process.env.OPENROUTER_APP_NAME || "UGC-Director";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let jobId = null;

  try {
    // Basic env checks
    if (!process.env.SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const { type, brief } = req.body || {};
    if (!type || !brief) return res.status(400).json({ error: "type & brief required" });
    if (!["image", "video", "both"].includes(type)) {
      return res.status(400).json({ error: "type must be image|video|both" });
    }

    // 1) Create job row
    const { data: job, error: e1 } = await supabase
      .from("generation_jobs")
      .insert({
        type: type === "both" ? "image" : type, // primary type stored
        status: "processing",
        prompt: "",
        negative: "",
        provider: ""
      })
      .select("*")
      .single();

    if (e1) throw e1;
    jobId = job.id;

    // 2) Orchestrate via Gemini (fallback if quota/429/etc)
    let plan;
    try {
      plan = await orchestrate({ type, brief });
    } catch (e) {
      console.error("Orchestrate failed, fallback to direct brief:", e?.message || e);
      plan = {
        image: { prompt: brief, negative: DEFAULT_NEG },
        video: { prompt: brief, negative: DEFAULT_NEG }
      };
    }

    const outputs = {};

    // 3) Image via OpenRouter Images API
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

    // 4) Video via Hugging Face Router
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
      plan, // keep for debug; remove later if you want
      ...outputs
    });
  } catch (err) {
    console.error(err);

    // Best-effort: mark job failed if created
    if (jobId) {
      try {
        await supabase.from("generation_jobs").update({ status: "failed" }).eq("id", jobId);
      } catch (e) {
        console.error("Failed to mark job failed:", e);
      }
    }

    return res.status(500).json({ error: String(err?.message || err) });
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
      const msg = String(e?.message || e);

      const retryable =
        msg.includes("429") ||
        msg.toLowerCase().includes("rate") ||
        msg.includes("503") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.toLowerCase().includes("temporarily") ||
        msg.toLowerCase().includes("loading") ||
        msg.toLowerCase().includes("fetch failed");

      if (!retryable || i === attempts - 1) break;

      const delay = baseDelayMs * (i + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * OpenRouter Image (FLUX) - Images API
 * Requires:
 * - OPENROUTER_API_KEY
 * - OPENROUTER_IMAGE_MODEL = black-forest-labs/flux.2-klein-4b
 */
async function generateImageOpenRouter(prompt, negative) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");

  const model = process.env.OPENROUTER_IMAGE_MODEL;
  if (!model) {
    throw new Error("Missing OPENROUTER_IMAGE_MODEL (e.g. black-forest-labs/flux.2-klein-4b)");
  }

  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  const body = {
    model,
    prompt: fullPrompt,
    size: "1024x1024"
  };

  const r = await fetchFn(`${OR_BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OR_REFERRER,
      "X-Title": OR_APP_NAME
    },
    body: JSON.stringify(body)
  });

  const raw = await r.text();
  if (!r.ok) throw new Error(`OpenRouter error: ${r.status} ${raw}`);

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`OpenRouter returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const b64 = json?.data?.[0]?.b64_json;
  const url = json?.data?.[0]?.url;

  if (b64) return { buffer: Buffer.from(b64, "base64"), contentType: "image/png" };

  if (url) {
    const imgRes = await fetchFn(url);
    if (!imgRes.ok) throw new Error(`Failed to download image url: ${imgRes.status} ${await imgRes.text()}`);
    const ab = await imgRes.arrayBuffer();
    const ct = imgRes.headers.get("content-type") || "image/png";
    return { buffer: Buffer.from(ab), contentType: ct };
  }

  throw new Error("OpenRouter images: missing b64_json/url in response");
}

/**
 * Hugging Face text-to-video (NEW endpoint)
 * HF says api-inference.huggingface.co is deprecated -> use router.huggingface.co
 * Env:
 * - HF_TOKEN
 * Optional:
 * - HF_VIDEO_MODEL (default below)
 */
async function generateVideoHF(prompt, negative) {
  if (!process.env.HF_TOKEN) throw new Error("Missing HF_TOKEN");

  const model = process.env.HF_VIDEO_MODEL || "THUDM/CogVideoX-2b";
  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  const r = await fetchFn(`https://router.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: fullPrompt })
  });

  const ct = r.headers.get("content-type") || "";

  // HF often returns JSON errors/status (model loading, rate limit, etc)
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
