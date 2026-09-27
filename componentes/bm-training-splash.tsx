import Image from "next/image";

export function BmTrainingSplash() {
  return (
    <div
      role="status"
      aria-label="Cargando BM Training"
      className="bm-app-splash fixed inset-0 z-[200] grid h-[100dvh] w-screen place-items-center overflow-hidden p-6 sm:p-10"
    >
      <div className="bm-app-splash-stage grid place-items-center">
        <Image
          src="/bm-training-full-logo.png"
          alt="BM Training — Gestión, entrenamiento y seguimiento"
          width={1448}
          height={1086}
          preload
          unoptimized
          sizes="(max-width: 640px) 88vw, 672px"
          className="bm-app-splash-logo-image h-auto w-full object-contain"
        />
      </div>
    </div>
  );
}
