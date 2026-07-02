import { randomBytes, randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export interface WebhookConfigRow {
  id: string;
  secret_key: string;
  webhook_id: string | null;
}

export function maskSecretKey(secret: string): string {
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 8)}***`;
}

export async function getWebhookConfig(): Promise<WebhookConfigRow | null> {
  const { data } = await supabase
    .from("webhook_config")
    .select("id, secret_key, webhook_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as WebhookConfigRow | null) ?? null;
}

export async function getWebhookSecret(): Promise<string | null> {
  const config = await getWebhookConfig();
  if (config?.secret_key) return config.secret_key;

  const fromEnv =
    process.env.FIVE_WEBHOOK_SECRET_ANTECIPADO?.trim() ||
    process.env.FIVE_WEBHOOK_SECRET_AGENDADO?.trim();
  return fromEnv || null;
}

export async function getWebhookId(): Promise<string | null> {
  const config = await getWebhookConfig();
  if (!config) return null;

  if (config.webhook_id) return config.webhook_id;

  const webhookId = randomUUID();
  const { error } = await supabase
    .from("webhook_config")
    .update({ webhook_id: webhookId, updated_at: new Date().toISOString() })
    .eq("id", config.id);

  if (error) throw new Error(error.message);
  return webhookId;
}

export function buildWebhookUrl(
  base: string,
  path: string,
  webhookId: string
): string {
  const normalizedBase = base.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}?id=${webhookId}`;
}

export type WebhookAuthMethod = "id" | "secret" | "header";

export type WebhookAuthResult =
  | { ok: true; method: WebhookAuthMethod }
  | { ok: false; error: string };

function resolveExpectedSecret(config: WebhookConfigRow | null): string | null {
  if (config?.secret_key) return config.secret_key;

  return (
    process.env.FIVE_WEBHOOK_SECRET_ANTECIPADO?.trim() ||
    process.env.FIVE_WEBHOOK_SECRET_AGENDADO?.trim() ||
    null
  );
}

export async function validateWebhookRequest(
  req: NextRequest
): Promise<WebhookAuthResult> {
  const webhookIdParam = (req.nextUrl.searchParams.get("id") ?? "").trim();
  const secretParam = (req.nextUrl.searchParams.get("secret") ?? "").trim();
  const headerSecret = (req.headers.get("X-Webhook-Secret") ?? "").trim();

  const config = await getWebhookConfig();
  const expectedSecret = resolveExpectedSecret(config);

  if (webhookIdParam) {
    const webhookId = config?.webhook_id ?? (await getWebhookId());
    if (webhookId && webhookId === webhookIdParam) {
      return { ok: true, method: "id" };
    }
    return { ok: false, error: "Webhook id inválido (?id=)." };
  }

  if (secretParam && expectedSecret && secretParam === expectedSecret) {
    return { ok: true, method: "secret" };
  }

  if (headerSecret && expectedSecret && headerSecret === expectedSecret) {
    return { ok: true, method: "header" };
  }

  if (!webhookIdParam && !secretParam && !headerSecret) {
    return { ok: false, error: "Autenticação ausente (?id= ou ?secret=)." };
  }

  return { ok: false, error: "Autenticação inválida." };
}

export async function hasWebhookAuthConfigured(): Promise<boolean> {
  const config = await getWebhookConfig();
  if (config?.webhook_id || config?.secret_key) return true;
  return Boolean(
    process.env.FIVE_WEBHOOK_SECRET_ANTECIPADO?.trim() ||
      process.env.FIVE_WEBHOOK_SECRET_AGENDADO?.trim()
  );
}

export async function regenerateWebhookSecret(): Promise<string> {
  const newSecret = randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  const existing = await getWebhookConfig();

  if (existing?.id) {
    const { error } = await supabase
      .from("webhook_config")
      .update({ secret_key: newSecret, updated_at: now })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("webhook_config").insert({
      secret_key: newSecret,
      webhook_id: randomUUID(),
      updated_at: now,
    });
    if (error) throw new Error(error.message);
  }

  return newSecret;
}

/** @deprecated Use validateWebhookRequest — mantido para retrocompatibilidade pontual */
export async function validateWebhookSecret(incoming: string): Promise<boolean> {
  const secret = await getWebhookSecret();
  if (!secret) return false;
  return incoming.trim() === secret;
}
