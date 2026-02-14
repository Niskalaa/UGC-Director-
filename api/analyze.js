// api/analyze.js
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || "us-west-2";

function isClaude45BaseId(id = "") {
  return String(id).includes("anthropic.claude-sonnet-4-5-20250929-v1:0");
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

    // ✅ Claude 4.5 must use inference profile
    const CLAUDE_MODEL =
      process.env.BEDROCK_CLAUDE_INFERENCE_PROFILE_ARN ||
      process.env.BEDROCK_CLAUDE_INFERENCE_PROFILE_ID ||
      process.env.BEDROCK_CLAUDE_MODEL_ID ||
      "anthropic.claude-sonnet-4-5-20250929-v1:0";

    if (isClaude45BaseId(CLAUDE_MODEL)) {
      return res.status(500).json({
        ok: false,
        error:
          "Claude Sonnet 4.5 analyze requires Inference Profile. Set BEDROCK_CLAUDE_INFERENCE_PROFILE_ARN or BEDROCK_CLAUDE_INFERENCE_PROFILE_ID in Vercel.",
      });
    }

    const br = new BedrockRuntimeClient({ region: REGION });

    const modelImg = await fetchAsBytes(model_ref_url);
    const productImg = await fetchAsBytes(product_ref_url);

    const prompt = {
      task: "AUTO_FILL_PROJECT_FIELDS_FROM_IMAGES",
      output: "JSON_ONLY",
      rules: {
        no_guessing: true,
        if_unknown_use_empty_string: true,
        language: "id",
      },
      fields_required: [
        "brand",
        "product_type",
        "material",
        "tone",
        "target_audience",
        "visual_notes",
      ],
    };

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
            { image: { format: productImg.format, source: { bytes: productImg.bytes } } },
          ],
        },
      ],
      // ✅ keep it simple (avoid weird config conflicts)
      inferenceConfig: { temperature: 0.2, maxTokens: 1200 },
    });

    const out = await br.send(cmd);
    const text = extractBedrockText(out);
    const parsed = safeJsonParse(text);

    return res.status(200).json({ ok: true, fields: parsed });
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
  const buf = Buffer.from(await r.arrayBuffer());

  const ct = (r.headers.get("content-type") || "").toLowerCase();
  let format = "jpeg";
  if (ct.includes("png")) format = "png";
  else if (ct.includes("webp")) format = "webp";
  else if (ct.includes("jpeg") || ct.includes("jpg")) format = "jpeg";

  return { format, bytes: buf };
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const s = String(content || "");
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
    throw new Error(`Model did not return valid JSON. preview="${s.slice(0, 160)}"`);
  }
}
