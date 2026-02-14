// api/analyze.js
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { Buffer } from "buffer";

const REGION = process.env.AWS_REGION || "us-west-2";

// WAJIB inference profile untuk Claude 4.5 (sama seperti plan.js)
const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_INFERENCE_PROFILE_ARN ||
  process.env.BEDROCK_CLAUDE_INFERENCE_PROFILE_ID ||
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "anthropic.claude-sonnet-4-5-20250929-v1:0";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isOnDemandNotSupported(err) {
  return String(err?.message || err || "").includes("on-demand throughput isn't supported");
}
function isThrottle(err) {
  const m = String(err?.message || err || "").toLowerCase();
  return m.includes("throttl") || m.includes("rate") || m.includes("429") || m.includes("too many");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = req.body || {};
    const model_ref_url = body?.model_ref_url;
    const product_ref_url = body?.product_ref_url;

    if (!model_ref_url || !product_ref_url) {
      return res.status(400).json({ ok: false, error: "model_ref_url & product_ref_url required" });
    }

    const br = new BedrockRuntimeClient({ region: REGION });

    const modelImg = await fetchAsBytes(model_ref_url);
    const productImg = await fetchAsBytes(product_ref_url);

    const prompt = {
      task: "AUTO_FILL_PROJECT_FIELDS_FROM_IMAGES",
      output: "JSON_ONLY",
      rules: { no_guessing: true, if_unknown_use_empty_string: true, language: "id" },
      fields_required: [
        "brand",
        "product_type",
        "material",
        "suggested_platform",
        "suggested_aspect_ratio",
        "suggested_scene_count",
        "suggested_seconds_per_scene",
        "tone",
        "target_audience",
        "product_claims_safe",
        "visual_notes"
      ]
    };

    const maxAttempts = 4;
    let lastErr = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const cmd = new ConverseCommand({
          modelId: CLAUDE_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { text: "Return ONLY valid JSON. No markdown. No extra text." },
                { text: `USER_JSON:\n${JSON.stringify(prompt)}` },

                { text: "\nIMAGE_1: model reference\n" },
                { image: { format: modelImg.format, source: { bytes: modelImg.bytes } } },

                { text: "\nIMAGE_2: product reference\n" },
                { image: { format: productImg.format, source: { bytes: productImg.bytes } } }
              ]
            }
          ],
          inferenceConfig: { temperature: 0.2, maxTokens: 1200 } // jangan topP biar aman
        });

        const out = await br.send(cmd);
        const text = extractBedrockText(out);
        const parsed = safeJsonParse(text);

        return res.status(200).json({ ok: true, fields: parsed });
      } catch (e) {
        lastErr = e;

        if (isOnDemandNotSupported(e)) {
          return res.status(500).json({
            ok: false,
            error:
              "Claude 4.5 butuh Inference Profile. Set BEDROCK_CLAUDE_INFERENCE_PROFILE_ARN / _ID di Vercel env."
          });
        }

        const retryable = isThrottle(e);
        if (!retryable || attempt === maxAttempts) throw e;

        const delay = 900 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
        await sleep(delay);
      }
    }

    throw lastErr || new Error("Unknown analyze error");
  } catch (e) {
    console.error("ANALYZE ERROR:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

function extractBedrockText(out) {
  const blocks = out?.output?.message?.content || [];
  return blocks.map((b) => b?.text || "").join("\n").trim();
}

async function fetchAsBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch image: ${r.status}`);
  const arr = await r.arrayBuffer();
  const buf = Buffer.from(arr);

  const ct = (r.headers.get("content-type") || "").toLowerCase();
  let format = "jpeg";
  if (ct.includes("png")) format = "png";
  else if (ct.includes("webp")) format = "webp";
  else format = "jpeg";

  return { format, bytes: buf };
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error(`Model did not return valid JSON. preview="${String(content).slice(0, 160)}"`);
  }
}
