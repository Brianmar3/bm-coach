import { WorkspaceBrandLogo } from "@/componentes/workspace-brand-logo";
import type { WorkspaceBranding } from "@/lib/workspace-branding";
import styles from "./app-brand-identity.module.css";

// Shared identity only: each shell retains its own navigation and system insets.
export function AppBrandIdentity({ branding, cachedLogo }: { branding: WorkspaceBranding; cachedLogo?: string }) {
  return <span className={styles.identity}>
    <WorkspaceBrandLogo branding={branding} cachedSrc={cachedLogo} className={styles.logo} compactDefault officialBmMark />
    <span className={styles.copy}>
      <span className={styles.name} title={branding.displayName}>{branding.displayName}</span>
      <span className={styles.subtitle} title="Gestión, entrenamiento y seguimiento">Gestión, entrenamiento y seguimiento</span>
    </span>
  </span>;
}
