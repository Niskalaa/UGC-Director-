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

export interface Constraints {
  do_not_say_optional: string[];
  must_include_optional: string[];
  language: string;
  vo_duration_seconds: number;
}

export interface FormData {
  brand: Brand;
  product: Product;
  scrape: Scrape;
  constraints: Constraints;
}

export interface ScrapeSanitized {
  clean_text: string;
  detected_injection_patterns: string[];
  removed_sections_summary: string[];
}

export interface ScrapeFacts {
  facts: string[];
  usage_steps_optional?: string[];
  warnings_optional?: string[];
  claims_found_optional?: string[];
  evidence_limits_note: string;
}

export interface BrandDNA {
  voice_traits: string[];
  genz_style_rules: string[];
  taboo_words: string[];
  cta_style: string;
  audience_guess: string;
  platform_pacing_notes: string;
}

export interface ProductTruthSheet {
  core_facts: string[];
  safe_benefit_phrases: string[];
  forbidden_claims: string[];
  required_disclaimer: string;
  scrape_extracted_optional?: {
    extracted_facts: string[];
    ignored_instructions_found: string[];
  };
}

export interface StoryboardScene {
  scene_id: string;
  seconds: string;
  goal: string;
  hook_mechanic: string;
  location: string;
  continuity_locks: string[];
  product_visibility_rule: string;
}

export interface Storyboard {
  total_seconds: "15";
  preset_used_optional?: string;
  scenes: StoryboardScene[];
}

export interface UGCPrompt {
  scene_id: string;
  pose: string;
  action: string;
  shot_framing: string;
  hands_and_product_handling: string;
  dialogue_optional?: string;
  ugc_prompt: string;
  negative_prompt_ugc: string[];
}

export interface SceneSetup {
  scene_id: string;
  set_dressing: string[];
  lighting: string;
  time_of_day: string;
  sound_ambience_optional?: string;
  continuity_notes: string[];
  safety_and_compliance_notes: string[];
}

export interface VOTimecode {
  seconds: string;
  line: string;
}

export interface VOScript {
  language: 'id';
  duration_seconds: "15";
  timecodes: VOTimecode[];
  cta: string;
  alt_hooks: string[];
  on_screen_text_suggestions: string[];
  required_disclaimer_included: boolean;
}

export interface VideoPromptShot {
  scene_id: string;
  camera_move: string;
  focus_rule: string;
  product_readability_rule: string;
  audio_notes?: string;
}

export interface VideoPromptPackage {
  shotlist: VideoPromptShot[];
  global_constraints: string[];
  negative_prompt_video: string[];
}

export interface Evaluation {
  passed: boolean;
  issues: string[];
  fixes_applied: string[];
  regenerate_steps: string[];
}

// AI Output Types
export interface Scene {
  seconds: string;
  visual_description: string;
  audio_script: string;
  on_screen_text: string;
  image_prompt: string;
}

export interface GeneratedAsset {
  concept_title: string;
  hook_rationale: string;
  compliance_check: string;
  scenes: Scene[];
  negative_prompt_video: string;
  caption: string;
  cta_button: string;
  sanitization_report?: ScrapeSanitized;
  fact_extraction_report?: ScrapeFacts;
  brand_dna?: BrandDNA;
  product_truth_sheet?: ProductTruthSheet;
  storyboard?: Storyboard;
  ugc_prompts?: UGCPrompt[];
  scene_setups?: SceneSetup[];
  vo_script?: VOScript;
  video_prompt?: VideoPromptPackage;
  evaluation?: Evaluation;
}