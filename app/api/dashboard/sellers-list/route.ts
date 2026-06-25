import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("sellers")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar vendedores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
