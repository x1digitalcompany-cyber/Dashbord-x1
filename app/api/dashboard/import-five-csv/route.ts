import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";
import type { FivePaymentType } from "@/lib/five-webhook";
import {
  FIVE_CSV_MAX_BYTES,
  processFiveCsvRows,
  validateFiveCsvContent,
} from "@/lib/five-csv-import";

export const runtime = "nodejs";
export const maxDuration = 60;

function resolvePaymentType(raw: FormDataEntryValue | null): FivePaymentType | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "antecipado" || value === "agendado") return value;
  return null;
}

export async function POST(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });
  }

  const file = formData.get("file");
  const paymentType = resolvePaymentType(formData.get("payment_type"));

  if (!paymentType) {
    return NextResponse.json(
      { error: "Selecione o tipo de operação: antecipado ou agendado." },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo CSV não enviado." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      { error: "O arquivo deve ter extensão .csv" },
      { status: 400 }
    );
  }

  if (file.size > FIVE_CSV_MAX_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Tamanho máximo: 10MB." },
      { status: 400 }
    );
  }

  const csvText = await file.text();
  const validation = validateFiveCsvContent(csvText);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  if (validation.rows.length === 0) {
    return NextResponse.json(
      { error: "O CSV não contém linhas para importar." },
      { status: 400 }
    );
  }

  try {
    const summary = await processFiveCsvRows(
      supabase,
      validation.rows,
      paymentType
    );
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao importar CSV";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
