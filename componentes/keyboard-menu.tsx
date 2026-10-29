"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import { useMenuNavigation } from "@/componentes/use-result-navigation";

export function KeyboardMenu({ onClose, onKeyDown, ...props }: HTMLAttributes<HTMLDivElement> & { onClose: () => void }) {
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (document.activeElement instanceof HTMLButtonElement) trigger.current = document.activeElement; }, []);
  const keyboard = useMenuNavigation(menu, trigger, true, onClose);
  return <div {...props} ref={menu} role="menu" onKeyDown={event => { onKeyDown?.(event); keyboard(event); }} />;
}
