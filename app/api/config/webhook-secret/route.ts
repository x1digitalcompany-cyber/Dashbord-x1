import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import {
  getWebhookSecret,
  maskSecretKey,
  regenerateWebhookSecret,
} from "@/lib/webhook-config";

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const secret = await getWebhookSecret();
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;

  return NextResponse.json({
    secretConfigured: Boolean(secret),
    secretMasked: secret ? maskSecretKey(secret) : null,
    secretKey: secret,
    urls: secret
      ? {
          fiveAntecipado: `${base}/api/webhooks/five/antecipado?secret=${secret}`,
          fiveAgendado: `${base}/api/webhooks/five/agendado?secret=${secret}`,
          payt: `${base}/api/webhooks/payt?secret=${secret}`,
          braip: `${base}/api/webhooks/braip?secret=${secret}`,
          x1company: `${base}/api/webhooks/x1company?secret=${secret}`,
        }
      : null,
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

    return NextResponse.json({
      ok: true,
      secretMasked: maskSecretKey(newSecret),
      secretKey: newSecret,
      urls: {
        fiveAntecipado: `${base}/api/webhooks/five/antecipado?secret=${newSecret}`,
        fiveAgendado: `${base}/api/webhooks/five/agendado?secret=${newSecret}`,
        payt: `${base}/api/webhooks/payt?secret=${newSecret}`,
        braip: `${base}/api/webhooks/braip?secret=${newSecret}`,
        x1company: `${base}/api/webhooks/x1company?secret=${newSecret}`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao regenerar chave";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
