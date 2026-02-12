import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;

  const { data, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ error: "Job not found" });
  return res.status(200).json(data);
}
