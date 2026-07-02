import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import {
  buildWebhookUrl,
  getWebhookId,
  getWebhookSecret,
  maskSecretKey,
  regenerateWebhookSecret,
} from "@/lib/webhook-config";

async function buildUrls(base: string) {
  const webhookId = await getWebhookId();
  if (!webhookId) return null;

  return {
    fiveAntecipado: buildWebhookUrl(base, "/api/webhooks/five/antecipado", webhookId),
    fiveAgendado: buildWebhookUrl(base, "/api/webhooks/five/agendado", webhookId),
    payt: buildWebhookUrl(base, "/api/webhooks/payt", webhookId),
    braip: buildWebhookUrl(base, "/api/webhooks/braip", webhookId),
    x1company: buildWebhookUrl(base, "/api/webhooks/x1company", webhookId),
  };
}

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const secret = await getWebhookSecret();
  const webhookId = await getWebhookId();
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;

  return NextResponse.json({
    secretConfigured: Boolean(secret),
    secretMasked: secret ? maskSecretKey(secret) : null,
    webhookId,
    urls: await buildUrls(base),
  });
}

export async function POST(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const newSecret = await regenerateWebhookSecret();
    const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
    const webhookId = await getWebhookId();

    return NextResponse.json({
      ok: true,
      secretMasked: maskSecretKey(newSecret),
      webhookId,
      urls: await buildUrls(base),
      message:
        "A chave interna foi renovada. As URLs dos webhooks não mudaram.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao regenerar chave";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
