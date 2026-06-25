"use client";

import { Settings } from "lucide-react";
import { MetaAdsSettings } from "@/components/dashboard/MetaAdsSettings";
import { WebhooksSettings } from "@/components/dashboard/WebhooksSettings";

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950">
            <Settings size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Configurações
            </h1>
            <p className="text-sm text-gray-400">
              Integrações e preferências do painel
            </p>
          </div>
        </div>
      </div>

      <WebhooksSettings />
      <MetaAdsSettings />
    </div>
  );
}
