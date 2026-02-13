// api/test-upload.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // file kecil untuk test
    const content = `hello supabase storage ${new Date().toISOString()}\n`;
    const buffer = Buffer.from(content, "utf8");

    const path = `test/test-${Date.now()}.txt`;

    const { error: upErr } = await supabase.storage
      .from("generations")
      .upload(path, buffer, {
        contentType: "text/plain",
        upsert: true
      });

    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);

    return res.status(200).json({
      ok: true,
      path,
      publicUrl: pub.publicUrl
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
