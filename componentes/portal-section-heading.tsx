
import type { ComponentType, ReactNode } from "react";
import type { BmIconProps } from "@/componentes/icons";

export function PortalSectionHeading({ icon: Icon, kicker, title, subtitle, action, className = "" }: {
  icon: ComponentType<BmIconProps>;
  kicker: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  className?: string;
}) {
  return <header className={"portal-section-heading " + className}>
    <span className="portal-section-heading-icon" aria-hidden="true"><Icon size={24} /></span>
    <div className="portal-section-heading-copy">
      <p>{kicker}</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
    {action && <div className="portal-section-heading-action">{action}</div>}
  </header>;
}
