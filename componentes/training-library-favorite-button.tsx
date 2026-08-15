"use client";

import type { MouseEvent } from "react";
import type { TrainingLibraryBlock } from "@/types/training-library";

export function TrainingLibraryFavoriteButton({ block, busy, toggle }: {
  block: TrainingLibraryBlock;
  busy: boolean;
  toggle: (block: TrainingLibraryBlock) => void;
}) {
  const label = block.isFavorite ? `Quitar ${block.name} de favoritos` : `Marcar ${block.name} como favorito`;
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    toggle(block);
  }
  return <button type="button" aria-label={label} title={label} disabled={busy} onClick={handleClick} className={`grid size-10 shrink-0 place-items-center rounded-lg border text-lg transition disabled:opacity-50 ${block.isFavorite ? "border-yellow-400/35 bg-yellow-400/[.08] text-yellow-300" : "border-zinc-700 text-zinc-500 hover:text-yellow-300"}`}>{block.isFavorite ? "★" : "☆"}</button>;
}
