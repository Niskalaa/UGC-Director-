// api/netcheck.js
import { fetch as undiciFetch } from "undici";
const fetchFn = globalThis.fetch || undiciFetch;

export default async function handler(req, res) {
  try {
    const r = await fetchFn("https://api.openrouter.ai/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.OPENROUTER_REFERRER || "https://xklaa.vercel.app",
        "X-Title": process.env.OPENROUTER_APP_NAME || "UGC-Director"
      }
    });

    const text = await r.text();
    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      bodyPreview: text.slice(0, 200)
    });
  } catch (e) {
    // penting: tampilkan cause biar kelihatan DNS/TLS
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
      cause: String(e?.cause?.message || e?.cause || "")
    });
  }
}
