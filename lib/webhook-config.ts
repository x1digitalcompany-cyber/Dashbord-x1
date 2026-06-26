import { randomBytes } from "crypto";
import { supabase } from "@/lib/supabase";

export function maskSecretKey(secret: string): string {
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 8)}***`;
}

export async function getWebhookSecret(): Promise<string | null> {
  const { data } = await supabase
    .from("webhook_config")
    .select("secret_key")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data?.secret_key) return data.secret_key;

  const fromEnv =
    process.env.FIVE_WEBHOOK_SECRET_ANTECIPADO?.trim() ||
    process.env.FIVE_WEBHOOK_SECRET_AGENDADO?.trim();
  return fromEnv || null;
}

export async function regenerateWebhookSecret(): Promise<string> {
  const newSecret = randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("webhook_config")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("webhook_config")
      .update({ secret_key: newSecret, updated_at: now })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("webhook_config")
      .insert({ secret_key: newSecret, updated_at: now });
    if (error) throw new Error(error.message);
  }

  return newSecret;
}

export async function validateWebhookSecret(incoming: string): Promise<boolean> {
  const secret = await getWebhookSecret();
  if (!secret) return false;
  return incoming.trim() === secret;
}
