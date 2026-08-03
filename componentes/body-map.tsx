import React, { useEffect } from "react";

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
  if (maxSeries <= 0) return "#2a2a2a"; // neutral
  const ratio = series / maxSeries;
  if (series === 0) return "#2a2a2a"; // dark gray
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

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65" onClick={onClose} aria-hidden />
      <div className="relative mx-4 w-full max-w-4xl rounded-2xl bg-gradient-to-b from-[#0b0b0b] to-[#070707] p-5 shadow-2xl">
        <button aria-label="Cerrar" onClick={onClose} className="absolute right-3 top-3 rounded-md bg-zinc-800/40 px-2 py-1 text-sm text-zinc-300">✕</button>
        <h3 className="text-lg font-bold text-yellow-300">Mapa corporal semanal</h3>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-zinc-300">
            <div>Tren superior: <span className="font-semibold text-zinc-100">{upperPct}%</span></div>
            <div>Tren inferior: <span className="font-semibold text-zinc-100">{lowerPct}%</span></div>
          </div>
          <div className="text-xs text-zinc-400">Serie máxima de referencia: {maxSeries} series</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Frontal */}
          <div className="flex flex-col items-center justify-center">
            <div className="mb-2 text-sm font-semibold text-zinc-200">Frontal</div>
            <svg viewBox="0 0 300 600" className="h-[420px] w-full max-w-[320px]" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Silueta frontal">
              <defs>
                <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#1c1c1c" />
                  <stop offset="100%" stopColor="#0a0a0a" />
                </linearGradient>
                <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
                </filter>
              </defs>
              <g transform="translate(30,20)" filter="url(#soft)">
                {/* Silhouette base */}
                <path d="M120 10 C140 10 160 30 165 60 C180 120 190 150 200 200 C210 260 210 300 200 360 C190 420 180 460 150 520 C135 550 110 570 80 572 C50 574 30 552 20 520 C-5 460 5 420 20 360 C35 300 35 260 45 200 C55 150 70 120 85 60 C90 30 100 10 120 10 Z" fill="url(#g1)" stroke="#111" strokeWidth="1" />

                {/* chest */}
                <path id="chest" d="M110 70 C118 60 182 60 190 70 C190 90 190 110 160 120 C140 125 120 125 100 120 C70 110 70 90 75 75 Z" fill={zoneColor("chest")} stroke="#111" />
                {/* abdomen / core */}
                <path id="core" d="M100 120 C140 125 160 130 170 150 C175 170 170 190 160 200 C150 210 130 215 110 210 C90 205 80 190 80 170 C82 150 90 135 100 120 Z" fill={zoneColor("core")} stroke="#111" />
                {/* quads frontal */}
                <path id="quadL" d="M95 210 C85 230 80 280 85 320 C88 350 95 380 105 400 C115 420 125 430 135 430 C120 380 115 330 110 280 C105 240 100 220 95 210 Z" fill={zoneColor("quad")} stroke="#111" />
                <path id="quadR" d="M205 210 C215 230 220 280 215 320 C212 350 205 380 195 400 C185 420 175 430 165 430 C180 380 185 330 190 280 C195 240 200 220 205 210 Z" fill={zoneColor("quad")} stroke="#111" />
                {/* glutes */}
                <path id="glutes" d="M115 180 C125 175 175 175 185 180 C195 200 195 210 185 225 C165 245 145 250 125 245 C105 240 95 225 100 210 C105 195 110 185 115 180 Z" fill={zoneColor("glutes")} stroke="#111" />
                {/* adductors inner thigh */}
                <path id="adductorsL" d="M120 230 C120 260 125 300 130 330 C132 350 140 360 145 360 C140 320 135 280 130 245 C125 235 122 230 120 230 Z" fill={zoneColor("adductors")} stroke="#111" />
                <path id="adductorsR" d="M180 230 C180 260 175 300 170 330 C168 350 160 360 155 360 C160 320 165 280 170 245 C175 235 178 230 180 230 Z" fill={zoneColor("adductors")} stroke="#111" />
                {/* calves frontal (lower) */}
                <path id="calvesL" d="M115 430 C120 440 128 460 130 480 C118 485 110 486 105 480 C100 472 108 455 115 430 Z" fill={zoneColor("calves")} stroke="#111" />
                <path id="calvesR" d="M195 430 C190 440 182 460 180 480 C192 485 200 486 205 480 C210 472 202 455 195 430 Z" fill={zoneColor("calves")} stroke="#111" />
                {/* biceps / shoulders */}
                <path id="shouldersL" d="M80 60 C70 80 72 100 86 110 C95 90 95 70 80 60 Z" fill={zoneColor("shoulders")} stroke="#111" />
                <path id="shouldersR" d="M220 60 C230 80 228 100 214 110 C205 90 205 70 220 60 Z" fill={zoneColor("shoulders")} stroke="#111" />
                <path id="bicepsL" d="M60 120 C55 140 58 170 68 190 C75 170 78 140 70 120 Z" fill={zoneColor("biceps")} stroke="#111" />
                <path id="bicepsR" d="M240 120 C245 140 242 170 232 190 C225 170 222 140 230 120 Z" fill={zoneColor("biceps")} stroke="#111" />
                {/* triceps back/front small */}
                <path id="tricepsL" d="M60 190 C55 205 58 220 68 235 C75 220 78 205 70 190 Z" fill={zoneColor("triceps")} stroke="#111" />
                <path id="tricepsR" d="M240 190 C245 205 242 220 232 235 C225 220 222 205 230 190 Z" fill={zoneColor("triceps")} stroke="#111" />
              </g>
            </svg>
          </div>

          {/* Posterior */}
          <div className="flex flex-col items-center justify-center">
            <div className="mb-2 text-sm font-semibold text-zinc-200">Posterior</div>
            <svg viewBox="0 0 300 600" className="h-[420px] w-full max-w-[320px]" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Silueta posterior">
              <defs>
                <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#1c1c1c" />
                  <stop offset="100%" stopColor="#090909" />
                </linearGradient>
              </defs>
              <g transform="translate(30,20)">
                <path d="M120 10 C140 10 160 30 165 60 C180 120 190 150 200 200 C210 260 210 300 200 360 C190 420 180 460 150 520 C135 550 110 570 80 572 C50 574 30 552 20 520 C-5 460 5 420 20 360 C35 300 35 260 45 200 C55 150 70 120 85 60 C90 30 100 10 120 10 Z" fill="url(#g2)" stroke="#111" strokeWidth="1" />

                {/* upper back */}
                <path id="back" d="M110 70 C120 60 180 60 190 70 C190 90 190 110 170 130 C150 145 130 145 110 130 C90 110 90 90 95 80 Z" fill={zoneColor("back")} stroke="#111" />
                {/* lower back */}
                <path id="lowerback" d="M100 130 C140 140 160 150 170 170 C175 190 170 210 160 230 C150 250 130 260 110 250 C90 240 85 220 90 200 C92 180 95 150 100 130 Z" fill={zoneColor("glutes")} stroke="#111" />
                {/* hamstrings */}
                <path id="hamL" d="M95 230 C85 260 80 330 85 380 C90 430 100 460 115 480 C120 450 120 410 125 360 C120 320 115 280 110 250 Z" fill={zoneColor("hamstring")} stroke="#111" />
                <path id="hamR" d="M205 230 C215 260 220 330 215 380 C210 430 200 460 185 480 C180 450 180 410 175 360 C180 320 185 280 190 250 Z" fill={zoneColor("hamstring")} stroke="#111" />
                {/* glutes posterior */}
                <path id="glutesBack" d="M115 160 C135 150 165 150 185 160 C195 180 195 200 185 215 C165 235 135 240 115 230 C95 220 95 200 100 185 C105 170 110 165 115 160 Z" fill={zoneColor("glutes")} stroke="#111" />
                {/* calves posterior */}
                <path id="calvesBackL" d="M115 470 C120 480 128 500 130 520 C118 525 110 526 105 520 C100 512 108 495 115 470 Z" fill={zoneColor("calves")} stroke="#111" />
                <path id="calvesBackR" d="M195 470 C190 480 182 500 180 520 C192 525 200 526 205 520 C210 512 202 495 195 470 Z" fill={zoneColor("calves")} stroke="#111" />
                {/* shoulders / traps */}
                <path id="shouldersBackL" d="M80 60 C70 80 72 100 86 110 C95 90 95 70 80 60 Z" fill={zoneColor("shoulders")} stroke="#111" />
                <path id="shouldersBackR" d="M220 60 C230 80 228 100 214 110 C205 90 205 70 220 60 Z" fill={zoneColor("shoulders")} stroke="#111" />
                {/* arms */}
                <path id="tricepsBackL" d="M60 120 C55 140 58 170 68 190 C75 170 78 140 70 120 Z" fill={zoneColor("triceps")} stroke="#111" />
                <path id="tricepsBackR" d="M240 120 C245 140 242 170 232 190 C225 170 222 140 230 120 Z" fill={zoneColor("triceps")} stroke="#111" />
              </g>
            </svg>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span style={{ background: '#2a2a2a' }} className="inline-block h-3 w-3 rounded-sm border border-zinc-800" />
            <span>Sin series</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span style={{ background: '#f6e58d' }} className="inline-block h-3 w-3 rounded-sm border border-zinc-800" />
            <span>Volumen bajo</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span style={{ background: '#d4af37' }} className="inline-block h-3 w-3 rounded-sm border border-zinc-800" />
            <span>Volumen medio</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span style={{ background: '#ff9f1c' }} className="inline-block h-3 w-3 rounded-sm border border-zinc-800" />
            <span>Volumen alto</span>
          </div>
        </div>
      </div>
    </div>
  );
}
