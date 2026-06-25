import type { NextRequest } from "next/server";
import {
  fiveWebhookGet,
  fiveWebhookHead,
  fiveWebhookOptions,
  processFiveWebhookPost,
} from "@/lib/five-webhook-process";

export const OPTIONS = fiveWebhookOptions;
export const HEAD = fiveWebhookHead;

export async function GET() {
  return fiveWebhookGet("agendado", "/api/webhooks/five/agendado");
}

export async function POST(req: NextRequest) {
  return processFiveWebhookPost(req, "agendado");
}
