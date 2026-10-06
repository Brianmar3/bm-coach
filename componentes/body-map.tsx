import React, { useEffect, useRef, useState } from "react";
import { BodyMapFigure, type BodyMapView } from "./body-map-figure";

export type WeeklyItem = { muscleGroup: string; series: number; percentage: number };

function normalizeKey(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

export function mapMuscleToZone(muscle: string) {
  const key = normalizeKey(muscle);
  if (key.includes("glute") || key.includes("gluteos")) return "glutes";
  if (key.includes("cuadriceps") || key.includes("cuadri")) return "quad";
  if (key.includes("isquios") || key.includes("isqui") || key.includes("isquiot")) return "hamstring";
  if (key.includes("aduct") || key.includes("aductores")) return "adductors";
  if (key.includes("gemel") || key.includes("pantorr")) return "calves";
  if (key.includes("pech") || key.includes("pecho")) return "chest";
  if (key.includes("espald") || key.includes("dorsal") || key.includes("lumb")) return "back";
  if (key.includes("hombro") || key.includes("hombros")) return "shoulders";
  if (key.includes("biceps") || key.includes("biceps")) return "biceps";
  if (key.includes("triceps") || key.includes("tricep")) return "triceps";
  if (key.includes("antebra") || key.includes("braquiorradial")) return "forearms";
  if (key.includes("core") || key.includes("abdomen") || key.includes("abdom")) return "core";
  return "other";
}

export function intensityColor(series: number, maxSeries: number) {
  if (maxSeries <= 0) return "#3a3a3a"; // neutral
  const ratio = series / maxSeries;
  if (series === 0) return "#3a3a3a"; // dark gray
  if (ratio <= 0.33) return "#f6e58d"; // soft yellow
  if (ratio <= 0.66) return "#d4af37"; // dorado
  return "#ff9f1c"; // orange/dorado intenso
}

export default function BodyMapModal({
  open,
  onClose,
  weekly,
}: {
  open: boolean;
  onClose: () => void;
  weekly: WeeklyItem[];
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<BodyMapView>("front");

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const mapped = weekly.reduce<Record<string, number>>((acc, item) => {
    const zone = mapMuscleToZone(item.muscleGroup);
    acc[zone] = (acc[zone] || 0) + item.series;
    return acc;
  }, {});

  const maxSeries = Math.max(0, ...Object.values(mapped));
  const totalSeries = weekly.reduce((s, i) => s + i.series, 0);

  const upperZones = ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "core"];
  const lowerZones = ["glutes", "quad", "hamstring", "adductors", "calves"];

  const upperSeries = Object.entries(mapped).filter(([k]) => upperZones.includes(k)).reduce((s, [,v]) => s+v,0);
  const lowerSeries = Object.entries(mapped).filter(([k]) => lowerZones.includes(k)).reduce((s, [,v]) => s+v,0);

  const upperPct = totalSeries ? Math.round((upperSeries / totalSeries) * 100) : 0;
  const lowerPct = totalSeries ? Math.round((lowerSeries / totalSeries) * 100) : 0;

  const zoneColor = (zone: string) => intensityColor(mapped[zone] || 0, maxSeries);
  const zoneSeries = (zone: string) => mapped[zone] || 0;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4 sm:px-6 sm:py-10" ref={modalRef} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="body-map-dialog relative w-full max-w-2xl max-h-[90dvh] overflow-hidden rounded-3xl bg-gradient-to-b from-[#0f0f0f] to-[#050505] shadow-2xl border border-zinc-800/50 flex flex-col" ref={contentRef}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 flex items-center justify-center w-11 h-11 rounded-lg bg-black/60 border border-zinc-700/50 hover:border-amber-400/60 transition-colors text-zinc-300 hover:text-amber-300 font-bold text-lg"
          aria-label="Cerrar mapa corporal"
          type="button"
        >
          ✕
        </button>

        <div className="overflow-y-auto flex-1 px-4 py-4 sm:px-6 sm:py-5">
          <h3 id="modal-title" className="pr-14 text-lg sm:text-xl font-bold text-amber-300">Mapa corporal semanal</h3>

          <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-4 sm:flex sm:gap-6 sm:items-center">
            <div className="text-sm text-zinc-300">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Tren superior</div>
              <div className="text-xl sm:text-2xl font-bold text-zinc-100">{upperPct}%</div>
            </div>
            <div className="text-sm text-zinc-300">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Tren inferior</div>
              <div className="text-xl sm:text-2xl font-bold text-zinc-100">{lowerPct}%</div>
            </div>
            <div className="col-span-2 sm:col-span-1 text-xs text-zinc-500">
              Máx. referencia: <span className="text-amber-400 font-semibold">{maxSeries}</span> series
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-amber-400/15 bg-black/40 p-1" role="tablist" aria-label="Vista del mapa corporal">
            <button type="button" role="tab" aria-selected={view === "front"} onClick={() => setView("front")} className={"min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors " + (view === "front" ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/35" : "text-zinc-400 hover:text-zinc-100")}>Vista anterior</button>
            <button type="button" role="tab" aria-selected={view === "back"} onClick={() => setView("back")} className={"min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors " + (view === "back" ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/35" : "text-zinc-400 hover:text-zinc-100")}>Vista posterior</button>
          </div>
          <div className="mt-3 flex min-h-[320px] items-center justify-center rounded-2xl border border-amber-400/10 bg-[radial-gradient(ellipse_at_50%_40%,rgba(131,101,39,0.12),transparent_65%)]">
            <div className="h-[min(55dvh,500px)] min-h-[320px] w-full max-w-[340px]">
              <BodyMapFigure view={view} zoneColor={zoneColor} zoneSeries={zoneSeries} />
            </div>
          </div>

          <div className="mt-6 sm:mt-8 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Leyenda de volumen</p>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-zinc-700" style={{ backgroundColor: '#3a3a3a' }} />
                <span className="text-zinc-400">Sin series</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-zinc-700" style={{ backgroundColor: '#f6e58d' }} />
                <span className="text-zinc-400">Bajo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-zinc-700" style={{ backgroundColor: '#d4af37' }} />
                <span className="text-zinc-400">Medio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-zinc-700" style={{ backgroundColor: '#ff9f1c' }} />
                <span className="text-zinc-400">Alto</span>
              </div>
            </div>
          </div>
          <section className="mt-5 border-t border-amber-400/10 pt-4" aria-labelledby="body-map-distribution-title">
            <h4 id="body-map-distribution-title" className="text-xs font-bold uppercase tracking-[.14em] text-amber-300">Distribución semanal</h4>
            <p className="mt-1 text-xs text-zinc-500">Series configuradas por grupo muscular.</p>
            {weekly.length ? <div className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">{weekly.map((item) => <div key={item.muscleGroup} className="min-w-0"><div className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-zinc-200">{item.muscleGroup}</span><span className="shrink-0 text-zinc-400">{item.series} · {Math.round(item.percentage)}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${item.percentage}%` }} /></div></div>)}</div> : <p className="mt-3 text-sm text-zinc-500">No hay series configuradas.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
