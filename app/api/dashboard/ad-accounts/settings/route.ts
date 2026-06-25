import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { getMetaApiVersion, setMetaApiVersion } from "@/lib/meta-account";

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const apiVersion = await getMetaApiVersion();
  return NextResponse.json({ apiVersion });
}

export async function PATCH(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const apiVersion = String(body.apiVersion ?? "").trim();
    if (!apiVersion) {
      return NextResponse.json({ error: "Informe a versão da API." }, { status: 400 });
    }

    const result = await setMetaApiVersion(apiVersion);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      apiVersion: apiVersion.replace(/^v?/, "v"),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao salvar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
