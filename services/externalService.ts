
import { FormData, GeneratedAsset } from "../types";

// Service to handle interactions with OpenRouter API
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_IMAGE_URL = "https://openrouter.ai/api/v1/images/generations";

export const getStoredOpenRouterKey = () => localStorage.getItem('OPENROUTER_API_KEY') || "";

export const setStoredOpenRouterKey = (key: string) => {
    if (key) localStorage.setItem('OPENROUTER_API_KEY', key);
    else localStorage.removeItem('OPENROUTER_API_KEY');
};

export const getStoredOpenRouterModel = () => localStorage.getItem('OPENROUTER_MODEL') || "deepseek/deepseek-chat";
export const setStoredOpenRouterModel = (model: string) => localStorage.setItem('OPENROUTER_MODEL', model);

const cleanJson = (text: string): string => {
  if (!text) return "{}";
  let clean = text.trim();
  clean = clean.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  return clean;
};

// Generic OpenRouter Fetch
const fetchOpenRouter = async (messages: any[], model: string, responseFormat: boolean = true) => {
  const apiKey = getStoredOpenRouterKey();
  if (!apiKey) throw new Error("OpenRouter API Key is missing");

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "UGC Director AI"
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      response_format: responseFormat ? { type: "json_object" } : undefined,
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "OpenRouter API failed");
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

// 1. Generate Strategy via OpenRouter
export const generateStrategyOpenRouter = async (formData: FormData, contextText: string): Promise<Partial<GeneratedAsset>> => {
  const model = getStoredOpenRouterModel();
  const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
  
  const systemPrompt = `
    ROLE: You are a World-Class Direct Response Copywriter and Creative Director for UGC Ads (TikTok/Reels).
    OBJECTIVE: Perform a deep psychological analysis of the product and audience, then develop a viral ad strategy.
    
    OUTPUT FORMAT: Return ONLY valid JSON matching this structure:
    {
      "concept_title": "string",
      "hook_rationale": "string",
      "analysis_report": {
        "audience_persona": "string",
        "core_pain_points": ["string"],
        "emotional_triggers": ["string"],
        "competitor_gap": "string",
        "winning_angle_logic": "string"
      },
      "brand_dna": {
        "voice_traits": ["string"],
        "cta_style": "string",
        "audience_guess": "string",
        "genz_style_rules": ["string"],
        "taboo_words": ["string"]
      },
      "product_truth_sheet": {
        "core_facts": ["string"],
        "required_disclaimer": "string",
        "safe_benefit_phrases": ["string"],
        "forbidden_claims": ["string"]
      }
    }
  `;

  const userPrompt = `
    INPUT DATA:
    Brand: ${formData.brand.name}
    Tone: ${formData.brand.tone_hint_optional}
    Product: ${formData.product.type} (${formData.product.material})
    Objective: ${formData.product.objective}
    Target Platform: ${formData.product.platform.join(', ')}
    Context: ${contextText}

    DEEP DIVE METHODOLOGY:
    1. **Audience Persona**: Who specifically is this for? What keeps them up at night?
    2. **Psychological Triggers**: Identify the emotional levers (e.g., Status, Fear of Missing Out, Convenience, Identity).
    3. **Competitor Gap**: What is the market ignoring that this product solves?
    4. **The Winning Angle**: Based on the above, select the single most powerful angle (e.g., "Us vs Them", "The Secret Hack", "Shocking Truth").

    REQUIREMENTS:
    - Language: Strictly ${outputLanguage}.
    - Tone: Authentic, Native to TikTok/Reels.
  `;

  const content = await fetchOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], model);

  return JSON.parse(cleanJson(content));
};

// 2. Generate Scenes via OpenRouter
export const generateScenesOpenRouter = async (formData: FormData, strategy: Partial<GeneratedAsset>): Promise<Partial<GeneratedAsset>> => {
  const model = getStoredOpenRouterModel();
  const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
  const targetSceneCount = formData.constraints.scene_count || 5;

  const systemPrompt = `
    ROLE: You are an Elite UGC Scriptwriter & Visual Director.
    TASK: Write a production-ready, frame-by-frame script based on the provided strategy.

    OUTPUT FORMAT: Return ONLY valid JSON matching this structure:
    {
      "compliance_check": "string",
      "scenes": [
        {
          "seconds": "string (e.g. '0-3')",
          "visual_description": "string",
          "audio_script": "string",
          "on_screen_text": "string",
          "image_prompt": "string",
          "image_negative_prompt": "string"
        }
      ],
      "caption": "string",
      "cta_button": "string"
    }
  `;

  const userPrompt = `
    STRATEGY CONTEXT:
    Concept: ${strategy.concept_title}
    Winning Angle: ${strategy.analysis_report?.winning_angle_logic}
    Persona: ${strategy.analysis_report?.audience_persona}
    Hook: ${strategy.hook_rationale}

    CONSTRAINTS:
    Duration: ${formData.constraints.vo_duration_seconds}s
    Scene Count: Exactly ${targetSceneCount} scenes.
    Language: ${outputLanguage}

    EXECUTION GUIDELINES:
    1. **The Hook (Scene 1)**: Must be a pattern interrupt. Visuals must start in motion. Audio must grab attention in 0.5s.
    2. **The Retain**: Deliver value immediately. No fluff.
    3. **The Solution**: Show, don't just tell.
    4. **The CTA**: Clear instruction on what to do next.

    IMAGE PROMPT ENGINEERING:
    - Write photorealistic prompts for Flux/Midjourney.
    - Lighting: Specify "Natural window light", "Ring light", "Golden hour".
    - Camera: "Shot on iPhone 15 Pro", "Macro lens", "Handheld POV".
    - Aesthetic: "UGC", "Authentic", "Unpolished", "Viral TikTok style".
  `;

  const content = await fetchOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], model);

  return JSON.parse(cleanJson(content));
};

// 3. Generate Image via OpenRouter (Flux/Stable Diffusion)
export const generateImageOpenRouter = async (prompt: string, aspectRatio: string): Promise<string> => {
  const apiKey = getStoredOpenRouterKey();
  if (!apiKey) throw new Error("OpenRouter API Key is missing for Image Gen");

  // Default to Flux Schnell for speed/cost if available, or fallback to user preference
  const model = "black-forest-labs/flux-1-schnell"; 

  try {
    const response = await fetch(OPENROUTER_IMAGE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "UGC Director AI"
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        n: 1,
        size: aspectRatio === "16:9" ? "1024x576" : aspectRatio === "9:16" ? "576x1024" : "1024x1024"
      })
    });

    if (!response.ok) {
        // Some models on OR use chat completions for images, but standard ones use v1/images
        const err = await response.json();
        throw new Error(err.error?.message || "OpenRouter Image API failed");
    }

    const data = await response.json();
    return data.data[0].url || data.data[0].b64_json;
  } catch (error: any) {
    console.warn("OpenRouter Image Gen Error:", error);
    throw new Error(`OpenRouter Image Gen Failed: ${error.message}`);
  }
};
