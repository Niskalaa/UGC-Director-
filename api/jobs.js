// api/jobs.js
import { createClient } from "@supabase/supabase-js";
import { orchestrate } from "../internal/orchestrate.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { type, brief } = req.body || {};
    if (!type || !brief) return res.status(400).json({ error: "type & brief required" });
    if (!["image", "video", "both"].includes(type)) {
      return res.status(400).json({ error: "type must be image|video|both" });
    }

    // 1) buat job row
    const { data: job, error: e1 } = await supabase
      .from("generation_jobs")
      .insert({
        type: type === "both" ? "image" : type, // kita simpan primary type
        status: "processing",
        prompt: "",
        negative: "",
        provider: ""
      })
      .select("*")
      .single();

    if (e1) throw e1;

    // 2) orchestrate via Gemini (dengan fallback)
    let plan;
    try {
      plan = await orchestrate({ type, brief });
    } catch (e) {
      console.error("Orchestrate failed, fallback to direct brief:", e?.message || e);

      const DEFAULT_NEG =
        "blurry, lowres, watermark, text artifacts, distorted face, extra fingers, extra limbs, bad anatomy, ai look, overprocessed";

      // fallback plan sederhana (tanpa Gemini)
      plan = {
        image: { prompt: brief, negative: DEFAULT_NEG },
        video: { prompt: brief, negative: DEFAULT_NEG }
      };
    }

    const outputs = {};

    // 3) generate image via OpenRouter (jika diminta)
    if (type === "image" || type === "both") {
      const p = plan?.image?.prompt;
      if (!p) throw new Error("Orchestrator missing image.prompt");

      const neg = plan?.image?.negative || "";
      const img = await generateImageOpenRouter(p, neg);

      const path = `image/${job.id}.png`;
      await uploadToSupabase(path, img.buffer, img.contentType);

      const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);
      outputs.image_url = pub.publicUrl;

      // update job fields
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

    // 4) generate video via HF (jika diminta)
    if (type === "video" || type === "both") {
      const p = plan?.video?.prompt;
      if (!p) throw new Error("Orchestrator missing video.prompt");

      const neg = plan?.video?.negative || "";
      const vid = await generateVideoHF(p, neg);

      const path = `video/${job.id}.mp4`;
      await uploadToSupabase(path, vid.buffer, vid.contentType);

      const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);
      outputs.video_url = pub.publicUrl;

      // NOTE: kalau both, ini overwrite output_path/output_url row yg sama (simple mode).
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
      plan,       // hasil JSON orchestrator (debug)
      ...outputs  // image_url / video_url
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

async function uploadToSupabase(path, buffer, contentType) {
  const { error } = await supabase.storage
    .from("generations")
    .upload(path, buffer, { contentType, upsert: true });

  if (error) throw error;
}

/**
 * OpenRouter image generation (FLUX-friendly)
 * Uses Images API: /images/generations
 */
async function generateImageOpenRouter(prompt, negative) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");

  const model = process.env.OPENROUTER_IMAGE_MODEL;
  if (!model) {
    throw new Error(
      "Missing OPENROUTER_IMAGE_MODEL. Set it to: black-forest-labs/flux.2-klein-4b"
    );
  }

  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  // 1) IMAGES endpoint (recommended for FLUX)
  const body = {
    model,
    prompt: fullPrompt,
    size: "1024x1024"
  };

  const r = await fetch("https://openrouter.ai/api/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // optional headers (helps OpenRouter analytics/routing)
      "HTTP-Referer": process.env.OPENROUTER_REFERRER || "https://xklaa.vercel.app",
      "X-Title": process.env.OPENROUTER_APP_NAME || "UGC-Director"
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

  // OpenAI-style response:
  // { data: [ { b64_json: "..."} ] } OR { data: [ { url: "https://..." } ] }
  const b64 = json?.data?.[0]?.b64_json;
  const url = json?.data?.[0]?.url;

  if (b64) {
    return { buffer: Buffer.from(b64, "base64"), contentType: "image/png" };
  }

  if (url) {
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error(`Failed to download image url: ${imgRes.status} ${await imgRes.text()}`);
    const ab = await imgRes.arrayBuffer();
    const ct = imgRes.headers.get("content-type") || "image/png";
    return { buffer: Buffer.from(ab), contentType: ct };
  }

  throw new Error("OpenRouter images: missing b64_json/url in response");
}

/**
 * Hugging Face text-to-video.
 * Model contoh; kamu bisa ganti sesuai model text-to-video yang kamu pilih.
 */
async function generateVideoHF(prompt, negative) {
  if (!process.env.HF_TOKEN) throw new Error("Missing HF_TOKEN");

  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  const r = await fetch("https://api-inference.huggingface.co/models/THUDM/CogVideoX-2b", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: fullPrompt })
  });

  // HF sering mengembalikan JSON error/status
  const ct = r.headers.get("content-type") || "";
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
