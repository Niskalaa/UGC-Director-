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

    // 2) orchestrate via Gemini
    const plan = await orchestrate({ type, brief });

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

      // update job fields (optional)
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

      // kalau type = video, update row yang sama
      // kalau both: ini overwrite output_path/output_url row yg sama (simple mode).
      // Untuk production, sebaiknya simpan dua row terpisah (image+video).
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
      plan,       // hasil JSON orchestrator (berguna buat debug)
      ...outputs  // image_url / video_url
    });
  } catch (err) {
    console.error(err);

    // best-effort: kalau ada job id di body? tidak ada. Jadi return error aja.
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
 * OpenRouter image generation.
 * NOTE: parsing output bisa beda antar model/provider.
 * Kamu mungkin perlu sesuaikan 5-10 baris parsing di bawah.
 */
async function generateImageOpenRouter(prompt, negative) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");

  const body = {
    model: "openai/gpt-image-1", // ganti sesuai image model yang kamu pilih di OpenRouter
    messages: [
      { role: "user", content: `${prompt}\n\nNEGATIVE: ${negative || ""}` }
    ],
    modalities: ["image", "text"]
  };

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) throw new Error(`OpenRouter error: ${r.status} ${await r.text()}`);
  const json = await r.json();

  // Coba beberapa pola umum:
  const msg = json?.choices?.[0]?.message;
  let dataUrl =
    msg?.content?.find?.((c) => c?.type === "image_url")?.image_url?.url ||
    msg?.content?.image_url?.url ||
    msg?.images?.[0];

  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error("No image returned from OpenRouter (check model output format)");
  }

  const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
  const buffer = Buffer.from(base64, "base64");
  return { buffer, contentType: "image/png" };
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

  if (!r.ok) throw new Error(`HF error: ${r.status} ${await r.text()}`);

  const arrayBuffer = await r.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, contentType: "video/mp4" };
}
