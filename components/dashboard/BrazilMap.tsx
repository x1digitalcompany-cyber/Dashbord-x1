"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { scaleSequential } from "d3-scale";
import { rgb } from "d3-color";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrazilMapProps {
  data: { uf: string; value: number; label: string }[];
  colorScale: "purple" | "red";
  title: string;
  tooltipFormatter: (uf: string, value: number) => string;
}

interface GeoFeature {
  type: string;
  properties: Record<string, string>;
  geometry: unknown;
}

interface GeoData {
  type: string;
  features: GeoFeature[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WIDTH  = 800;
const HEIGHT = 600;

const END_COLORS = {
  purple: rgb(109, 40, 217),  // #6d28d9
  red:    rgb(220, 38, 38),   // #dc2626
} as const;

const NEUTRAL = "#e5e7eb";

function getUf(props: Record<string, string>): string | null {
  const sigla = props.sigla ?? props.UF ?? props.uf;
  if (sigla?.length === 2) return sigla.toUpperCase();
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrazilMap({ data, colorScale, title, tooltipFormatter }: BrazilMapProps) {
  const [geo, setGeo]       = useState<GeoData | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [tooltip, setTooltip]   = useState<{
    x: number; y: number; uf: string; value: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch GeoJSON from public/ (static, no external dep) ─────────────────
  useEffect(() => {
    let cancelled = false;
    fetch("/brazil-states.geojson")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: GeoData) => { if (!cancelled) setGeo(d); })
      .catch(() => { if (!cancelled) setGeoError(true); });
    return () => { cancelled = true; };
  }, []);

  // ── Data map & scale ──────────────────────────────────────────────────────
  const dataMap = useMemo(
    () => new Map(data.map((d) => [d.uf, d.value])),
    [data]
  );

  const maxValue = useMemo(
    () => Math.max(...data.map((d) => d.value), 1),
    [data]
  );

  const colorFn = useMemo(() => {
    const end   = END_COLORS[colorScale];
    const start = rgb(255, 255, 255);
    return scaleSequential((t: number) => {
      const c = start.copy();
      c.r = Math.round(start.r + t * (end.r - start.r));
      c.g = Math.round(start.g + t * (end.g - start.g));
      c.b = Math.round(start.b + t * (end.b - start.b));
      return c.toString();
    }).domain([0, maxValue]);
  }, [colorScale, maxValue]);

  // ── Projection & path generator ───────────────────────────────────────────
  const pathGen = useMemo(() => {
    const proj = geoMercator()
      .center([-54, -15])
      .scale(850)
      .translate([WIDTH / 2, HEIGHT / 2]);
    return geoPath(proj);
  }, []);

  // ── Legend samples ────────────────────────────────────────────────────────
  const legendSamples = [0, 0.25, 0.5, 0.75, 1];

  // ── Mouse handlers ────────────────────────────────────────────────────────
  function handleMouseEnter(e: React.MouseEvent, uf: string) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x:     e.clientX - rect.left,
      y:     e.clientY - rect.top,
      uf,
      value: dataMap.get(uf) ?? 0,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (geoError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-500">
        Não foi possível carregar o mapa do Brasil.
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h3>

      {!geo ? (
        <Skeleton className="h-[420px] w-full rounded-xl" />
      ) : (
        <div
          ref={containerRef}
          className="relative"
          onMouseLeave={() => setTooltip(null)}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width="100%"
            className="overflow-visible"
            aria-label={title}
          >
            {geo.features.map((feature, i) => {
              const uf    = getUf(feature.properties);
              const value = uf ? (dataMap.get(uf) ?? 0) : 0;
              const fill  = uf && dataMap.has(uf) ? colorFn(value) : NEUTRAL;
              const d     = pathGen(
                feature as unknown as Parameters<typeof pathGen>[0]
              );
              if (!d) return null;
              return (
                <path
                  key={i}
                  d={d}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={0.8}
                  className="cursor-pointer transition-opacity hover:opacity-75"
                  onMouseEnter={uf ? (e) => handleMouseEnter(e, uf) : undefined}
                />
              );
            })}
          </svg>

          {tooltip && (
            <div
              className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={{
                left:      tooltip.x + 12,
                top:       tooltip.y - 10,
                transform: "translateY(-100%)",
              }}
            >
              {tooltipFormatter(tooltip.uf, tooltip.value)}
            </div>
          )}
        </div>
      )}

      {/* Legenda */}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <span>0</span>
        <div className="flex flex-1 overflow-hidden rounded-full">
          {legendSamples.map((t) => (
            <div
              key={t}
              className="h-2 flex-1"
              style={{ background: colorFn(t * maxValue) }}
            />
          ))}
        </div>
        <span>{maxValue.toLocaleString("pt-BR")}</span>
      </div>
    </div>
  );
}
