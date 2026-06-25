"use client";

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { EstadoMetric } from "@/types";

const GEO_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

const NAME_TO_UF: Record<string, string> = {
  Acre: "AC",
  Alagoas: "AL",
  Amapá: "AP",
  Amazonas: "AM",
  Bahia: "BA",
  Ceará: "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  Goiás: "GO",
  Maranhão: "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  Pará: "PA",
  Paraíba: "PB",
  Paraná: "PR",
  Pernambuco: "PE",
  Piauí: "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  Rondônia: "RO",
  Roraima: "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  Sergipe: "SE",
  Tocantins: "TO",
};

type ColorMode = "vendas" | "inadimplencia";

interface BrazilChoroplethMapProps {
  data: EstadoMetric[];
  mode: ColorMode;
  title: string;
  className?: string;
}

function getUfFromGeo(props: Record<string, string>): string | null {
  const sigla = props.sigla || props.UF || props.uf;
  if (sigla && sigla.length === 2) return sigla.toUpperCase();
  const name = props.name || props.nome || props.NOME;
  if (name && NAME_TO_UF[name]) return NAME_TO_UF[name];
  return null;
}

function interpolateColor(t: number, mode: ColorMode): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (mode === "vendas") {
    const r = Math.round(255 - clamped * (255 - 99));
    const g = Math.round(255 - clamped * (255 - 102));
    const b = Math.round(255 - clamped * (255 - 241));
    return `rgb(${r},${g},${b})`;
  }
  const r = Math.round(255 - clamped * 55);
  const g = Math.round(255 - clamped * 200);
  const b = Math.round(255 - clamped * 200);
  return `rgb(${r},${g},${b})`;
}

export function BrazilChoroplethMap({
  data,
  mode,
  title,
  className,
}: BrazilChoroplethMapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    uf: string;
    metric: EstadoMetric;
  } | null>(null);

  const dataMap = useMemo(
    () => new Map(data.map((d) => [d.uf, d])),
    [data]
  );

  const maxValue = useMemo(() => {
    if (!data.length) return 1;
    if (mode === "vendas") return Math.max(...data.map((d) => d.vendas), 1);
    return Math.max(...data.map((d) => d.taxa_inadimplencia), 1);
  }, [data, mode]);

  function fillForUf(uf: string | null): string {
    if (!uf) return "#f3f4f6";
    const metric = dataMap.get(uf);
    if (!metric) return "#f9fafb";
    const value =
      mode === "vendas" ? metric.vendas : metric.taxa_inadimplencia;
    return interpolateColor(value / maxValue, mode);
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950",
        className
      )}
    >
      <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>

      <div className="relative w-full" style={{ height: 420 }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 700, center: [-54, -15] }}
          width={800}
          height={420}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup center={[-54, -15]} zoom={1}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const uf = getUfFromGeo(geo.properties as Record<string, string>);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fillForUf(uf)}
                      stroke="#e5e7eb"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: "#6366f1", cursor: "pointer" },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={(e) => {
                        if (!uf) return;
                        const metric = dataMap.get(uf);
                        if (!metric) return;
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          uf,
                          metric,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900"
            style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {tooltip.uf}
            </p>
            {mode === "vendas" ? (
              <>
                <p>Vendas: {formatNumber(tooltip.metric.vendas)}</p>
                <p>Faturamento: {formatCurrency(tooltip.metric.faturamento)}</p>
              </>
            ) : (
              <>
                <p>Inadimplentes: {formatNumber(tooltip.metric.inadimplentes)}</p>
                <p>Valor: {formatCurrency(tooltip.metric.valor_inadimplente)}</p>
                <p>Taxa: {tooltip.metric.taxa_inadimplencia.toFixed(1)}%</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <span>Menor</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background:
              mode === "vendas"
                ? "linear-gradient(to right, #ffffff, #6366f1)"
                : "linear-gradient(to right, #ffffff, #ef4444)",
          }}
        />
        <span>Maior</span>
      </div>
    </div>
  );
}
