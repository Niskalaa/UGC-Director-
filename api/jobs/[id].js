// api/jobs/[id].js
import { createClient } from "@supabase/supabase-js";
import { BedrockRuntimeClient, GetAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-west-2"
});

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-west-2"
});

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: "missing id" });

    const { data: job, error: e1 } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (e1) throw e1;
    if (!job) return res.status(404).json({ error: "job not found" });

    // If image-only job already done
    if (job.status === "done" && job.output_url) {
      return res.status(200).json({
        id: job.id,
        status: "done",
        image_url: job.output_url?.includes("/image/") ? job.output_url : undefined,
        video_url: job.output_url?.includes("/video/") ? job.output_url : undefined,
        output_url: job.output_url
      });
    }

    const asyncId = job.async_id;
    if (!asyncId) {
      return res.status(200).json({ id: job.id, status: job.status, output_url: job.output_url || null });
    }

    const st = await bedrock.send(new GetAsyncInvokeCommand({ asyncInvocationId: asyncId }));
    const status = st?.status || "UNKNOWN";

    if (status !== "COMPLETED" && status !== "FAILED") {
      return res.status(200).json({ id: job.id, status: "processing", bedrock_status: status });
    }

    if (status === "FAILED") {
      await supabase.from("generation_jobs").update({ status: "failed" }).eq("id", job.id);
      return res.status(200).json({ id: job.id, status: "failed", bedrock_status: status });
    }

    // COMPLETED -> find latest mp4 in S3 prefix, upload to Supabase
    const { bucket, prefix } = parseS3Uri(process.env.BEDROCK_VIDEO_S3_URI);

    const key = await findLatestMp4({ bucket, prefix });
    if (!key) throw new Error("No mp4 found in S3 output prefix yet");

    const videoBuf = await downloadS3Object({ bucket, key });

    const path = `video/${job.id}.mp4`;
    await uploadToSupabase(path, videoBuf, "video/mp4");

    const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);

    await supabase
      .from("generation_jobs")
      .update({ status: "done", output_path: path, output_url: pub.publicUrl })
      .eq("id", job.id);

    return res.status(200).json({ id: job.id, status: "done", video_url: pub.publicUrl });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

function parseS3Uri(s3Uri) {
  const m = /^s3:\/\/([^/]+)\/?(.*)$/.exec(s3Uri || "");
  if (!m) throw new Error("Invalid BEDROCK_VIDEO_S3_URI");
  const bucket = m[1];
  let prefix = m[2] || "";
  if (prefix && !prefix.endsWith("/")) prefix += "/";
  return { bucket, prefix };
}

async function findLatestMp4({ bucket, prefix }) {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const list = (r.Contents || [])
    .filter((o) => o.Key && o.Key.toLowerCase().endsWith(".mp4"))
    .sort((a, b) => new Date(b.LastModified || 0) - new Date(a.LastModified || 0));
  return list[0]?.Key || null;
}

async function downloadS3Object({ bucket, key }) {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const c of r.Body) chunks.push(c);
  return Buffer.concat(chunks);
}

async function uploadToSupabase(path, buffer, contentType) {
  const { error } = await supabase.storage
    .from("generations")
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
}
