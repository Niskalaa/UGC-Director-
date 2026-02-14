// api/plan.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const project = body.project || null;
    if (!project) return res.status(400).json({ error: "project required" });

    // Minimal guard (sesuaikan kalau kamu mau)
    const required = ["brand", "product_type", "material", "platform", "aspect_ratio", "scene_count", "seconds_per_scene"];
    for (const k of required) {
      if (project[k] === undefined || project[k] === null || String(project[k]).trim() === "") {
        return res.status(400).json({ error: `missing ${k}` });
      }
    }
    if (!project.model_ref_url || !project.product_ref_url) {
      return res.status(400).json({ error: "model_ref_url & product_ref_url required" });
    }

    // 1) DeepSeek: planner + constraints + validation skeleton
    const deepseekPlan = await callDeepSeekPlanner(project);

    // 2) Claude: VO + on-screen text (1 gaya konsisten)
    const claudeVO = await callClaudeVO(project, deepseekPlan);

    // 3) DeepSeek: compile final (locks + storyboard + video_prompt + validation)
    const blueprint = await callDeepSeekCompiler(project, deepseekPlan, claudeVO);

    return res.status(200).json({
      ok: true,
      blueprint
    });
  } catch (e) {
    console.error("PLAN ERROR:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

/** =======================
 *  PROVIDER CALLS (stub)
 *  ======================= */

/**
 * NOTE:
 * Kamu sudah pilih: DeepSeek + Claude.
 * Cara paling simpel: pakai OpenRouter UNTUK TEXT MODELS saja.
 * (Image/video provider terpisah.)
 *
 * Set env:
 * OPENROUTER_API_KEY
 * DEEPSEEK_MODEL (example: "deepseek/deepseek-r1" or "deepseek/deepseek-chat")
 * CLAUDE_MODEL (example: "anthropic/claude-3.5-sonnet")
 */

async function callDeepSeekPlanner(project) {
  const model = process.env.DEEPSEEK_MODEL;
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");
  if (!model) throw new Error("Missing DEEPSEEK_MODEL");

  const sys = `You are UGC Creative Director + Senior App Engineer.
Return ONLY valid JSON. No markdown. No extra text.`;

  const user = {
    task: "PLAN",
    rules: {
      plan_once: true,
      scene_count: project.scene_count,
      seconds_per_scene: project.seconds_per_scene,
      consistent_style: true,
      no_gemini: true,
      no_claim_hallucination: true
    },
    input: project
  };

  const json = await openrouterJSON(model, sys, user);
  return json;
}

async function callClaudeVO(project, deepseekPlan) {
  const model = process.env.CLAUDE_MODEL;
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");
  if (!model) throw new Error("Missing CLAUDE_MODEL");

  const sys = `You write natural gen-z Indonesian UGC VO.
Return ONLY valid JSON. No markdown. No extra text.`;

  const user = {
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
  };

  const json = await openrouterJSON(model, sys, user);
  return json;
}

async function callDeepSeekCompiler(project, deepseekPlan, claudeVO) {
  const model = process.env.DEEPSEEK_MODEL;
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");
  if (!model) throw new Error("Missing DEEPSEEK_MODEL");

  const sys = `You compile UGC Prompt OS V1 blueprint.
Return ONLY valid JSON. No markdown. No extra text.`;

  const user = {
    task: "COMPILE_BLUEPRINT_V1",
    input: project,
    plan: deepseekPlan,
    vo: claudeVO
  };

  const json = await openrouterJSON(model, sys, user);
  return json;
}

/** OpenRouter helper that forces JSON */
async function openrouterJSON(model, system, userObj) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userObj) }
      ]
    })
  });

  if (!r.ok) throw new Error(`OpenRouter error: ${r.status} ${await r.text()}`);
  const data = await r.json();

  const content = data?.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("No content returned from model");

  try {
    return JSON.parse(content);
  } catch {
    // fallback: attempt extract JSON
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(content.slice(start, end + 1));
    throw new Error(`Model did not return valid JSON. contentPreview="${String(content).slice(0, 160)}"`);
  }
}
