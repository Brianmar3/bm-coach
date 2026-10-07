import type { CSSProperties, ReactNode } from "react";

export type BmIconProps = {
  size?: number;
  className?: string;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  active?: boolean;
  title?: string;
};

/** BM optical grid: 24 units, 2-unit clearance, rounded 1.7-unit stroke.
 * Inherit the host's semantic color; active uses its workspace's readable accent.
 * No gradients, external resources, raster assets or runtime effects.
 */
export function createBmIcon(name: string, drawing: ReactNode) {
  function BmIcon({ size = 24, className, color, stroke = "currentColor", strokeWidth = 1.7, active, title }: BmIconProps) {
    const style: CSSProperties = { flexShrink: 0, verticalAlign: "middle", color: color ?? (active ? "var(--brand-text, currentColor)" : undefined) };
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} data-bm-icon={name} data-active={active === undefined ? undefined : active} aria-hidden={title ? undefined : true} role={title ? "img" : undefined} focusable="false">
      {title && <title>{title}</title>}{drawing}
    </svg>;
  }
  BmIcon.displayName = name;
  return BmIcon;
}
