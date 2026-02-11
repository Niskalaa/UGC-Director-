
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
  scene_count?: number;
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

export interface Scene {
  seconds: string;
  visual_description: string;
  audio_script: string;
  on_screen_text: string;
  image_prompt: string;
}

export interface VideoPromptPackage {
  negative_prompt_video: string[];
}

export interface GeneratedAsset {
  concept_title: string;
  hook_rationale: string;
  brand_dna: BrandDNA;
  product_truth_sheet: ProductTruthSheet;
  // Optional during loading phase
  scenes?: Scene[];
  compliance_check?: string;
  caption?: string;
  cta_button?: string;
  sanitization_report?: ScrapeSanitized;
  video_prompt?: VideoPromptPackage;
}