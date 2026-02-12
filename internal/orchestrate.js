// internal/orchestrate.js
import { GoogleGenAI } from "@google/genai";

/**
 * Orchestrator: ubah brief user jadi prompt image/video yang rapi.
 * Return selalu JSON: { image: {...}, video: {...} } tergantung type.
 */
export async function orchestrate({ type, brief }) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const system = `
You are a production prompt-orchestrator for image/video generation.
Output MUST be valid JSON only (no markdown, no code fences).
Return schema exactly:

{
  "image": {
    "prompt": "string",
    "negative": "string",
    "params": {
      "aspect_ratio": "1:1|9:16|16:9|4:5",
      "style": "photorealistic",
      "notes": "string"
    }
  },
  "video": {
    "prompt": "string",
    "negative": "string",
    "params": {
      "aspect_ratio": "9:16|16:9",
      "duration_seconds": 6,
      "fps": 12,
      "notes": "string"
    }
  }
}

Rules:
- Prompts must be highly detailed, realistic, natural. Avoid contradictions.
- Negative prompts must prevent: blurry, lowres, watermark, text artifacts, extra limbs/fingers, distorted face, AI look.
- If type is "image", you may omit "video" or set it to null.
- If type is "video", you may omit "image" or set it to null.
- If type is "both", return both.
`;

  const user = `TYPE: ${type}\nBRIEF:\n${brief}`;

  // pakai model Gemini terbaru yang tersedia untuk text
  const resp = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      { role: "user", parts: [{ text: system }, { text: user }] }
    ],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 1200
    }
  });

  const text = resp?.text?.trim?.() || "";
  // Pastikan parse JSON
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    // fallback: coba ambil substring JSON kalau model “nyelip”
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Gemini returned non-JSON output");
    json = JSON.parse(text.slice(start, end + 1));
  }

  return json;
}
