import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../lib/supabase";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("remittances")
      .insert([
        {
          sender_wallet: "PayOnProofWallet1",
          origin_country: "CR",
          destination_country: "CO",
          amount: 100,
          status: "pending",
        },
      ])
      .select();

    if (error) {
      return res.status(500).json({ error });
    }

    return res.status(200).json({ inserted: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
