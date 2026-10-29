type EscapeLayer = {
  id: symbol;
  priority: number;
  sequence: number;
  dismiss: () => void;
  restoreFocus?: HTMLElement | null;
};

const layers = new Map<symbol, EscapeLayer>();
let sequence = 0;
let listening = false;

function controlOwnsEscape(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const disclosure = target.closest("details[open]");
  const dialog = target.closest('[role="dialog"], [role="alertdialog"]');
  if (disclosure && (!dialog || dialog.contains(disclosure))) return true;
  return Boolean(target.closest('dialog[open], select, input[list], [aria-expanded="true"], [data-escape-first="true"]'));
}

function topLayer() {
  return [...layers.values()].sort((left, right) => right.priority - left.priority || right.sequence - left.sequence)[0];
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.isComposing || event.keyCode === 229 || event.defaultPrevented || controlOwnsEscape(event.target)) return;
  const layer = topLayer();
  if (!layer) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  layer.dismiss();
  if (layer.restoreFocus) requestAnimationFrame(() => layer.restoreFocus?.focus());
}

function updateListener() {
  if (typeof document === "undefined") return;
  if (layers.size && !listening) {
    document.addEventListener("keydown", handleEscape, true);
    listening = true;
  } else if (!layers.size && listening) {
    document.removeEventListener("keydown", handleEscape, true);
    listening = false;
  }
}

export function registerEscapeLayer({ dismiss, priority = 0, restoreFocus }: { dismiss: () => void; priority?: number; restoreFocus?: HTMLElement | null }) {
  const id = Symbol("trainer-escape-layer");
  layers.set(id, { id, priority, sequence: sequence++, dismiss, restoreFocus });
  updateListener();
  return () => {
    layers.delete(id);
    updateListener();
  };
}
