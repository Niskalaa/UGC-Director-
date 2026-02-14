// api/plan.js
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { GoogleGenAI } from "@google/genai";

const REGION = process.env.AWS_REGION || "us-west-2";

// ===== Helpers =====
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isClaude45BaseId(id = "") {
  // base model id yang bikin error "on-demand throughput isn't supported"
  return String(id).includes("anthropic.claude-sonnet-4-5-20250929-v1:0");
}

function parseRetrySecondsFromText(msg = "") {
  // Gemini error sering bilang: "Please retry in 48.903816418s."
  const m = String(msg).match(/retry in\s+([\d.]+)s/i);
  if (!m) return null;
  const sec = Number(m[1]);
  if (!Number.isFinite(sec)) return null;
  return sec;
}

function isThrottleError(err) {
  const m = String(err?.message || err || "").toLowerCase();
  return (
    m.includes("throttl") ||
    m.includes("rate exceeded") ||
    m.includes("too many requests") ||
    m.includes("resource_exhausted") ||
    m.includes("429")
  );
}

function isOnDemandNotSupported(err) {
  const m = String(err?.message || err || "");
  return m.includes("on-demand throughput isn't supported");
}

function isNonJsonError(err) {
  const m = String(err?.message || err || "");
  return m.includes("Model did not return valid JSON") || m.includes("Non-JSON");
}

function assertRequired(project, keys) {
  for (const k of keys) {
    if (project[k] === undefined || project[k] === null || String(project[k]).trim() === "") {
      throw new Error(`missing ${k}`);
    }
  }
}

// ===== Main Handler =====
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const project = body.project || null;
    const provider = (body.provider || "bedrock").toLowerCase(); // "bedrock" | "gemini"

    if (!project) return res.status(400).json({ ok: false, error: "project required" });

    // minimal guard
    assertRequired(project, [
      "brand",
      "product_type",
      "material",
      "platform",
      "aspect_ratio",
      "scene_count",
      "seconds_per_scene"
    ]);

    if (!project.model_ref_url || !project.product_ref_url) {
      return res.status(400).json({ ok: false, error: "model_ref_url & product_ref_url required" });
    }

    if (provider === "gemini") {
      const blueprint = await planWithGemini(project);
      return res.status(200).json({ ok: true, provider: "gemini", blueprint });
    }

    // Default: Bedrock pipeline (DeepSeek -> Claude -> DeepSeek)
    const blueprint = await planWithBedrock(project);
    return res.status(200).json({ ok: true, provider: "bedrock", blueprint });
  } catch (e) {
    console.error("PLAN ERROR:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

/* =========================
   BEDROCK PIPELINE
   ========================= */

async function planWithBedrock(project) {
  // ---- Model IDs ----
  // DeepSeek: boleh inference profile ARN/ID atau base model id (tergantung akun)
  const DEEPSEEK_MODEL =
    process.env.BEDROCK_DEEPSEEK_INFERENCE_PROFILE_ARN ||
    process.env.BEDROCK_DEEPSEEK_INFERENCE_PROFILE_ID ||
    process.env.BEDROCK_DEEPSEEK_MODEL_ID ||
    "deepseek.r1-v1:0";

  // Claude 4.5: WAJIB inference profile (sesuai error kamu)
  const CLAUDE_MODEL =
    process.env.BEDROCK_CLAUDE_INFERENCE_PROFILE_ARN ||
    process.env.BEDROCK_CLAUDE_INFERENCE_PROFILE_ID ||
    process.env.BEDROCK_CLAUDE_MODEL_ID ||
    "anthropic.claude-sonnet-4-5-20250929-v1:0";

  // Guard keras: kalau masih base id, stop & kasih instruksi jelas
  if (isClaude45BaseId(CLAUDE_MODEL)) {
    throw new Error(
      [
        "Claude Sonnet 4.5 tidak bisa dipanggil via on-demand model ID.",
        "Wajib pakai Inference Profile.",
        "Set env di Vercel:",
        "- BEDROCK_CLAUDE_INFERENCE_PROFILE_ARN=arn:aws:bedrock:us-west-2:...:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
        "atau:",
        "- BEDROCK_CLAUDE_INFERENCE_PROFILE_ID=global.anthropic.claude-sonnet-4-5-20250929-v1:0"
      ].join(" ")
    );
  }

  const br = new BedrockRuntimeClient({ region: REGION });

  // 1) DeepSeek: PLAN
  const deepseekPlan = await bedrockJSONWithRetry(br, DEEPSEEK_MODEL, {
    system: "You are UGC Creative Director + Senior App Engineer. Return ONLY valid JSON. No markdown. No extra text.",
    user: {
      task: "PLAN",
      rules: {
        plan_once: true,
        scene_count: project.scene_count,
        seconds_per_scene: project.seconds_per_scene,
        consistent_style: true,
        anti_claim_hallucination: true
      },
      input: project
    }
  });

  // 2) Claude: VO + on-screen text
  const claudeVO = await bedrockJSONWithRetry(br, CLAUDE_MODEL, {
    system: "Write natural gen-z Indonesian UGC VO. Return ONLY valid JSON. No markdown. No extra text.",
    user: {
      task: "VO_AND_ONSCREEN_TEXT",
      voice_profile: {
        pronoun: project.pronoun || "gue",
        persona: project.persona || "honest-reviewer",
        energy: project.energy || "medium",
        pace: project.pace || "normal",
        tone: project.tone || "natural gen-z",
        consistent_across_scenes: true
      },
      input: project,
      plan: deepseekPlan
    }
  });

  // 3) DeepSeek: COMPILE final blueprint
  const blueprint = await bedrockJSONWithRetry(br, DEEPSEEK_MODEL, {
    system: "Compile UGC Prompt OS V1 blueprint. Return ONLY valid JSON. No markdown. No extra text.",
    user: {
      task: "COMPILE_BLUEPRINT_V1",
      input: project,
      plan: deepseekPlan,
      vo: claudeVO
    }
  });

  return blueprint;
}

async function bedrockJSONWithRetry(brClient, modelId, payload) {
  const maxAttempts = Number(process.env.BEDROCK_RETRY_MAX || 4);
  const baseDelayMs = Number(process.env.BEDROCK_RETRY_BASE_MS || 900);

  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await bedrockJSON(brClient, modelId, payload);
    } catch (err) {
      lastErr = err;

      // kalau error "on-demand throughput isn't supported" → ini bukan retryable
      if (isOnDemandNotSupported(err)) throw err;

      // non-json kadang terjadi karena model nyeleneh; boleh retry 1x
      const retryable = isThrottleError(err) || isNonJsonError(err);

      if (!retryable || attempt === maxAttempts) throw err;

      const jitter = Math.floor(Math.random() * 250);
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      console.warn(`[bedrock retry] attempt ${attempt}/${maxAttempts} delay=${delay}ms modelId=${modelId}`);
      await sleep(delay);
    }
  }

  throw lastErr || new Error("Unknown Bedrock error");
}

async function bedrockJSON(brClient, modelId, payload) {
  // NOTE: beberapa model sensitif. Hindari set temperature + topP bersamaan.
  // Kita pakai temperature saja.
  const cmd = new ConverseCommand({
    modelId,
    messages: [
      {
        role: "user",
        content: [{ text: `SYSTEM:\n${payload.system}\n\nUSER_JSON:\n${JSON.stringify(payload.user)}` }]
      }
    ],
    inferenceConfig: {
      temperature: 0.2,
      maxTokens: 4096
    }
  });

  const out = await brClient.send(cmd);
  const text = extractBedrockText(out);
  if (!text) throw new Error(`Bedrock model returned empty text. modelId=${modelId}`);
  return safeJsonParse(text);
}

function extractBedrockText(out) {
  const blocks = out?.output?.message?.content || [];
  return blocks.map((b) => b?.text || "").join("\n").trim();
}

/* =========================
   GEMINI OPTION
   ========================= */

async function planWithGemini(project) {
  const apiKey = process.env.GEMINI_API_KEY;
  // Kamu bisa upgrade model via ENV: GEMINI_MODEL
  // contoh: gemini-2.5-flash, gemini-2.5-pro (tergantung akses & billing)
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = {
    task: "COMPILE_BLUEPRINT_V1_SINGLE_PASS",
    constraints: {
      output: "JSON_ONLY",
      scene_count: project.scene_count,
      seconds_per_scene: project.seconds_per_scene,
      strict_compliance: true,
      no_claim_hallucination: true
    },
    input: project
  };

  const maxAttempts = Number(process.env.GEMINI_RETRY_MAX || 4);

  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: JSON.stringify(prompt) }] }],
        // FIX: jangan kirim topP biar nggak bentrok "temperature and top_p cannot both be specified"
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
      });

      const text = String(r?.text || "").trim();
      if (!text) throw new Error("Gemini returned empty text");
      return safeJsonParse(text);
    } catch (err) {
      lastErr = err;

      const msg = String(err?.message || err || "");
      const retrySec = parseRetrySecondsFromText(msg);

      const retryable = isThrottleError(err) || retrySec !== null;
      if (!retryable || attempt === maxAttempts) throw err;

      const delayMs =
        retrySec !== null
          ? Math.ceil(retrySec * 1000)
          : 900 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);

      console.warn(`[gemini retry] attempt ${attempt}/${maxAttempts} delay=${delayMs}ms model=${model}`);
      await sleep(delayMs);
    }
  }

  throw lastErr || new Error("Unknown Gemini error");
}

/* =========================
   JSON parsing helper
   ========================= */

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = content.slice(start, end + 1);
      return JSON.parse(sliced);
    }
    throw new Error(`Model did not return valid JSON. contentPreview="${String(content).slice(0, 180)}"`);
  }
}
