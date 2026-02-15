// api/plan.js - V1 Blueprint Generator
// Production-grade implementation with Claude 4.5 Sonnet support
// Supports both Bedrock Converse API and Messages API

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || "us-west-2";
const bedrock = new BedrockRuntimeClient({ region: REGION });

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 2000; // 2s
const DEFAULT_MODEL = "anthropic.claude-sonnet-4-5-20250929-v1:0";

// V1 System Prompt - Enforces segmented blueprint structure
const V1_SYSTEM_PROMPT = `You are a UGC Creative Director + Senior App Engineer specializing in generating modular UGC ad prompts.

CRITICAL RULES:
1. Return ONLY valid JSON for the complete blueprint
2. Output must follow V1 segmented structure with all required segments
3. Storyboard is single source of truth - VO and video_prompt MUST reference storyboard beat_id
4. NEVER invent product claims, ingredients, certifications, pricing, or performance results
5. If claims data is missing, use placeholders like <benefit_1>, <benefit_2> and list them in placeholders_if_no_scrape
6. Avoid risky claims: medical/therapeutic, guarantees, 'instant', 'before-after', 'doctor recommended'

REQUIRED SEGMENTS:
- meta: generator version, language, platform, aspect ratio, duration, compliance mode
- input: brand, product type, material, scrape_url, tone, target audience, claims
- locks: identity_lock, outfit_lock, product_lock (with rules)
- storyboard: beats array with id, time_window, goal, pose, scene, action, on_screen_text, audio_notes, negative_prompt
- vo: style, constraints, negative_claims, script array with beat_id references
- video_prompt: purpose, camera, lighting, continuity_rules, negative_prompt, shotlist
- placeholders_if_no_scrape: array of placeholder identifiers
- validation: checks array, passed boolean, issues array

Each beat MUST have:
- id (B1, B2, B3, B4, etc)
- time_window (e.g., "0-3s", "3-8s", "8-12s", "12-15s")
- goal (HOOK, DEMO, BENEFIT_PROOF, CTA)
- pose object with framing, body_language, expression
- scene object with setting, background, props, continuity
- action (string)
- on_screen_text (string)
- audio_notes (string)
- negative_prompt (array of strings)

VO script MUST reference beat_id that exists in storyboard.

Return the complete blueprint as a single valid JSON object with all segments.`;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isClaude45Model(modelId = "") {
  const id = String(modelId).trim().toLowerCase();
  
  // Inference profile ARN
  if (id.startsWith("arn:aws:bedrock:") && id.includes(":inference-profile/")) {
    return id.includes("claude-sonnet-4-5") || id.includes("claude-opus-4");
  }
  
  // Global inference profile
  if (id.startsWith("global.")) {
    return id.includes("claude-sonnet-4-5") || id.includes("claude-opus-4");
  }
  
  // Base model ID
  return (
    id.includes("anthropic.claude-sonnet-4") ||
    id.includes("anthropic.claude-opus-4") ||
    id.includes("anthropic.claude-haiku-4")
  );
}

function isThrottleError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("throttl") ||
    message.includes("rate exceeded") ||
    message.includes("too many requests") ||
    message.includes("resource_exhausted") ||
    message.includes("429")
  );
}

function isOnDemandNotSupported(error) {
  const message = String(error?.message || error || "");
  return message.includes("on-demand throughput isn't supported");
}

function parseRetryAfter(error) {
  const message = String(error?.message || error || "");
  const match = message.match(/retry in\s+([\d.]+)s/i);
  if (match) {
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000; // Convert to milliseconds
    }
  }
  return null;
}

function extractJson(text) {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  
  // Try to extract from ```json ... ```
  const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  } else {
    // Try to extract from ``` ... ```
    const codeMatch = cleaned.match(/```\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      cleaned = codeMatch[1].trim();
    }
  }
  
  // If still not valid, try to find JSON object
  if (!cleaned.startsWith("{")) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      cleaned = objMatch[0];
    }
  }
  
  return JSON.parse(cleaned);
}

function validateBlueprint(blueprint) {
  const errors = [];
  
  // Check required segments
  if (!blueprint.meta) errors.push("Missing 'meta' segment");
  if (!blueprint.input) errors.push("Missing 'input' segment");
  if (!blueprint.locks) errors.push("Missing 'locks' segment");
  if (!blueprint.storyboard) errors.push("Missing 'storyboard' segment");
  if (!blueprint.vo) errors.push("Missing 'vo' segment");
  if (!blueprint.video_prompt) errors.push("Missing 'video_prompt' segment");
  if (!blueprint.validation) errors.push("Missing 'validation' segment");
  
  // Check storyboard structure
  if (blueprint.storyboard) {
    if (!Array.isArray(blueprint.storyboard.beats)) {
      errors.push("storyboard.beats must be an array");
    } else {
      blueprint.storyboard.beats.forEach((beat, idx) => {
        if (!beat.id) errors.push(`Beat ${idx} missing 'id'`);
        if (!beat.negative_prompt || !Array.isArray(beat.negative_prompt)) {
          errors.push(`Beat ${beat.id || idx} missing 'negative_prompt' array`);
        }
      });
    }
  }
  
  // Check VO references storyboard beats
  if (blueprint.vo && blueprint.storyboard) {
    const beatIds = new Set((blueprint.storyboard.beats || []).map(b => b.id));
    (blueprint.vo.script || []).forEach((line, idx) => {
      if (line.beat_id && !beatIds.has(line.beat_id)) {
        errors.push(`VO script line ${idx} references non-existent beat_id: ${line.beat_id}`);
      }
    });
  }
  
  return errors;
}

// ============================================================================
// BLUEPRINT GENERATION
// ============================================================================

async function generateBlueprintWithRetry(project, modelId, retries = MAX_RETRIES) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await generateBlueprint(project, modelId);
    } catch (error) {
      lastError = error;
      
      // Don't retry on validation errors or client errors
      if (error.message?.includes("Missing") || error.message?.includes("required")) {
        throw error;
      }
      
      // Handle throttling with exponential backoff
      if (isThrottleError(error)) {
        const retryAfter = parseRetryAfter(error);
        const delay = retryAfter || (BASE_RETRY_DELAY * Math.pow(2, attempt - 1));
        
        console.warn(`[plan.js] Throttled. Retry ${attempt}/${retries} after ${delay}ms`);
        
        if (attempt < retries) {
          await sleep(delay);
          continue;
        }
      }
      
      // Handle on-demand not supported - suggest using inference profile
      if (isOnDemandNotSupported(error)) {
        throw new Error(
          `Model ${modelId} doesn't support on-demand. Use inference profile instead: ` +
          `us.anthropic.claude-sonnet-4-5-v2:0 or global.anthropic.claude-sonnet-4-5-v2:0`
        );
      }
      
      // Last attempt failed
      if (attempt === retries) {
        throw new Error(`Blueprint generation failed after ${retries} attempts: ${error.message}`);
      }
      
      // Retry with delay
      console.warn(`[plan.js] Attempt ${attempt}/${retries} failed. Retrying...`);
      await sleep(BASE_RETRY_DELAY * attempt);
    }
  }
  
  throw lastError;
}

async function generateBlueprint(project, modelId) {
  // Build user prompt from project data
  const {
    brand,
    product_type,
    material,
    product_name,
    category,
    tone,
    target_audience,
    scrape_url,
    scene_count = 4,
    seconds_per_scene = "3-4s",
    platform = "tiktok",
    aspect_ratio = "9:16",
  } = project;
  
  const beatsCount = Number(scene_count) || 4;
  const estimatedDuration = beatsCount * 3.75; // Rough estimate
  
  const userPrompt = `Generate a V1 UGC ad blueprint with the following specifications:

INPUTS:
- Brand: ${brand}
- Product Type: ${product_type}
- Material: ${material}
${product_name ? `- Product Name: ${product_name}` : ""}
${category ? `- Category: ${category}` : ""}
${tone ? `- Tone: ${tone}` : "- Tone: natural gen-z"}
${target_audience ? `- Target Audience: ${target_audience}` : ""}
${scrape_url ? `- Scrape URL: ${scrape_url}` : "- Scrape URL: null (use placeholders)"}

FORMAT:
- Language: id
- Platform: ${platform}
- Aspect Ratio: ${aspect_ratio}
- Duration: ~15 seconds
- Scene Count: ${beatsCount} beats (B1-B${beatsCount})
- Seconds per Scene: ${seconds_per_scene}

REQUIREMENTS:
1. Generate complete V1 blueprint JSON with all 8 segments
2. Each beat MUST have embedded negative_prompt array (minimum 10 items)
3. VO script MUST reference valid beat_id from storyboard
4. If scrape_url is null, use placeholders and list them in placeholders_if_no_scrape
5. Validation MUST check all required fields

Beat goals distribution:
- B1: HOOK (capture attention immediately)
- B2: DEMO (show product in use)
- B3: BENEFIT_PROOF (demonstrate value)
- B4: CTA (call to action)

Return ONLY the complete JSON blueprint, no markdown formatting, no explanations.`;

  // Call Bedrock using Converse API
  const command = new ConverseCommand({
    modelId,
    messages: [
      {
        role: "user",
        content: [{ text: userPrompt }],
      },
    ],
    system: [{ text: V1_SYSTEM_PROMPT }],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
    },
  });
  
  console.log(`[plan.js] Calling Bedrock model: ${modelId}`);
  const response = await bedrock.send(command);
  
  // Extract text from response
  let blueprintText = "";
  if (response.output?.message?.content) {
    for (const block of response.output.message.content) {
      if (block.text) {
        blueprintText += block.text;
      }
    }
  }
  
  if (!blueprintText) {
    throw new Error("Empty response from Bedrock");
  }
  
  // Parse JSON
  let blueprint;
  try {
    blueprint = extractJson(blueprintText);
  } catch (parseError) {
    console.error("[plan.js] Failed to parse JSON:", blueprintText.slice(0, 500));
    throw new Error(`Failed to parse blueprint JSON: ${parseError.message}`);
  }
  
  // Validate blueprint structure
  const validationErrors = validateBlueprint(blueprint);
  if (validationErrors.length > 0) {
    console.error("[plan.js] Blueprint validation failed:", validationErrors);
    throw new Error(`Blueprint validation failed: ${validationErrors.join(", ")}`);
  }
  
  console.log("[plan.js] Blueprint generated successfully");
  return blueprint;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req, res) {
  // CORS headers for Vercel
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  
  const startTime = Date.now();
  
  try {
    const { project, provider = "bedrock" } = req.body || {};
    
    // Validate project data
    if (!project) {
      return res.status(400).json({ ok: false, error: "project data required" });
    }
    
    const requiredFields = ["brand", "product_type", "material"];
    const missingFields = requiredFields.filter(field => !project[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        ok: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }
    
    // Only support Bedrock for now
    if (provider !== "bedrock") {
      return res.status(400).json({
        ok: false,
        error: "Only 'bedrock' provider is supported",
      });
    }
    
    // Get model ID from env or use default
    const modelId = process.env.BEDROCK_LLM_MODEL_ID || DEFAULT_MODEL;
    
    console.log(`[plan.js] Starting blueprint generation with model: ${modelId}`);
    
    // Generate blueprint with retry logic
    const blueprint = await generateBlueprintWithRetry(project, modelId);
    
    const duration = Date.now() - startTime;
    console.log(`[plan.js] Blueprint generated in ${duration}ms`);
    
    return res.status(200).json({
      ok: true,
      provider: "bedrock",
      model: modelId,
      blueprint,
      metadata: {
        generated_at: new Date().toISOString(),
        duration_ms: duration,
        version: "v1",
      },
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error("[plan.js] Error:", error);
    
    return res.status(500).json({
      ok: false,
      error: error.message || "Blueprint generation failed",
      metadata: {
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
