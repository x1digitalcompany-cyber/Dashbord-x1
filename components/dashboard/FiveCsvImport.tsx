"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { cn } from "@/lib/utils";

interface ImportSummary {
  criados: number;
  atualizados: number;
  ignorados_teste: number;
  erros: { linha: number; id?: string; mensagem: string }[];
  total: number;
}

export function FiveCsvImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [paymentType, setPaymentType] = useState<"antecipado" | "agendado">(
    "antecipado"
  );
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setSummary(null);
    setError(null);
  }

  async function handleImport() {
    if (!file) {
      setError("Selecione um arquivo CSV.");
      return;
    }

    setImporting(true);
    setError(null);
    setSummary(null);
    setProgress("Enviando arquivo…");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("payment_type", paymentType);

      setProgress("Processando importação…");

      const res = await fetch("/api/dashboard/import-five-csv", {
        method: "POST",
        body: formData,
      });

      const json = await parseJsonResponse<ImportSummary & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Falha na importação");

      setSummary(json);
      setProgress(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao importar");
      setProgress(null);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950">
          <Upload size={20} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Importar Relatório Five
          </h2>
          <p className="text-sm text-gray-400">
            Use isso se o webhook falhar ou para sincronizar pedidos antigos.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
          >
            <FileUp size={16} />
            Selecionar arquivo CSV
          </button>
          {file && (
            <p className="mt-2 text-xs text-gray-500">
              Arquivo: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Tipo de operação dos pedidos novos:
          </p>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="radio"
                name="five-csv-payment-type"
                value="antecipado"
                checked={paymentType === "antecipado"}
                onChange={() => setPaymentType("antecipado")}
                disabled={importing}
              />
              Antecipado
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="radio"
                name="five-csv-payment-type"
                value="agendado"
                checked={paymentType === "agendado"}
                onChange={() => setPaymentType("agendado")}
                disabled={importing}
              />
              Agendado
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={handleImport}
          disabled={importing || !file}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          )}
        >
          {importing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Importando…
            </>
          ) : (
            "Importar"
          )}
        </button>

        {progress && (
          <p className="text-sm text-gray-500">{progress}</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {summary && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <p className="mb-2 font-semibold">Importação concluída</p>
            <ul className="space-y-1">
              <li>{summary.criados} pedidos novos criados</li>
              <li>{summary.atualizados} pedidos atualizados</li>
              <li>{summary.ignorados_teste} pedidos de teste ignorados</li>
              <li>{summary.erros.length} pedidos com erro</li>
            </ul>
            {summary.erros.length > 0 && (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-red-700 dark:text-red-300">
                {summary.erros.map((err) => (
                  <li key={`${err.linha}-${err.id ?? ""}`}>
                    Linha {err.linha}
                    {err.id ? ` (${err.id})` : ""}: {err.mensagem}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
