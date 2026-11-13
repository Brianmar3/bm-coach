"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BmCloseIcon, BmCommentIcon } from "@/componentes/icons";
import { AssistantView } from "@/componentes/nutrition-workspace";

export function NutritionAssistantDock({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const panel = dialog.current;
    const viewport = window.visualViewport;
    if (!opened || !panel || !viewport) return;

    function updateViewport() {
      if (!panel || !viewport) return;
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const keyboard = viewport.scale === 1 && covered > 100;
      panel.toggleAttribute("data-keyboard", keyboard);
      if (keyboard) {
        panel.style.setProperty("--nutrition-keyboard-inset", String(covered) + "px");
        panel.style.setProperty("--nutrition-visible-height", String(viewport.height) + "px");
      }
    }

    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);
    updateViewport();
    return () => {
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
      panel.removeAttribute("data-keyboard");
      panel.style.removeProperty("--nutrition-keyboard-inset");
      panel.style.removeProperty("--nutrition-visible-height");
    };
  }, [opened]);

  if (pathname?.startsWith("/portal/nutricion/asistente")) return children;

  return (
    <div className="nutrition-with-assistant">
      {children}
      <button ref={trigger} type="button" className="bm-button bm-button-secondary nutrition-assistant-trigger"
        aria-haspopup="dialog" aria-controls="nutrition-assistant-dialog" aria-expanded={opened}
        onClick={() => {
          dialog.current?.showModal();
          setOpened(true);
          setStarted(true);
        }}>
        <BmCommentIcon size={21} aria-hidden="true" /> Asistente
      </button>
      <dialog ref={dialog} id="nutrition-assistant-dialog" className="nutrition-assistant-dialog"
        aria-labelledby="nutrition-assistant-title"
        onClose={() => { setOpened(false); trigger.current?.focus(); }}>
        <header className="nutrition-assistant-header">
          <span className="nutrition-destination-icon"><BmCommentIcon size={21} aria-hidden="true" /></span>
          <h2 id="nutrition-assistant-title">Asistente de Nutrición</h2>
          <button type="button" autoFocus className="bm-button bm-button-secondary nutrition-assistant-close"
            aria-label="Cerrar asistente" onClick={() => dialog.current?.close()}>
            <BmCloseIcon size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="nutrition-assistant-body">
          {started && <AssistantView conversationId="" embedded />}
        </div>
      </dialog>
    </div>
  );
}
