"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { nextEnabledOption, revealOption } from "@/lib/keyboard-navigation";

/** Editable ARIA combobox: the input retains focus and Enter invokes the click action. */
export function useComboboxNavigation<T>({ items, itemKey, onSelect, queryKey, isDisabled = () => false, enabled = true, initialOpen = false, closeOnSelect = true }: {
  items: readonly T[]; itemKey: (item: T) => string; onSelect: (item: T) => void;
  queryKey: string; isDisabled?: (item: T) => boolean; enabled?: boolean;
  initialOpen?: boolean; closeOnSelect?: boolean;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const attachRoot = useCallback((node: HTMLDivElement | null) => { rootRef.current = node; }, []);
  const attachList = useCallback((node: HTMLDivElement | null) => { listRef.current = node; }, []);
  const attachInput = useCallback((node: HTMLInputElement | null) => { inputRef.current = node; }, [inputRef]);
  const [expanded, setExpanded] = useState(initialOpen);
  const [cursor, setCursor] = useState<{ key: string; query: string } | null>(null);
  const open = enabled && expanded;
  const keys = items.filter((item) => !isDisabled(item)).map(itemKey);
  const activeKey = open && cursor?.query === queryKey && keys.includes(cursor.key) ? cursor.key : null;
  const optionId = (key: string) => `${id}-option-${encodeURIComponent(key)}`;
  const close = () => { setExpanded(false); setCursor(null); };
  const activate = (key: string) => setCursor({ key, query: queryKey });
  const select = (item: T) => {
    if (!enabled || isDisabled(item)) return;
    inputRef.current?.focus({ preventScroll: true });
    if (closeOnSelect) close();
    onSelect(item);
  };
  useEffect(() => {
    if (activeKey) revealOption(listRef.current, document.getElementById(`${id}-option-${encodeURIComponent(activeKey)}`));
  }, [activeKey, id]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!event.defaultPrevented && event.key === "Tab") { close(); return; }
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); event.stopPropagation();
      if (!enabled) return;
      setExpanded(true);
      const next = nextEnabledOption(keys, activeKey, event.key === "ArrowDown" ? 1 : -1);
      if (next !== null) activate(next);
    } else if (event.key === "Enter") {
      // Even an empty, closed or freshly filtered list must not implicitly submit a form.
      event.preventDefault(); event.stopPropagation();
      if (event.repeat) return;
      const item = open && activeKey !== null ? items.find((item) => itemKey(item) === activeKey) : undefined;
      if (item) select(item);
    } else if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); close();
    }
  }

  return {
    open, activeKey, attachRoot, attachList, attachInput, close,
    show: () => { if (enabled) setExpanded(true); },
    changed: () => { setExpanded(true); setCursor(null); },
    rootProps: { onBlur: (event: React.FocusEvent<HTMLDivElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); } },
    inputProps: {
      role: "combobox" as const, "aria-autocomplete": "list" as const, "aria-expanded": open,
      "aria-controls": open ? `${id}-list` : undefined,
      "aria-activedescendant": activeKey === null ? undefined : optionId(activeKey),
      "data-keyboard-owned": "true", "data-enter-next": "false",
      onFocus: () => { if (enabled) setExpanded(true); }, onKeyDown,
    },
    listProps: { id: `${id}-list`, role: "listbox" as const },
    optionProps: (item: T) => ({
      id: optionId(itemKey(item)), role: "option" as const, tabIndex: -1,
      "aria-selected": activeKey === itemKey(item), "aria-disabled": isDisabled(item) || undefined,
      disabled: isDisabled(item), "data-keyboard-active": activeKey === itemKey(item) || undefined,
      onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
      onPointerMove: () => { if (!isDisabled(item)) activate(itemKey(item)); },
      onClick: () => select(item),
    }),
  };
}
