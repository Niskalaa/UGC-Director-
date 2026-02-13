// api/jobs/[id].js
import { createClient } from "@supabase/supabase-js";
import { BedrockRuntimeClient, GetAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

    // kalau sudah done, return output lengkap
    if (job.status === "done") {
      return res.status(200).json({
        id: job.id,
        status: "done",
        image_url: job.image_url || null,
        video_url: job.video_url || null
      });
    }

    // kalau tidak ada async id => image-only sedang proses / atau belum update
    if (!job.video_async_id) {
      return res.status(200).json({
        id: job.id,
        status: job.status,
        image_url: job.image_url || null,
        video_url: job.video_url || null
      });
    }

    // cek status async bedrock
    const st = await bedrock.send(
      new GetAsyncInvokeCommand({ asyncInvocationId: job.video_async_id })
    );

    const bedrockStatus = st?.status || "UNKNOWN";

    if (bedrockStatus !== "COMPLETED" && bedrockStatus !== "FAILED") {
      return res.status(200).json({
        id: job.id,
        status: "processing",
        bedrock_status: bedrockStatus,
        image_url: job.image_url || null,
        video_url: job.video_url || null
      });
    }

    if (bedrockStatus === "FAILED") {
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error: "Ray2 async FAILED" })
        .eq("id", job.id);

      return res.status(200).json({
        id: job.id,
        status: "failed",
        bedrock_status: bedrockStatus,
        image_url: job.image_url || null,
        video_url: null
      });
    }

    // COMPLETED => ambil mp4 dari S3 prefix (usahakan yang mengandung async id)
    const { bucket, prefix } = parseS3Uri(process.env.BEDROCK_VIDEO_S3_URI);

    const mp4Key = await findMp4ForAsync({ bucket, prefix, asyncId: job.video_async_id });
    if (!mp4Key) throw new Error("No mp4 found in S3 output prefix (Ray2 completed) yet");

    const videoBuf = await downloadS3Object({ bucket, key: mp4Key });

    const videoPath = `video/${job.id}.mp4`;
    await uploadToSupabase(videoPath, videoBuf, "video/mp4");

    const { data: pubVid } = supabase.storage.from("generations").getPublicUrl(videoPath);
    const videoUrl = pubVid.publicUrl;

    // status final: done kalau:
    // - type=video => video_url ada
    // - type=both => image_url mungkin sudah ada; kalau belum, tetap done karena video selesai (image sudah dikerjakan lebih dulu)
    await supabase
      .from("generation_jobs")
      .update({
        video_path: videoPath,
        video_url: videoUrl,
        status: "done"
      })
      .eq("id", job.id);

    return res.status(200).json({
      id: job.id,
      status: "done",
      image_url: job.image_url || null,
      video_url: videoUrl
    });
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

async function findMp4ForAsync({ bucket, prefix, asyncId }) {
  // 1) coba cari mp4 yang mengandung asyncId (lebih aman daripada "latest mp4")
  const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const all = (r.Contents || []).filter((o) => o.Key);

  const match = all
    .filter((o) => o.Key.toLowerCase().endsWith(".mp4") && o.Key.includes(asyncId))
    .sort((a, b) => new Date(b.LastModified || 0) - new Date(a.LastModified || 0));

  if (match[0]?.Key) return match[0].Key;

  // 2) fallback: ambil mp4 terbaru di prefix
  const latest = all
    .filter((o) => o.Key.toLowerCase().endsWith(".mp4"))
    .sort((a, b) => new Date(b.LastModified || 0) - new Date(a.LastModified || 0));

  return latest[0]?.Key || null;
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
