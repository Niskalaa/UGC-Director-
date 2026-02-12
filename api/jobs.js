// api/jobs.js
import { createClient } from "@supabase/supabase-js";
import { orchestrate } from "../internal/orchestrate.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_NEG =
  "blurry, lowres, watermark, text, distorted face, bad anatomy, extra fingers, extra limbs, ai look, overprocessed";

const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL; // WAJIB kamu set di Vercel ENV
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const HF_VIDEO_MODEL = process.env.HF_VIDEO_MODEL || "THUDM/CogVideoX-2b"; // bisa kamu ganti via env

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let jobId = null;

  try {
    // Validasi env yang kritikal
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    const { type, brief } = req.body || {};
    if (!type || !brief) return res.status(400).json({ error: "type & brief required" });
    if (!["image", "video", "both"].includes(type)) {
      return res.status(400).json({ error: "type must be image|video|both" });
    }

    // 1) buat job row
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

    // 2) orchestrate via Gemini (dengan fallback)
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

    // 3) generate image via OpenRouter
    if (type === "image" || type === "both") {
      if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");
      if (!OPENROUTER_IMAGE_MODEL) {
        throw new Error(
          "Missing OPENROUTER_IMAGE_MODEL. Set this env var to a valid OpenRouter image model id."
        );
      }

      const p = plan?.image?.prompt;
      if (!p) throw new Error("Orchestrator missing image.prompt");
      const neg = plan?.image?.negative || DEFAULT_NEG;

      const img = await withRetry(
        () => generateImageOpenRouter({ prompt: p, negative: neg, model: OPENROUTER_IMAGE_MODEL }),
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

    // 4) generate video via HF
    if (type === "video" || type === "both") {
      if (!process.env.HF_TOKEN) throw new Error("Missing HF_TOKEN");

      const p = plan?.video?.prompt;
      if (!p) throw new Error("Orchestrator missing video.prompt");
      const neg = plan?.video?.negative || DEFAULT_NEG;

      const vid = await withRetry(
        () => generateVideoHF({ prompt: p, negative: neg, model: HF_VIDEO_MODEL }),
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

    // update job jadi failed biar tidak nyangkut "processing"
    if (jobId) {
      try {
        await supabase
          .from("generation_jobs")
          .update({
            status: "failed",
            // kalau kamu punya kolom error_message, pakai ini:
            // error_message: String(err?.message || err)
          })
          .eq("id", jobId);
      } catch (e) {
        console.error("Failed to update job status to failed:", e);
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
      const shouldRetry =
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("503") ||
        msg.includes("temporarily") ||
        msg.includes("loading");

      if (!shouldRetry || i === attempts - 1) break;

      const delay = baseDelayMs * (i + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * OpenRouter image generation
 */
async function generateImageOpenRouter({ prompt, negative, model }) {
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\nNEGATIVE: ${negative || ""}`
      }
    ],
    // Beberapa model butuh "modalities" supaya mengeluarkan image
    modalities: ["image", "text"]
  };

  const r = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // header ini disarankan OpenRouter (tidak wajib tapi membantu):
      "HTTP-Referer": process.env.OPENROUTER_REFERRER || "https://xklaa.vercel.app",
      "X-Title": process.env.OPENROUTER_APP_NAME || "UGC-Director"
    },
    body: JSON.stringify(body)
  });

  const raw = await r.text();
  if (!r.ok) {
    throw new Error(`OpenRouter error: ${r.status} ${raw}`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`OpenRouter returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const msg = json?.choices?.[0]?.message;

  // Coba berbagai bentuk keluaran
  // 1) content array dengan item type image_url
  let dataUrl =
    msg?.content?.find?.((c) => c?.type === "image_url")?.image_url?.url ||
    msg?.content?.find?.((c) => c?.type === "input_image")?.image_url?.url ||
    null;

  // 2) beberapa provider mengembalikan images array
  if (!dataUrl && Array.isArray(msg?.images) && msg.images[0]) {
    dataUrl = msg.images[0];
  }

  // 3) kadang b64 ada di content sebagai string panjang
  if (!dataUrl && typeof msg?.content === "string" && msg.content.includes("base64,")) {
    dataUrl = msg.content;
  }

  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error(
      `No image returned from OpenRouter. Check model output format. Model=${model}`
    );
  }

  // dataUrl bisa: "data:image/png;base64,...." atau pure base64
  const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
  const buffer = Buffer.from(base64, "base64");
  return { buffer, contentType: "image/png" };
}

/**
 * Hugging Face text-to-video
 */
async function generateVideoHF({ prompt, negative, model }) {
  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: fullPrompt })
  });

  const contentType = r.headers.get("content-type") || "";

  // kalau json, berarti error/status, bukan video bytes
  if (contentType.includes("application/json")) {
    const j = await r.json().catch(() => ({}));
    // contoh: model loading / rate limit
    const msg = j?.error || j?.message || JSON.stringify(j);
    throw new Error(`HF returned JSON (not video): ${r.status} ${msg}`);
  }

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`HF error: ${r.status} ${t}`);
  }

  const arrayBuffer = await r.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // tidak semua model benar2 mp4, tapi kita default mp4
  return { buffer, contentType: "video/mp4" };
}
