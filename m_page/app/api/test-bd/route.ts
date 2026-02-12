/* Test con la base de datos */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.from("remittances").insert([
    {
      sender_wallet: "PayOnProofWallet1",
      origin_country: "CR",
      destination_country: "CO",
      amount: 100,
      status: "pending",
    },
  ]).select();

  if (error) {
    return NextResponse.json({ error });
  }

  return NextResponse.json({ inserted: data });
}
