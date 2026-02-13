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
    // basic env checks
    mustEnv("SUPABASE_URL");
    mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    mustEnv("AWS_REGION");
    mustEnv("AWS_ACCESS_KEY_ID");
    mustEnv("AWS_SECRET_ACCESS_KEY");
    mustEnv("BEDROCK_IMAGE_MODEL_ID");
    mustEnv("BEDROCK_VIDEO_MODEL_ID");
    mustEnv("BEDROCK_VIDEO_S3_URI");

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
        provider: "bedrock",
        output_path: "",
        output_url: "",
        meta: {} // optional jsonb column; ok if exists
      })
      .select("*")
      .single();

    if (e1) throw e1;

    // 2) (optional) orchestrate step:
    // Kamu sebelumnya pakai Gemini orchestrate tapi sering quota 429.
    // Jadi kita langsung pakai brief sebagai prompt.
    const plan = {
      image: { prompt: brief, negative: DEFAULT_NEG },
      video: { prompt: brief, negative: DEFAULT_NEG }
    };

    const outputs = {};

    // 3) IMAGE (sync) via SD3.5 Large
    if (type === "image" || type === "both") {
      const p = plan.image.prompt;
      const neg = plan.image.negative || DEFAULT_NEG;

      const img = await generateImageSD35({ prompt: p, negative: neg });

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
          status: type === "both" ? "processing" : "done" // kalau both masih nunggu video
        })
        .eq("id", job.id);
    }

    // 4) VIDEO (async) via Luma Ray2
    if (type === "video" || type === "both") {
      const p = plan.video.prompt;
      const neg = plan.video.negative || DEFAULT_NEG;

      const start = await startVideoRay2({ prompt: p, negative: neg });

      // simpan async invocation id untuk polling
      await supabase
        .from("generation_jobs")
        .update({
          prompt: p,
          negative: neg,
          provider: "bedrock-ray2",
          status: "processing",
          meta: {
            ...(job.meta || {}),
            bedrock_async_id: start.asyncInvocationId
          }
        })
        .eq("id", job.id);

      outputs.video_status = "processing";
      outputs.bedrock_async_id = start.asyncInvocationId;
    }

    return res.status(200).json({
      id: job.id,
      status: type === "image" ? "done" : "processing",
      plan,
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

async function generateImageSD35({ prompt, negative }) {
  const modelId = process.env.BEDROCK_IMAGE_MODEL_ID;

  // Minimal payload SD3.5. Kamu bisa tambah width/height/aspect_ratio/seed sesuai kebutuhan.
  const body = {
    prompt,
    negative_prompt: negative || "",
    output_format: "png"
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

async function startVideoRay2({ prompt, negative }) {
  const modelId = process.env.BEDROCK_VIDEO_MODEL_ID;
  const s3Uri = process.env.BEDROCK_VIDEO_S3_URI;

  // Ray2 runs async. Output goes to the S3 URI.
  const inputBody = {
    prompt,
    negative_prompt: negative || ""
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
