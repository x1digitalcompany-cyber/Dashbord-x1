"use client";

import { useState } from "react";
import { Settings, ShoppingCart, Megaphone } from "lucide-react";
import { PlataformasSettings } from "@/components/dashboard/PlataformasSettings";
import { MetaAdsConfigPanel } from "@/components/dashboard/MetaAdsConfigPanel";
import { cn } from "@/lib/utils";

type MainTab = "plataformas" | "meta";

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<MainTab>("plataformas");

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950">
            <Settings size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Configurações
            </h1>
            <p className="text-sm text-gray-400">
              Integrações de vendas e Meta Ads
            </p>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl border border-gray-200 p-1 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setTab("plataformas")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "plataformas"
                ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <ShoppingCart size={16} />
            Plataformas de Vendas
          </button>
          <button
            type="button"
            onClick={() => setTab("meta")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "meta"
                ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <Megaphone size={16} />
            Meta Ads
          </button>
        </div>
      </div>

      {tab === "plataformas" ? <PlataformasSettings /> : <MetaAdsConfigPanel />}
    </div>
  );
}
