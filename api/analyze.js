// api/analyze.js
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || "us-west-2";

// Claude 4.5 MUST use inference profile for many accounts.
// Priority: ARN -> ID -> (fallback) MODEL_ID
const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_INFERENCE_PROFILE_ARN ||
  process.env.BEDROCK_CLAUDE_INFERENCE_PROFILE_ID ||
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "anthropic.claude-sonnet-4-5-20250929-v1:0";

function isClaude45BaseId(id = "") {
  return String(id).includes("anthropic.claude-sonnet-4-5-20250929-v1:0");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = req.body || {};
    const model_ref_url = (body?.model_ref_url || "").trim();
    const product_ref_url = (body?.product_ref_url || "").trim();
    const product_page_url = (body?.product_page_url || "").trim();
    const language = (body?.language || "id").toLowerCase() === "en" ? "en" : "id";

    // Guard: Claude 4.5 base ID often fails on-demand
    if (isClaude45BaseId(CLAUDE_MODEL)) {
      // We still allow fallback if your account supports it, but it's safer to hard-stop with clear msg.
      // Comment-out this throw if you want to "try anyway".
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

    // At least one input path must exist
    if (!product_page_url && !model_ref_url && !product_ref_url) {
      return res.status(400).json({
        ok: false,
        error: "Provide at least one: product_page_url OR model_ref_url/product_ref_url"
      });
    }

    const br = new BedrockRuntimeClient({ region: REGION });

    // Build “evidence” for analysis
    let scraped = null;
    if (product_page_url) {
      scraped = await scrapeProductPage(product_page_url);
    }

    let modelImg = null;
    let productImg = null;

    // Images optional (allow one or both)
    if (model_ref_url) modelImg = await fetchAsBedrockImage(model_ref_url);
    if (product_ref_url) productImg = await fetchAsBedrockImage(product_ref_url);

    const prompt = {
      task: "AUTO_FILL_PROJECT_FIELDS",
      output: "JSON_ONLY",
      rules: {
        no_guessing: true,
        if_unknown_use_empty_string: true,
        language
      },
      // UI kamu butuh ini untuk isi form
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
        "product_claims_safe", // array of safe, non-medical claims
        "visual_notes" // short notes for prompts (colors, packaging, outfit)
      ],
      // Provide context from URL scrape (optional)
      page_context: scraped
        ? {
            url: scraped.url,
            title: scraped.title,
            ogTitle: scraped.ogTitle,
            ogDesc: scraped.ogDesc,
            priceHint: scraped.priceHint,
            brandHint: scraped.brandHint,
            textSnippet: scraped.textSnippet,
            jsonLdSnippet: scraped.jsonLdSnippet
          }
        : null
    };

    const contentBlocks = [
      {
        text:
          "Return ONLY valid JSON. No markdown. No extra text. " +
          "If you cannot determine a field, return empty string, or empty array for arrays."
      },
      { text: `USER_JSON:\n${JSON.stringify(prompt)}` }
    ];

    if (modelImg) {
      contentBlocks.push({ text: "\nIMAGE_1: model reference\n" });
      contentBlocks.push({ image: { format: modelImg.format, source: { bytes: modelImg.bytes } } });
    }

    if (productImg) {
      contentBlocks.push({ text: "\nIMAGE_2: product reference\n" });
      contentBlocks.push({ image: { format: productImg.format, source: { bytes: productImg.bytes } } });
    }

    // If no images, still proceed with URL text-only
    const cmd = new ConverseCommand({
      modelId: CLAUDE_MODEL,
      messages: [{ role: "user", content: contentBlocks }],
      inferenceConfig: {
        temperature: 0.2,
        maxTokens: 1200
      }
    });

    const out = await br.send(cmd);
    const text = extractBedrockText(out);
    const parsed = safeJsonParse(text);

    // Normalize output: ensure all keys exist
    const fields = normalizeFields(parsed);

    return res.status(200).json({ ok: true, fields });
  } catch (e) {
    console.error("ANALYZE ERROR:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

/* =========================
   Helpers
   ========================= */

function extractBedrockText(out) {
  const blocks = out?.output?.message?.content || [];
  return blocks.map((b) => b?.text || "").join("\n").trim();
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

function normalizeFields(obj) {
  const o = obj && typeof obj === "object" ? obj : {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

  return {
    brand: str(o.brand),
    product_type: str(o.product_type),
    material: str(o.material),
    suggested_platform: str(o.suggested_platform),
    suggested_aspect_ratio: str(o.suggested_aspect_ratio),
    suggested_scene_count: str(o.suggested_scene_count),
    suggested_seconds_per_scene: str(o.suggested_seconds_per_scene),
    tone: str(o.tone),
    target_audience: str(o.target_audience),
    product_claims_safe: arr(o.product_claims_safe).map(str).filter(Boolean),
    visual_notes: str(o.visual_notes)
  };
}

/* =========================
   Image fetch -> bytes for Bedrock
   ========================= */

async function fetchAsBedrockImage(url) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`Failed to fetch image: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());

  const ct = (r.headers.get("content-type") || "").toLowerCase();

  // Bedrock supports: png | jpeg | webp
  let format = "jpeg";
  if (ct.includes("png")) format = "png";
  else if (ct.includes("webp")) format = "webp";
  else if (ct.includes("jpeg") || ct.includes("jpg")) format = "jpeg";
  else {
    // fallback: detect from url
    const u = url.toLowerCase();
    if (u.includes(".png")) format = "png";
    if (u.includes(".webp")) format = "webp";
    if (u.includes(".jpg") || u.includes(".jpeg")) format = "jpeg";
  }

  return { format, bytes: buf };
}

/* =========================
   Lightweight scraper
   (best-effort, no heavy deps)
   ========================= */

async function scrapeProductPage(url) {
  const r = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; UGCStudioBot/1.0; +https://example.com) AppleWebKit/537.36 (KHTML, like Gecko)"
    }
  });
  if (!r.ok) throw new Error(`Failed to fetch page: ${r.status}`);
  const html = await r.text();

  const title = pickTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitle = pickMeta(html, "og:title");
  const ogDesc = pickMeta(html, "og:description") || pickMeta(html, "description");
  const jsonLd = pickAllJsonLd(html);

  // Basic hints (Shopee/Tokopedia etc often embed these)
  const priceHint = findFirst(html, /(rp\s*[\d.\,]+)/i) || "";
  const brandHint = findFirst(html, /(brand|merek)\s*[:\-]\s*([a-z0-9 _\-]+)/i, 2) || "";

  // Strip most tags -> snippet
  const textSnippet = toTextSnippet(html, 1600);
  const jsonLdSnippet = jsonLd ? JSON.stringify(jsonLd).slice(0, 1600) : "";

  return {
    url,
    title: clean(title),
    ogTitle: clean(ogTitle),
    ogDesc: clean(ogDesc),
    priceHint: clean(priceHint),
    brandHint: clean(brandHint),
    textSnippet,
    jsonLdSnippet
  };
}

function pickTag(html, re) {
  const m = html.match(re);
  return m ? m[1] : "";
}

function pickMeta(html, prop) {
  // matches: <meta property="og:title" content="...">
  const re1 = new RegExp(`<meta[^>]+property=["']${escapeReg(prop)}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const re2 = new RegExp(`<meta[^>]+name=["']${escapeReg(prop)}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const m = html.match(re1) || html.match(re2);
  return m ? m[1] : "";
}

function pickAllJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const raw = (m[1] || "").trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // ignore non-JSON
    }
  }
  return out.length ? out : null;
}

function toTextSnippet(html, maxLen) {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = noScript.replace(/<[^>]+>/g, " ");
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.slice(0, maxLen);
}

function findFirst(text, re, group = 1) {
  const m = String(text).match(re);
  if (!m) return "";
  return m[group] || "";
}

function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
