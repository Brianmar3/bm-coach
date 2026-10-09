export function portalKeyboardIsOpen({ mobile, editable, wasOpen, baselineHeight, viewportHeight, layoutHeight, scale }: {
  mobile: boolean; editable: boolean; wasOpen: boolean; baselineHeight: number; viewportHeight: number; layoutHeight: number; scale: number;
}) {
  return mobile && Math.abs(scale - 1) < 0.05 && (editable || wasOpen) &&
    Math.max(baselineHeight, layoutHeight) - viewportHeight > Math.max(120, baselineHeight * 0.18);
}

export function isKeyboardEditable(element: Element | null) {
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  if (element instanceof HTMLInputElement) return !element.disabled && !element.readOnly &&
    ["text", "password", "email", "search", "tel", "url", "number"].includes(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}
