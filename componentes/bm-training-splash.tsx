import Image from "next/image";

export function BmTrainingSplash() {
  return (
    <div
      role="status"
      aria-label="Cargando BM Training"
      className="bm-app-splash fixed inset-0 z-[200] grid h-[100dvh] w-screen place-items-center overflow-hidden p-6 sm:p-10"
    >
      <div className="bm-app-splash-stage relative grid aspect-square place-items-center">
        <svg
          className="bm-app-splash-ring absolute inset-0 size-full overflow-visible"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="bm-splash-ring-gold" x1="30" y1="28" x2="170" y2="172" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#f59e0b" />
              <stop offset="0.5" stopColor="#fde68a" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <circle className="bm-splash-ring-base" cx="100" cy="100" r="94" fill="none" stroke="url(#bm-splash-ring-gold)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="bm-app-splash-logo relative z-10 w-[96%]">
          <Image
            src="/bm-training-splash.png"
            alt="BM Training — Gestión, entrenamiento y seguimiento"
            width={1536}
            height={1024}
            preload
            sizes="(max-width: 640px) 84vw, 645px"
            className="bm-app-splash-logo-image h-auto w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
