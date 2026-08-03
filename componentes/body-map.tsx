import React, { useEffect, useRef } from "react";

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
  if (key.includes("espald") || key.includes("esp")) return "back";
  if (key.includes("hombro") || key.includes("hombros")) return "shoulders";
  if (key.includes("biceps") || key.includes("biceps")) return "biceps";
  if (key.includes("triceps") || key.includes("tricep")) return "triceps";
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKey);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
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

  const upperZones = ["chest", "back", "shoulders", "biceps", "triceps", "core"];
  const lowerZones = ["glutes", "quad", "hamstring", "adductors", "calves"];

  const upperSeries = Object.entries(mapped).filter(([k]) => upperZones.includes(k)).reduce((s, [,v]) => s+v,0);
  const lowerSeries = Object.entries(mapped).filter(([k]) => lowerZones.includes(k)).reduce((s, [,v]) => s+v,0);

  const upperPct = totalSeries ? Math.round((upperSeries / totalSeries) * 100) : 0;
  const lowerPct = totalSeries ? Math.round((lowerSeries / totalSeries) * 100) : 0;

  const zoneColor = (zone: string) => intensityColor(mapped[zone] || 0, maxSeries);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4 sm:px-6 sm:py-10" ref={modalRef} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-hidden rounded-3xl bg-gradient-to-b from-[#0f0f0f] to-[#050505] shadow-2xl border border-zinc-800/50 flex flex-col" ref={contentRef}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 flex items-center justify-center w-11 h-11 rounded-lg bg-black/60 border border-zinc-700/50 hover:border-amber-400/60 transition-colors text-zinc-300 hover:text-amber-300 font-bold text-lg"
          aria-label="Cerrar mapa corporal"
          type="button"
        >
          ✕
        </button>

        <div className="overflow-y-auto flex-1 px-4 py-4 sm:px-6 sm:py-5">
          <h3 id="modal-title" className="text-lg sm:text-xl font-bold text-amber-300">Mapa corporal semanal</h3>

          <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-4 sm:flex sm:gap-6 sm:items-center">
            <div className="text-sm text-zinc-300">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Tren superior</div>
              <div className="text-xl sm:text-2xl font-bold text-zinc-100">{upperPct}%</div>
            </div>
            <div className="text-sm text-zinc-300">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Tren inferior</div>
              <div className="text-xl sm:text-2xl font-bold text-zinc-100">{lowerPct}%</div>
            </div>
            {totalSeries > 0 && (
              <div className="col-span-2 sm:col-span-1 text-xs text-zinc-500">
                Máx. referencia: <span className="text-amber-400 font-semibold">{maxSeries}</span> series
              </div>
            )}
          </div>

          <div className="mt-5 sm:mt-6 grid grid-cols-1 gap-6">
            <div className="flex flex-col items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Vista Frontal</h4>
              <svg viewBox="0 0 240 500" className="w-full max-w-xs h-auto aspect-[3/5]" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa corporal frontal">
                <defs>
                  <linearGradient id="frontGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1a1a1a" />
                    <stop offset="100%" stopColor="#0d0d0d" />
                  </linearGradient>
                </defs>

                {/* Head */}
                <circle cx="120" cy="35" r="20" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.5" />

                {/* Shoulders - upper body frame */}
                <ellipse cx="75" cy="60" rx="18" ry="24" fill={zoneColor("shoulders")} stroke="#8b7621" strokeWidth="1.5"/>
                <ellipse cx="165" cy="60" rx="18" ry="24" fill={zoneColor("shoulders")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Chest */}
                <path d="M 90 65 Q 120 55 150 65 L 150 110 Q 120 115 90 110 Z" fill={zoneColor("chest")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Biceps Left */}
                <rect x="50" y="70" width="20" height="60" rx="10" fill={zoneColor("biceps")} stroke="#8b7621" strokeWidth="1.5"/>
                {/* Triceps Left (back area) */}
                <ellipse cx="120" cy="95" rx="8" ry="20" fill={zoneColor("triceps")} stroke="#8b7621" strokeWidth="1"/>

                {/* Biceps Right */}
                <rect x="170" y="70" width="20" height="60" rx="10" fill={zoneColor("biceps")} stroke="#8b7621" strokeWidth="1.5"/>
                {/* Triceps Right (back area) */}
                <ellipse cx="120" cy="95" rx="8" ry="20" fill={zoneColor("triceps")} stroke="#8b7621" strokeWidth="1"/>

                {/* Core/Abdomen */}
                <path d="M 95 115 L 145 115 L 145 165 Q 120 175 95 165 Z" fill={zoneColor("core")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Quads Left */}
                <path d="M 80 165 Q 75 200 80 260 L 100 270 Q 100 210 95 165 Z" fill={zoneColor("quad")} stroke="#8b7621" strokeWidth="1.5"/>
                {/* Quads Right */}
                <path d="M 160 165 Q 165 200 160 260 L 140 270 Q 140 210 145 165 Z" fill={zoneColor("quad")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Adductors Left (inner) */}
                <ellipse cx="85" cy="210" rx="8" ry="35" fill={zoneColor("adductors")} stroke="#8b7621" strokeWidth="1.5"/>
                {/* Adductors Right (inner) */}
                <ellipse cx="155" cy="210" rx="8" ry="35" fill={zoneColor("adductors")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Calves Left */}
                <path d="M 80 270 Q 75 310 85 360 L 100 360 Q 95 310 100 270 Z" fill={zoneColor("calves")} stroke="#8b7621" strokeWidth="1.5"/>
                {/* Calves Right */}
                <path d="M 160 270 Q 165 310 155 360 L 140 360 Q 145 310 140 270 Z" fill={zoneColor("calves")} stroke="#8b7621" strokeWidth="1.5"/>
              </svg>
            </div>

            <div className="flex flex-col items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Vista Posterior</h4>
              <svg viewBox="0 0 240 500" className="w-full max-w-xs h-auto aspect-[3/5]" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa corporal posterior">
                <defs>
                  <linearGradient id="backGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#151515" />
                    <stop offset="100%" stopColor="#0a0a0a" />
                  </linearGradient>
                </defs>

                {/* Head */}
                <circle cx="120" cy="35" r="20" fill="#151515" stroke="#d4af37" strokeWidth="0.5" />

                {/* Shoulders - upper back */}
                <ellipse cx="75" cy="60" rx="18" ry="24" fill={zoneColor("shoulders")} stroke="#8b7621" strokeWidth="1.5"/>
                <ellipse cx="165" cy="60" rx="18" ry="24" fill={zoneColor("shoulders")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Upper Back */}
                <path d="M 95 65 Q 120 55 145 65 L 145 115 Q 120 120 95 115 Z" fill={zoneColor("back")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Lower Back (upper glutes region) */}
                <ellipse cx="120" cy="145" rx="35" ry="25" fill={zoneColor("back")} stroke="#8b7621" strokeWidth="1"/>

                {/* Glutes */}
                <ellipse cx="120" cy="180" rx="40" ry="32" fill={zoneColor("glutes")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Hamstrings Left */}
                <path d="M 85 210 Q 78 250 82 310 L 100 320 Q 100 260 100 210 Z" fill={zoneColor("hamstring")} stroke="#8b7621" strokeWidth="1.5"/>
                {/* Hamstrings Right */}
                <path d="M 155 210 Q 162 250 158 310 L 140 320 Q 140 260 140 210 Z" fill={zoneColor("hamstring")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Calves Left */}
                <path d="M 82 320 Q 75 350 80 410 L 95 410 Q 95 360 100 320 Z" fill={zoneColor("calves")} stroke="#8b7621" strokeWidth="1.5"/>
                {/* Calves Right */}
                <path d="M 158 320 Q 165 350 160 410 L 145 410 Q 145 360 140 320 Z" fill={zoneColor("calves")} stroke="#8b7621" strokeWidth="1.5"/>

                {/* Triceps Left arm (extended view) */}
                <rect x="50" y="70" width="18" height="65" rx="9" fill={zoneColor("triceps")} stroke="#8b7621" strokeWidth="1.5"/>
                {/* Triceps Right arm */}
                <rect x="172" y="70" width="18" height="65" rx="9" fill={zoneColor("triceps")} stroke="#8b7621" strokeWidth="1.5"/>
              </svg>
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
        </div>
      </div>
    </div>
  );
}
