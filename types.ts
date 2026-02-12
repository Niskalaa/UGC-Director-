
export interface Brand {
  name: string;
  tone_hint_optional?: string;
  country_market_optional: string;
}

export interface Product {
  type: string;
  material: string;
  variant_optional?: string;
  price_tier_optional: 'budget' | 'mid' | 'premium';
  platform: ('tiktok' | 'reels' | 'shorts')[];
  objective: 'awareness' | 'consideration' | 'conversion';
  main_angle_optional?: 'problem-solution' | 'routine' | 'review' | 'aesthetic' | 'comparison';
}

export interface Scrape {
  source_url_optional?: string;
  raw_text_optional?: string;
}

export interface VisualSettings {
  camera_angle: 'Eye-level' | 'Low angle' | 'High angle' | 'Drone/Aerial' | 'POV' | 'Macro' | 'Dutch angle';
  lighting: 'Natural/Soft' | 'Golden Hour' | 'Studio/High-key' | 'Moody/Cinematic' | 'Neon/Cyberpunk' | 'Ring light';
  art_style: 'Realistic/UGC' | 'Cinematic' | 'Vintage/Retro' | 'Minimalist' | 'Vibrant/Pop' | 'Editorial';
}

export interface Constraints {
  do_not_say_optional: string[];
  must_include_optional: string[];
  language: string;
  vo_duration_seconds: number;
  scene_count?: number;
  ai_model?: string;
  image_generator_model?: string;
  variations_count: 1 | 2 | 3;
}

export interface FormData {
  brand: Brand;
  product: Product;
  scrape: Scrape;
  constraints: Constraints;
  visual_settings: VisualSettings;
}

export interface ScrapeSanitized {
  clean_text: string;
  detected_injection_patterns: string[];
  removed_sections_summary: string[];
}

export interface BrandDNA {
  voice_traits: string[];
  genz_style_rules?: string[];
  taboo_words?: string[];
  cta_style: string;
  audience_guess: string;
  platform_pacing_notes?: string;
}

export interface ProductTruthSheet {
  core_facts: string[];
  safe_benefit_phrases: string[];
  forbidden_claims: string[];
  required_disclaimer: string;
}

export interface AnalysisReport {
  audience_persona: string;
  core_pain_points: string[];
  emotional_triggers: string[];
  competitor_gap: string;
  winning_angle_logic: string;
}

export interface VideoParams {
  duration?: string;
  fps?: number;
  aspect_ratio?: string;
  motion_strength?: string;
}

export interface MediaPrompts {
  image_prompt: string;
  image_negative: string;
  video_prompt: string;
  video_negative: string;
  video_params: VideoParams;
}

export interface Scene {
  seconds: string;
  visual_description: string;
  audio_script: string;
  on_screen_text: string;
  
  // Structured Media Prompts
  media_prompts: MediaPrompts;

  // Legacy/Fallback flat fields (kept for compatibility during migration, can be deprecated)
  image_prompt?: string;
  image_negative_prompt?: string;
  video_prompt?: string;

  generated_audio?: string;
  generated_image?: string;
  generated_video?: string; // Added to track video result
}

export interface VideoPromptPackage {
  negative_prompt_video: string[];
}

export interface ScriptVariation {
  id: string;
  name: string;
  hook_type: string;
  scenes: Scene[];
  caption?: string;
  cta_button?: string;
}

export interface GeneratedAsset {
  concept_title: string;
  hook_rationale: string;
  brand_dna: BrandDNA;
  product_truth_sheet: ProductTruthSheet;
  analysis_report?: AnalysisReport;
  scenes?: Scene[]; 
  variations?: ScriptVariation[];
  compliance_check?: string;
  caption?: string;
  cta_button?: string;
  sanitization_report?: ScrapeSanitized;
  video_prompt?: VideoPromptPackage;
}
