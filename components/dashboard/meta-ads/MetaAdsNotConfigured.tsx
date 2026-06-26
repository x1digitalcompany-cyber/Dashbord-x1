"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";

export function MetaAdsNotConfigured() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <Megaphone className="mt-0.5 shrink-0 text-amber-600" size={22} />
        <div>
          <h3 className="font-semibold text-amber-900 dark:text-amber-100">
            Conecte sua conta do Meta Ads
          </h3>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            Para ver gasto, impressões, leads e campanhas, configure o Account ID e o Access Token
            em Configurações → Meta Ads.
          </p>
          <Link
            href="/configuracoes"
            className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Ir para Configurações
          </Link>
        </div>
      </div>
    </div>
  );
}
