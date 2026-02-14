// api/plan.js
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { GoogleGenAI } from "@google/genai";

const REGION = process.env.AWS_REGION || "us-west-2";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const project = body.project || null;
    const provider = (body.provider || "bedrock").toLowerCase(); // "bedrock" | "gemini"

    if (!project) return res.status(400).json({ error: "project required" });

    // minimal guard
    const required = ["brand", "product_type", "material", "platform", "aspect_ratio", "scene_count", "seconds_per_scene"];
    for (const k of required) {
      if (project[k] === undefined || project[k] === null || String(project[k]).trim() === "") {
        return res.status(400).json({ error: `missing ${k}` });
      }
    }
    if (!project.model_ref_url || !project.product_ref_url) {
      return res.status(400).json({ error: "model_ref_url & product_ref_url required" });
    }

    if (provider === "gemini") {
      const blueprint = await planWithGemini(project);
      return res.status(200).json({ ok: true, provider: "gemini", blueprint });
    }

    // Default: Bedrock pipeline (DeepSeek -> Claude -> DeepSeek)
    const blueprint = await planWithBedrock(project);
    return res.status(200).json({ ok: true, provider: "bedrock", blueprint });

  } catch (e) {
    console.error("PLAN ERROR:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

/* =========================
   BEDROCK PIPELINE
   ========================= */

async function planWithBedrock(project) {
  const DEEPSEEK_MODEL =
  process.env.BEDROCK_DEEPSEEK_INFERENCE_PROFILE_ARN ||
  process.env.BEDROCK_DEEPSEEK_MODEL_ID ||
  "deepseek.r1-v1:0";
  const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_INFERENCE_PROFILE_ARN ||
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "anthropic.claude-sonnet-4-5-20250929-v1:0";

  // init client once per request (ok for Vercel)
  const br = new BedrockRuntimeClient({ region: REGION });

  // 1) DeepSeek: PLAN (structure + constraints)
  const deepseekPlan = await bedrockJSON(br, DEEPSEEK_MODEL, {
    system: "You are UGC Creative Director + Senior App Engineer. Return ONLY valid JSON. No markdown. No extra text.",
    user: {
      task: "PLAN",
      rules: {
        plan_once: true,
        scene_count: project.scene_count,
        seconds_per_scene: project.seconds_per_scene,
        consistent_style: true,
        anti_claim_hallucination: true,
        no_gemini: true
      },
      input: project
    }
  });

  // 2) Claude: VO + on-screen text (natural gen-z, consistent)
  const claudeVO = await bedrockJSON(br, CLAUDE_MODEL, {
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

  // 3) DeepSeek: COMPILE final blueprint V1 (locks + storyboard + video_prompt + validation)
  const blueprint = await bedrockJSON(br, DEEPSEEK_MODEL, {
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

async function bedrockJSON(brClient, modelId, payload) {
  // Converse API works across many models; content must be array of blocks
  const cmd = new ConverseCommand({
    modelId,
    messages: [
      {
        role: "user",
        content: [
          { text: `SYSTEM:\n${payload.system}\n\nUSER_JSON:\n${JSON.stringify(payload.user)}` }
        ]
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
  // Converse response structure: out.output.message.content = [{text: "..."}]
  const blocks = out?.output?.message?.content || [];
  const joined = blocks.map((b) => b?.text || "").join("\n").trim();
  return joined;
}

/* =========================
   GEMINI OPTION (3rd brain)
   ========================= */

async function planWithGemini(project) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash"; // kamu bisa ganti nanti
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  // Gemini: single-pass blueprint (lebih murah/cepat, tapi quality bisa beda)
  const prompt = {
    task: "COMPILE_BLUEPRINT_V1_SINGLE_PASS",
    constraints: {
      output: "JSON_ONLY",
      segments: "V1 segmented JSON blocks in one JSON object (keys per segment)",
      scene_count: project.scene_count,
      seconds_per_scene: project.seconds_per_scene,
      strict_compliance: true,
      no_claim_hallucination: true
    },
    input: project
  };

  const r = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: JSON.stringify(prompt) }] }],
    generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 4096 }
  });

  const text = (r?.text || "").trim();
  if (!text) throw new Error("Gemini returned empty text");

  return safeJsonParse(text);
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
