"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { WorkspaceBranding } from "@/lib/workspace-branding";

export function WorkspaceBrandLogo({ branding, cachedSrc, className = "h-10 w-10", compactDefault = false, officialBmMark = false }: { branding: Pick<WorkspaceBranding, "logoMode" | "customLogoUrl" | "accentColor">; cachedSrc?: string; className?: string; compactDefault?: boolean; officialBmMark?: boolean }) {
  const maskId = useId().replaceAll(":", "");
  const [failedCustomUrl, setFailedCustomUrl] = useState("");
  const [failedDefault, setFailedDefault] = useState(false);

  if (branding.logoMode === "CUSTOM" && branding.customLogoUrl && failedCustomUrl !== branding.customLogoUrl) {
    const source = `/api/workspace/logo/image?source=${encodeURIComponent(branding.customLogoUrl)}`;
    // eslint-disable-next-line @next/next/no-img-element -- The authenticated route streams a private Vercel Blob that changes at runtime.
    return <img src={cachedSrc || source} alt="" className={`${className} shrink-0 object-contain`} onError={() => setFailedCustomUrl(branding.customLogoUrl)} />;
  }

  if (failedDefault) return <span aria-hidden="true" className={`${className} grid shrink-0 place-items-center font-black italic text-[var(--brand-text)]`}>BM</span>;

  if (branding.logoMode === "WHITE" || branding.logoMode === "ACCENT") {
    const thresholdId = `${maskId}Threshold`;
    return <svg viewBox="0 0 384 384" aria-hidden="true" className={`${className} shrink-0 ${branding.logoMode === "WHITE" ? "text-white" : "text-[var(--bm-accent)]"}`}>
      <defs>
        <filter id={thresholdId} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.8504 2.8608 0.2888 0 -2.6" />
        </filter>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="384" height="384" style={{ maskType: "alpha" }}>
          <image href="/bm-training-logo(2).png" x="0" y="0" width="384" height="384" filter={`url(#${thresholdId})`} onError={() => setFailedDefault(true)} />
        </mask>
      </defs>
      <rect width="384" height="384" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>;
  }

  if (officialBmMark) {
    return <Image src="/bm-training-logo(2).png" alt="" width={44} height={44} priority unoptimized onError={() => setFailedDefault(true)} className={`${className} shrink-0 object-contain ${compactDefault ? "scale-[0.82]" : ""}`} />;
  }

  return <Image src="/bm-training-mark.png" alt="" width={44} height={44} priority unoptimized onError={() => setFailedDefault(true)} className={`${className} shrink-0 object-contain ${compactDefault ? "scale-[0.82]" : ""}`} />;
}
