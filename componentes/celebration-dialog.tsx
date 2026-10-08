"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BmCheckIcon, BmMedalIcon, BmTrophyIcon } from "@/componentes/icons";
import { useWorkspaceBranding } from "@/componentes/workspace-branding-provider";
import { workspaceBrandingVariables } from "@/lib/workspace-branding";
import type { PortalCelebration } from "@/lib/portal-celebrations";

export function CelebrationDialog({ item, remaining, saving, error, onContinue, onAchievements }: {
  item: PortalCelebration; remaining: number; saving: boolean; error: string;
  onContinue: () => void; onAchievements: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const branding = useWorkspaceBranding();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    continueButton.current?.focus({ preventScroll: true });
    return () => {
      node.close(); document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const weekly = item.kind === "weekly";
  const title = weekly ? "¡Objetivo semanal completado!" : "¡Nuevo logro desbloqueado!";
  const subtitle = weekly ? `Cumpliste ${item.mission.target === 1 ? "tu entrenamiento" : `tus ${item.mission.target} entrenamientos`} de la semana` : item.achievement.name;
  const points = weekly ? item.mission.completionBonus : item.achievement.points;
  return createPortal(<dialog ref={dialog} className="workspace-brand bm-celebration" aria-labelledby="bm-celebration-title" aria-describedby="bm-celebration-subtitle" onCancel={event => { event.preventDefault(); if (!saving) onContinue(); }} style={workspaceBrandingVariables(branding.accentColor) as CSSProperties}>
    <div className="bm-celebration-confetti" aria-hidden="true">{Array.from({ length: 42 }, (_, index) => <i key={index} style={{ "--x": `${(index * 37 + 11) % 100}%`, "--delay": `${(index % 7) * 85}ms`, "--drift": `${((index * 19) % 160) - 80}px`, "--spin": `${index % 2 ? 540 : -450}deg` } as CSSProperties} />)}</div>
    <div className="bm-celebration-content">
      <p className="bm-celebration-eyebrow">{branding.displayName} <span>•</span> {weekly ? "Constancia que se nota" : "Un nuevo hito"}</p>
      <div className="bm-celebration-emblem" aria-hidden="true"><span className="bm-celebration-orbit" />{weekly ? <BmTrophyIcon size={72} strokeWidth={1.4} /> : <BmMedalIcon size={72} strokeWidth={1.4} />}<span className="bm-celebration-check"><BmCheckIcon size={20} /></span></div>
      <h2 id="bm-celebration-title">{title}</h2>
      <p id="bm-celebration-subtitle" className="bm-celebration-subtitle">{subtitle}</p>
      {!weekly && item.achievement.description && <p className="bm-celebration-description">{item.achievement.description}</p>}
      {!weekly && (item.achievement.exercise || item.achievement.newValue) && <p className="bm-celebration-detail">{item.achievement.exercise}{item.achievement.previousValue && ` · ${item.achievement.previousValue} → `}{item.achievement.newValue && <strong>{item.achievement.newValue}</strong>}</p>}
      <div className="bm-celebration-reward">{points > 0 ? <><strong>+{points} <span>pts</span></strong><span>{weekly ? "Ganaste tu bonus semanal" : "Puntos por este logro"}</span></> : <><strong>Logro desbloqueado</strong><span>Seguís sumando hitos en tu progreso</span></>}</div>
      <div className="bm-celebration-actions">
        {error && <p role="alert" className="bm-celebration-error">{error}</p>}
        <button ref={continueButton} type="button" disabled={saving} aria-busy={saving} onClick={onContinue} className="bm-celebration-primary">{saving ? "Guardando…" : "Continuar"}</button>
        <button type="button" disabled={saving} onClick={onAchievements} className="bm-celebration-secondary">Ver mis logros</button>
        {remaining > 0 && <p className="bm-celebration-next">{remaining === 1 ? "Hay otro logro esperándote" : `${remaining} logros más te esperan`}</p>}
      </div>
    </div>
  </dialog>, document.body);
}
