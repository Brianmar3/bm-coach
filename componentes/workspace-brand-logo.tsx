"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { WorkspaceBranding } from "@/lib/workspace-branding";

export function WorkspaceBrandLogo({ branding, className = "h-10 w-10" }: { branding: Pick<WorkspaceBranding, "logoMode" | "customLogoUrl" | "accentColor">; className?: string }) {
  const maskId = useId().replaceAll(":", "");
  const [failedCustomUrl, setFailedCustomUrl] = useState("");

  if (branding.logoMode === "CUSTOM" && branding.customLogoUrl && failedCustomUrl !== branding.customLogoUrl) {
    const source = `/api/workspace/logo/image?source=${encodeURIComponent(branding.customLogoUrl)}`;
    // eslint-disable-next-line @next/next/no-img-element -- The authenticated route streams a private Vercel Blob that changes at runtime.
    return <img src={source} alt="" className={`${className} shrink-0 object-contain`} onError={() => setFailedCustomUrl(branding.customLogoUrl)} />;
  }

  if (branding.logoMode === "WHITE" || branding.logoMode === "ACCENT") {
    return <svg viewBox="0 0 384 384" aria-hidden="true" className={`${className} shrink-0 ${branding.logoMode === "WHITE" ? "text-white" : "text-[var(--bm-accent)]"}`}>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="384" height="384" style={{ maskType: "luminance" }}>
          <image href="/bm-training-mark.png" x="0" y="0" width="384" height="384" />
        </mask>
      </defs>
      <rect width="384" height="384" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>;
  }

  return <Image src="/bm-training-mark.png" alt="" width={44} height={44} priority unoptimized className={`${className} shrink-0 object-contain`} />;
}
