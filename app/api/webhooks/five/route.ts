import type { NextRequest } from "next/server";
import {
  fiveWebhookGet,
  fiveWebhookHead,
  fiveWebhookOptions,
  processFiveWebhookPost,
} from "@/lib/five-webhook-process";

/** Legado — trata como Five Antecipada sem validação de secret. */
export const OPTIONS = fiveWebhookOptions;
export const HEAD = fiveWebhookHead;

export async function GET() {
  return fiveWebhookGet("antecipado", "/api/webhooks/five");
}

export async function POST(req: NextRequest) {
  return processFiveWebhookPost(req, "antecipado", { skipSecret: true });
}
