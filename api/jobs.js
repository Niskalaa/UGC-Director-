import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { type, prompt, negative } = req.body || {};
    if (!type || !prompt) return res.status(400).json({ error: "type & prompt required" });
    if (!["image", "video"].includes(type)) return res.status(400).json({ error: "type must be image|video" });

    // 1) create job
    const { data: job, error: e1 } = await supabase
      .from("generation_jobs")
      .insert({
        type,
        status: "processing", // simpel: langsung proses di function ini
        prompt,
        negative: negative || "",
        provider: type === "image" ? "openrouter" : "huggingface"
      })
      .select("*")
      .single();

    if (e1) throw e1;

    // 2) process now (simple mode)
    const result = type === "image"
      ? await generateImageOpenRouter(prompt, negative)
      : await generateVideoHF(prompt, negative);

    // 3) upload to storage
    const ext = type === "image" ? "png" : "mp4";
    const path = `${type}/${job.id}.${ext}`;

    const { error: eUp } = await supabase.storage
      .from("generations")
      .upload(path, result.buffer, {
        contentType: result.contentType,
        upsert: true
      });
    if (eUp) throw eUp;

    // 4) public URL (if bucket public)
    const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);

    // 5) update job
    const { error: e2 } = await supabase
      .from("generation_jobs")
      .update({ status: "done", output_path: path, output_url: pub.publicUrl })
      .eq("id", job.id);

    if (e2) throw e2;

    return res.status(200).json({ id: job.id, status: "done", output_url: pub.publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

// ---------- providers ----------

async function generateImageOpenRouter(prompt, negative) {
  // NOTE: model name contoh. Pilih model image yang kamu mau dari OpenRouter.
  const body = {
    model: "openai/gpt-image-1", // contoh; ganti sesuai koleksi image models OR
    messages: [
      { role: "user", content: `${prompt}\n\nNEGATIVE: ${negative || ""}` }
    ],
    // beberapa model memakai modalities:
    modalities: ["image", "text"]
  };

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) throw new Error(`OpenRouter error: ${r.status} ${await r.text()}`);
  const json = await r.json();

  // Banyak model mengembalikan image sebagai data URL/base64 di message.
  // Struktur bisa beda antar model. Kamu mungkin perlu sesuaikan parsing.
  const dataUrl = json?.choices?.[0]?.message?.content?.find?.(c => c?.type === "image_url")?.image_url?.url
    || json?.choices?.[0]?.message?.content?.image_url?.url
    || json?.choices?.[0]?.message?.images?.[0];

  if (!dataUrl) throw new Error("No image returned from OpenRouter");

  const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
  const buffer = Buffer.from(base64, "base64");

  return { buffer, contentType: "image/png" };
}

async function generateVideoHF(prompt, negative) {
  // HF Inference Providers: text-to-video
  // Endpoint & payload bisa tergantung provider/model yang kamu pilih.
  // Ini bentuk generik; nanti kamu sesuaikan modelnya.
  const fullPrompt = negative ? `${prompt}\n\nNegative: ${negative}` : prompt;

  const r = await fetch("https://api-inference.huggingface.co/models/THUDM/CogVideoX-2b", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: fullPrompt })
  });

  if (!r.ok) throw new Error(`HF error: ${r.status} ${await r.text()}`);
  const arrayBuffer = await r.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, contentType: "video/mp4" };
}
