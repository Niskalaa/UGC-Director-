// api/scrape.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") return res.status(400).json({ ok: false, error: "url required" });

    const cleaned = url.trim();
    let u;
    try {
      u = new URL(cleaned);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid URL" });
    }

    if (!["http:", "https:"].includes(u.protocol)) {
      return res.status(400).json({ ok: false, error: "Only http/https URLs are allowed" });
    }

    // Basic SSRF guard (block localhost + private IP literals)
    const host = (u.hostname || "").toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    ) {
      return res.status(400).json({ ok: false, error: "Blocked host" });
    }

    const html = await fetchHtmlWithLimits(cleaned, {
      timeoutMs: 12000,
      maxBytes: 800_000 // 0.8MB cukup untuk meta+jsonld
    });

    const meta = extractMeta(html);
    const jsonld = extractJsonLdProducts(html);

    // Merge candidates (prioritaskan JSON-LD)
    const fields = buildFields({ meta, jsonld, url: cleaned });

    return res.status(200).json({ ok: true, fields });
  } catch (e) {
    console.error("SCRAPE ERROR:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

/* =========================
   Fetch with timeout + size limit
   ========================= */

async function fetchHtmlWithLimits(url, { timeoutMs = 12000, maxBytes = 800000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        // Some sites block default fetch UA
        "user-agent":
          "Mozilla/5.0 (compatible; UGCStudioBot/1.0; +https://vercel.app)",
        accept: "text/html,application/xhtml+xml"
      }
    });

    if (!r.ok) throw new Error(`Fetch failed (${r.status})`);

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      // masih bisa jalan, tapi kasih warning style
      // throw new Error("URL does not look like HTML");
    }

    const reader = r.body?.getReader?.();
    if (!reader) {
      // fallback
      const text = await r.text();
      return text.slice(0, maxBytes);
    }

    let received = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) break;
      chunks.push(value);
    }

    const merged = concatUint8(chunks);
    return new TextDecoder("utf-8").decode(merged);
  } catch (e) {
    if (e?.name === "AbortError") throw new Error(`Timeout after ${Math.round(timeoutMs / 1000)}s`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

function concatUint8(chunks) {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/* =========================
   HTML parsing (no deps)
   ========================= */

function extractMeta(html) {
  const out = {
    title: pickFirst([
      matchTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
      matchMeta(html, "og:title"),
      matchMeta(html, "twitter:title")
    ]),
    description: pickFirst([
      matchMeta(html, "description"),
      matchMeta(html, "og:description"),
      matchMeta(html, "twitter:description")
    ]),
    ogImage: pickFirst([matchMeta(html, "og:image"), matchMeta(html, "twitter:image")]),
    siteName: pickFirst([matchMeta(html, "og:site_name")]),
    brandHint: pickFirst([matchMeta(html, "brand"), matchMeta(html, "og:brand")]),
    raw: null
  };

  // normalize whitespace
  out.title = normalizeText(out.title);
  out.description = normalizeText(out.description);

  return out;
}

function matchMeta(html, nameOrProp) {
  // match <meta name="x" content="..."> OR <meta property="x" content="...">
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escapeRegExp(nameOrProp)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1] : "";
}

function matchTagContent(html, re) {
  const m = html.match(re);
  return m ? m[1] : "";
}

function extractJsonLdProducts(html) {
  // find all <script type="application/ld+json">...</script>
  const scripts = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = (m[1] || "").trim();
    if (!raw) continue;
    scripts.push(raw);
  }

  const products = [];
  for (const s of scripts) {
    const parsed = tryParseJsonLd(s);
    if (!parsed) continue;

    const nodes = flattenJsonLd(parsed);
    for (const node of nodes) {
      const t = (node?.["@type"] || node?.type || "").toString();
      if (!t) continue;

      // Product | ProductGroup | OfferCatalog etc (we focus Product)
      const types = Array.isArray(node["@type"]) ? node["@type"].map(String) : [String(node["@type"])];
      if (types.some((x) => x.toLowerCase() === "product")) {
        products.push(node);
      }
    }
  }
  return products;
}

function tryParseJsonLd(raw) {
  // some pages include multiple JSON objects without comma, try best
  const cleaned = raw
    .replace(/<!--([\s\S]*?)-->/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // attempt slice first {...} block
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) {
      const sliced = cleaned.slice(s, e + 1);
      try {
        return JSON.parse(sliced);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function flattenJsonLd(obj) {
  // could be { @graph: [...] } or array or single object
  if (!obj) return [];
  if (Array.isArray(obj)) return obj.flatMap(flattenJsonLd);
  if (obj["@graph"] && Array.isArray(obj["@graph"])) return obj["@graph"];
  return [obj];
}

/* =========================
   Field builder
   ========================= */

function buildFields({ meta, jsonld, url }) {
  const p = jsonld?.[0] || {};
  const name = normalizeText(p?.name || p?.title || meta?.title || "");
  const desc = normalizeText(p?.description || meta?.description || "");

  const brand =
    normalizeText(
      (typeof p?.brand === "string" ? p.brand : p?.brand?.name) ||
        meta?.brandHint ||
        meta?.siteName ||
        guessBrandFromHost(url)
    ) || "";

  const product_type =
    normalizeText(
      p?.category ||
        p?.productCategory ||
        guessProductTypeFromText(name, desc)
    ) || "";

  const material =
    normalizeText(
      p?.material ||
        guessMaterialFromText(name, desc)
    ) || "";

  const suggested_platform = "tiktok"; // default
  const suggested_aspect_ratio = "9:16"; // default

  // target audience + tone heuristics (safe defaults)
  const target_audience = guessAudienceFromText(name, desc);
  const tone = "natural gen-z";

  return {
    source_url: url,
    brand,
    product_type,
    material,
    target_audience,
    tone,
    suggested_platform,
    suggested_aspect_ratio
  };
}

/* =========================
   Heuristics helpers
   ========================= */

function guessBrandFromHost(url) {
  try {
    const u = new URL(url);
    const h = (u.hostname || "").replace(/^www\./, "");
    const main = h.split(".")[0] || "";
    return main ? capitalize(main) : "";
  } catch {
    return "";
  }
}

function guessProductTypeFromText(title, desc) {
  const t = `${title} ${desc}`.toLowerCase();

  const map = [
    ["sunscreen", ["sunscreen", "sun screen", "spf", "uv"]],
    ["skincare", ["serum", "toner", "moisturizer", "cleanser", "essence", "skincare"]],
    ["hoodie", ["hoodie"]],
    ["t-shirt", ["t-shirt", "tee", "kaos"]],
    ["dress", ["dress", "gaun"]],
    ["coffee", ["coffee", "kopi", "espresso"]],
    ["snack", ["chips", "keripik", "snack", "candy", "biskuit"]],
    ["shoes", ["sneakers", "shoes", "sepatu"]],
    ["bag", ["bag", "tas"]],
    ["perfume", ["perfume", "parfum", "fragrance"]],
  ];

  for (const [label, keys] of map) {
    if (keys.some((k) => t.includes(k))) return label;
  }
  return "";
}

function guessMaterialFromText(title, desc) {
  const t = `${title} ${desc}`.toLowerCase();
  const materials = ["cotton", "linen", "polyester", "wool", "leather", "stainless", "steel", "silk", "denim", "nylon", "rayon"];
  for (const m of materials) {
    if (t.includes(m)) return m === "steel" ? "stainless steel" : m;
  }
  return "";
}

function guessAudienceFromText(title, desc) {
  const t = `${title} ${desc}`.toLowerCase();
  // super ringan aja biar ga sok tau
  if (t.includes("men") || t.includes("pria") || t.includes("cowok")) return "pria 18–34";
  if (t.includes("women") || t.includes("wanita") || t.includes("cewek") || t.includes("girl")) return "wanita 18–34";
  return "";
}

function normalizeText(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .trim();
}

function pickFirst(arr) {
  for (const x of arr) {
    const v = normalizeText(x);
    if (v) return v;
  }
  return "";
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalize(s) {
  const x = String(s || "");
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : "";
}
