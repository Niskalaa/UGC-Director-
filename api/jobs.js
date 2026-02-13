// api/jobs.js
import { createClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  StartAsyncInvokeCommand
} from "@aws-sdk/client-bedrock-runtime";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-west-2"
});

const DEFAULT_NEG =
  "blurry, lowres, watermark, text artifacts, distorted face, extra fingers, extra limbs, bad anatomy, ai look, overprocessed";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // ENV checks
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

    const plan = {
      image: { prompt: brief, negative: negative || DEFAULT_NEG, settings: settings || {} },
      video: { prompt: brief, negative: negative || DEFAULT_NEG, settings: settings || {} }
    };

    // Create job row (requires generation_jobs has async_id column)
    const { data: job, error: e1 } = await supabase
      .from("generation_jobs")
      .insert({
        type: type === "both" ? "image" : type,
        status: "processing",
        prompt: "",
        negative: "",
        provider: "bedrock",
        output_path: "",
        output_url: "",
        async_id: null
      })
      .select("*")
      .single();

    if (e1) throw e1;

    const outputs = {};

    // IMAGE (sync) SD3.5
    if (type === "image" || type === "both") {
      const p = plan.image.prompt;
      const neg = plan.image.negative || DEFAULT_NEG;

      const img = await generateImageSD35({ prompt: p, negative: neg, settings: plan.image.settings });

      const path = `image/${job.id}.png`;
      await uploadToSupabase(path, img.buffer, "image/png");

      const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);
      outputs.image_url = pub.publicUrl;

      await supabase
        .from("generation_jobs")
        .update({
          prompt: p,
          negative: neg,
          provider: "bedrock-sd3.5",
          output_path: path,
          output_url: pub.publicUrl,
          status: type === "both" ? "processing" : "done"
        })
        .eq("id", job.id);
    }

    // VIDEO (async) Ray2
    if (type === "video" || type === "both") {
      const p = plan.video.prompt;
      const neg = plan.video.negative || DEFAULT_NEG;

      const start = await startVideoRay2({ prompt: p, negative: neg, settings: plan.video.settings });

      await supabase
        .from("generation_jobs")
        .update({
          prompt: p,
          negative: neg,
          provider: "bedrock-ray2",
          status: "processing",
          async_id: start.asyncInvocationId
        })
        .eq("id", job.id);

      outputs.video_status = "processing";
      outputs.async_id = start.asyncInvocationId;
    }

    return res.status(200).json({
      id: job.id,
      status: type === "image" ? "done" : "processing",
      ...outputs
    });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
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
  // If your Ray2 param names differ, remove these or adjust.
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
    outputDataConfig: {
      s3OutputDataConfig: { s3Uri }
    }
  });

  const resp = await bedrock.send(cmd);
  const asyncInvocationId = resp?.asyncInvocationId;
  if (!asyncInvocationId) throw new Error("Ray2: missing asyncInvocationId");

  return { asyncInvocationId };
}
