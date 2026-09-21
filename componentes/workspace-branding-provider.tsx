"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useBrowserStore } from "@/lib/browser-store";
import { BM_DEFAULT_ACCENT, workspaceBrandingVariables } from "@/lib/workspace-branding";
import type { CoachSettings } from "@/types/gestion";

export const WORKSPACE_BRANDING_EVENT = "bm:workspace-branding-updated";

export function WorkspaceBrandingProvider({ children }: { children: ReactNode }) {
  const { items } = useBrowserStore<CoachSettings>("bm-coach-settings", []);
  const [updatedAccentColor, setUpdatedAccentColor] = useState<string | null>(null);
  const accentColor = updatedAccentColor ?? items[0]?.accentColor ?? BM_DEFAULT_ACCENT;

  useEffect(() => {
    const update = (event: Event) => setUpdatedAccentColor((event as CustomEvent<{ accentColor?: string }>).detail?.accentColor ?? BM_DEFAULT_ACCENT);
    window.addEventListener(WORKSPACE_BRANDING_EVENT, update);
    return () => window.removeEventListener(WORKSPACE_BRANDING_EVENT, update);
  }, []);

  return <div className="workspace-brand min-h-full" style={workspaceBrandingVariables(accentColor) as CSSProperties}>{children}</div>;
}
