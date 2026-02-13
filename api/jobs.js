// api/jobs.js
import { createClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  StartAsyncInvokeCommand
} from "@aws-sdk/client-bedrock-runtime";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-west-2"
});

const DEFAULT_NEG =
  "blurry, lowres, watermark, text artifacts, distorted face, extra fingers, extra limbs, bad anatomy, ai look, overprocessed";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let jobId = null;

  try {
    mustEnv("SUPABASE_URL");
    mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    mustEnv("AWS_REGION");
    mustEnv("AWS_ACCESS_KEY_ID");
    mustEnv("AWS_SECRET_ACCESS_KEY");
    mustEnv("BEDROCK_IMAGE_MODEL_ID");
    mustEnv("BEDROCK_VIDEO_MODEL_ID");
    mustEnv("BEDROCK_VIDEO_S3_URI");

    const { type, brief, negative, settings } = req.body || {};
    if (!type || !brief) return res.status(400).json({ error: "type & brief required" });
    if (!["image", "video", "both"].includes(type)) {
      return res.status(400).json({ error: "type must be image|video|both" });
    }

    const s = settings || {};
    const neg = (negative || DEFAULT_NEG).trim();

    // 1) create job row (schema baru)
    const { data: job, error: e1 } = await supabase
      .from("generation_jobs")
      .insert({
        type,
        status: "processing",
        brief: String(brief),
        settings: s
      })
      .select("*")
      .single();

    if (e1) throw e1;
    jobId = job.id;

    const outputs = {};

    // 2) IMAGE (sync) — SD 3.5 Large
    if (type === "image" || type === "both") {
      const imageModelId = process.env.BEDROCK_IMAGE_MODEL_ID;

      const img = await generateImageSD35({
        prompt: String(brief),
        negative: neg,
        settings: s
      });

      const imagePath = `image/${job.id}.png`;
      await uploadToSupabase(imagePath, img.buffer, "image/png");

      const { data: pubImg } = supabase.storage.from("generations").getPublicUrl(imagePath);
      const imageUrl = pubImg.publicUrl;

      outputs.image_url = imageUrl;

      await supabase
        .from("generation_jobs")
        .update({
          image_prompt: String(brief),
          image_negative: neg,
          image_provider: "bedrock",
          image_model_id: imageModelId,
          image_path: imagePath,
          image_url: imageUrl,
          status: type === "both" ? "processing" : "done"
        })
        .eq("id", job.id);
    }

    // 3) VIDEO (async) — Luma Ray2
    if (type === "video" || type === "both") {
      const videoModelId = process.env.BEDROCK_VIDEO_MODEL_ID;

      const start = await startVideoRay2({
        prompt: String(brief),
        negative: neg,
        settings: s
      });

      outputs.video_status = "processing";
      outputs.video_async_id = start.asyncInvocationId;

      await supabase
        .from("generation_jobs")
        .update({
          video_prompt: String(brief),
          video_negative: neg,
          video_provider: "bedrock",
          video_model_id: videoModelId,
          video_async_id: start.asyncInvocationId,
          status: "processing"
        })
        .eq("id", job.id);
    }

    // response yang dipakai UI
    return res.status(200).json({
      id: job.id,
      status: type === "image" ? "done" : "processing",
      ...outputs
    });
  } catch (err) {
    const msg = String(err?.message || err);

    // best-effort: update job row to failed
    if (jobId) {
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error: msg })
        .eq("id", jobId);
    }

    return res.status(500).json({ error: msg });
  }
}

function mustEnv(key) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

async function uploadToSupabase(path, buffer, contentType) {
  const { error } = await supabase.storage
    .from("generations")
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
}

function mapSdSettings(s = {}) {
  const out = {};
  if (s.seed !== undefined && s.seed !== null && !Number.isNaN(Number(s.seed))) out.seed = Number(s.seed);
  if (s.aspect_ratio) out.aspect_ratio = String(s.aspect_ratio);

  if (s.quality === "draft") out.steps = 20;
  if (s.quality === "standard") out.steps = 30;
  if (s.quality === "high") out.steps = 40;

  return out;
}

function mapRay2Settings(s = {}) {
  const out = {};
  // kalau Ray2 kamu tidak support field ini, hapus 3 baris ini saja.
  if (s.video_seconds) out.duration_seconds = Number(s.video_seconds);
  if (s.aspect_ratio) out.aspect_ratio = String(s.aspect_ratio);
  if (s.seed !== undefined && s.seed !== null && !Number.isNaN(Number(s.seed))) out.seed = Number(s.seed);
  return out;
}

async function generateImageSD35({ prompt, negative, settings }) {
  const modelId = process.env.BEDROCK_IMAGE_MODEL_ID;

  const body = {
    prompt,
    negative_prompt: negative || "",
    output_format: "png",
    ...mapSdSettings(settings)
  };

  const cmd = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(JSON.stringify(body))
  });

  const resp = await bedrock.send(cmd);
  const json = JSON.parse(new TextDecoder().decode(resp.body));

  const b64 = json?.images?.[0] || json?.image || json?.artifacts?.[0]?.base64;
  if (!b64 || typeof b64 !== "string") {
    throw new Error(`SD3.5: No base64 image returned. keys=${Object.keys(json || {}).join(",")}`);
  }

  return { buffer: Buffer.from(b64, "base64") };
}

async function startVideoRay2({ prompt, negative, settings }) {
  const modelId = process.env.BEDROCK_VIDEO_MODEL_ID;
  const s3Uri = process.env.BEDROCK_VIDEO_S3_URI;

  const inputBody = {
    prompt,
    negative_prompt: negative || "",
    ...mapRay2Settings(settings)
  };

  const cmd = new StartAsyncInvokeCommand({
    modelId,
    modelInput: inputBody,
    outputDataConfig: { s3OutputDataConfig: { s3Uri } }
  });

  const resp = await bedrock.send(cmd);
  const asyncInvocationId = resp?.asyncInvocationId;
  if (!asyncInvocationId) throw new Error("Ray2: missing asyncInvocationId");

  return { asyncInvocationId };
}
