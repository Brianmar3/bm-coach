type Anchor = { top: number; bottom: number; right: number };
type Size = { width: number; height: number };

export function routineActionMenuPosition(anchor: Anchor, menu: Size, viewport: Size) {
  const margin = 8;
  const gap = 8;
  const below = Math.max(0, viewport.height - anchor.bottom - gap - margin);
  const above = Math.max(0, anchor.top - gap - margin);
  const placement = below < menu.height && above > below ? "above" : "below";
  const available = placement === "above" ? above : below;
  const maxHeight = Math.min(menu.height, available);
  const width = Math.min(menu.width, Math.max(0, viewport.width - margin * 2));
  const left = Math.max(margin, Math.min(anchor.right - width, viewport.width - margin - width));
  const top = placement === "above" ? anchor.top - gap - maxHeight : anchor.bottom + gap;
  return { placement, top, left, width, maxHeight };
}
