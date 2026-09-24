"use client";

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useBrowserStore } from "@/lib/browser-store";
import { DEFAULT_WORKSPACE_BRANDING, resolveWorkspaceBranding, workspaceBrandingVariables, type WorkspaceBranding } from "@/lib/workspace-branding";
import type { CoachSettings } from "@/types/gestion";

export const WORKSPACE_BRANDING_EVENT = "bm:workspace-branding-updated";
const WorkspaceBrandingContext = createContext<WorkspaceBranding>(DEFAULT_WORKSPACE_BRANDING);

export function useWorkspaceBranding() {
  return useContext(WorkspaceBrandingContext);
}

export function WorkspaceBrandingProvider({ children }: { children: ReactNode }) {
  const { items } = useBrowserStore<CoachSettings>("bm-coach-settings", []);
  const [updatedBranding, setUpdatedBranding] = useState<WorkspaceBranding | null>(null);
  const plan = items[0]?.brandingPlan ?? "STARTER";
  const branding = updatedBranding ?? resolveWorkspaceBranding(items[0], plan);

  useEffect(() => {
    const update = (event: Event) => setUpdatedBranding(resolveWorkspaceBranding((event as CustomEvent<Partial<CoachSettings>>).detail, plan));
    window.addEventListener(WORKSPACE_BRANDING_EVENT, update);
    return () => window.removeEventListener(WORKSPACE_BRANDING_EVENT, update);
  }, [plan]);

  return <WorkspaceBrandingContext.Provider value={branding}><div className="workspace-brand min-h-full" style={workspaceBrandingVariables(branding.accentColor) as CSSProperties}>{children}</div></WorkspaceBrandingContext.Provider>;
}
