// api/scrape.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { url } = req.body || {};
    if (!url || typeof url !== "string") return res.status(400).json({ error: "Missing url" });

    // ---- basic guard ----
    let u;
    try { u = new URL(url); } catch { return res.status(400).json({ error: "Invalid URL" }); }
    if (!["http:", "https:"].includes(u.protocol)) return res.status(400).json({ error: "Invalid protocol" });

    // optional: host allowlist for safety
    // const allow = ["zalora.co.id", "www.zalora.co.id"];
    // if (!allow.some(h => u.hostname === h || u.hostname.endsWith("." + h))) { ... }

    const html = await fetchHtml(url);
    const meta = parseMeta(html);
    const jsonld = parseJsonLd(html);
    const nextData = parseNextData(html);

    const picked = pickBestProduct(jsonld, nextData, meta);

    // ---- heuristics: derive product_type/material if absent ----
    const title = cleanStr(picked.title || meta.ogTitle || meta.title);
    const brand = cleanStr(picked.brand || inferBrandFromTitle(title));
    const description = cleanStr(picked.description || meta.ogDescription || meta.description);

    const images = uniq([
      ...(Array.isArray(picked.images) ? picked.images : []),
      meta.ogImage,
      meta.twitterImage,
    ].filter(Boolean)).slice(0, 12);

    const price = picked.price ?? null;
    const currency = picked.currency ?? null;

    const product_type = cleanStr(
      picked.product_type ||
      inferProductType(title, description)
    );

    const material = cleanStr(
      picked.material ||
      inferMaterial(title, description)
    );

    return res.status(200).json({
      url,
      title,
      brand,
      product_type,
      material,
      description,
      price,
      currency,
      images,
      source: picked.source,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; UGC-Director/1.0; +https://vercel.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("text/html")) throw new Error("Not HTML");
    const text = await r.text();
    if (!text || text.length < 100) throw new Error("Empty HTML");
    return text;
  } finally {
    clearTimeout(t);
  }
}

function parseMeta(html) {
  const get = (re) => {
    const m = html.match(re);
    return m ? decodeHtml(m[1]).trim() : "";
  };

  const title =
    get(/<title[^>]*>([^<]{1,300})<\/title>/i);

  const ogTitle =
    get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);

  const ogDescription =
    get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);

  const ogImage =
    get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

  const twitterImage =
    get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

  const description =
    get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  return { title, ogTitle, ogDescription, ogImage, twitterImage, description };
}

function parseJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    const json = safeJson(raw);
    if (!json) continue;
    if (Array.isArray(json)) out.push(...json);
    else out.push(json);
  }
  return out;
}

function parseNextData(html) {
  // Next.js: __NEXT_DATA__
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  return safeJson(m[1]);
}

function pickBestProduct(jsonld, nextData, meta) {
  // 1) JSON-LD Product
  for (const node of jsonld || []) {
    const p = normalizeProductNode(node);
    if (p) return { ...p, source: "jsonld" };
  }

  // 2) Next data heuristic (varies per site)
  const nx = normalizeFromNext(nextData);
  if (nx) return { ...nx, source: "next" };

  // 3) meta fallback
  return {
    title: meta.ogTitle || meta.title,
    description: meta.ogDescription || meta.description,
    images: [meta.ogImage, meta.twitterImage].filter(Boolean),
    source: "meta",
  };
}

function normalizeProductNode(node) {
  if (!node || typeof node !== "object") return null;

  // can be { "@graph": [...] }
  if (Array.isArray(node["@graph"])) {
    for (const g of node["@graph"]) {
      const r = normalizeProductNode(g);
      if (r) return r;
    }
  }

  const t = node["@type"];
  if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) {
    const title = cleanStr(node.name);
    const description = cleanStr(node.description);
    const brand = cleanStr(node.brand?.name || node.brand);
    const material = cleanStr(node.material);

    const images = [];
    if (typeof node.image === "string") images.push(node.image);
    else if (Array.isArray(node.image)) images.push(...node.image);

    let price = null, currency = null;
    const offers = node.offers;
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (offer && typeof offer === "object") {
      price = offer.price ?? offer.lowPrice ?? null;
      currency = offer.priceCurrency ?? null;
    }

    return {
      title,
      description,
      brand,
      material,
      images,
      price,
      currency,
    };
  }

  return null;
}

function normalizeFromNext(nextData) {
  if (!nextData || typeof nextData !== "object") return null;
  // Ini sengaja “best effort” karena struktur tiap site beda.
  // Kalau kamu kasih contoh HTML Zalora, aku bisa bikin extractor yang lebih spesifik.
  return null;
}

function inferBrandFromTitle(title) {
  if (!title) return "";
  // contoh: "Casella - Baju Koko ..." → brand Casella
  const parts = title.split(/[-|•]/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[0].length <= 30) return parts[0];
  return "";
}

function inferProductType(title, desc) {
  const t = (title + " " + (desc || "")).toLowerCase();
  const map = [
    ["baju koko", "Baju koko"],
    ["koko", "Baju koko"],
    ["hoodie", "Hoodie"],
    ["t-shirt", "T-shirt"],
    ["kaos", "Kaos"],
    ["kemeja", "Kemeja"],
    ["celana", "Celana"],
    ["jaket", "Jaket"],
    ["dress", "Dress"],
  ];
  for (const [k, v] of map) if (t.includes(k)) return v;
  return "";
}

function inferMaterial(title, desc) {
  const t = (title + " " + (desc || "")).toLowerCase();
  const map = [
    ["katun", "Katun"],
    ["cotton", "Katun"],
    ["linen", "Linen"],
    ["rayon", "Rayon"],
    ["polyester", "Polyester"],
    ["viscose", "Viscose"],
    ["denim", "Denim"],
  ];
  for (const [k, v] of map) if (t.includes(k)) return v;
  return "";
}

function safeJson(s) {
  try {
    const cleaned = s
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanStr(x) {
  if (!x) return "";
  return String(x).replace(/\s+/g, " ").trim();
}

function uniq(arr) {
  return [...new Set(arr)];
}
