/** Move within a single day. Only order changes; IDs and nested content stay intact. */
export function moveRoutineBlock<T extends { clientId: string; order: number }>(blocks: T[], clientId: string, targetIndex: number): T[] {
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  const sourceIndex = ordered.findIndex((block) => block.clientId === clientId);
  if (sourceIndex < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= ordered.length || targetIndex === sourceIndex) return blocks;
  const [block] = ordered.splice(sourceIndex, 1);
  ordered.splice(targetIndex, 0, block);
  return ordered.map((item, index) => ({ ...item, order: index + 1 }));
}

/** Insertion index among the other cards, so expanded cards and gaps also work. */
export function routineBlockDropIndex(pointerY: number, otherCards: { top: number; bottom: number }[]): number {
  const index = otherCards.findIndex((card) => pointerY < (card.top + card.bottom) / 2);
  return index === -1 ? otherCards.length : index;
}

export function routineBlockScrollSpeed(pointerY: number, top: number, bottom: number): number {
  const edge = Math.min(72, (bottom - top) / 4);
  if (edge <= 0) return 0;
  if (pointerY < top + edge) return -Math.min(12, Math.max(0, (top + edge - pointerY) / edge * 12));
  if (pointerY > bottom - edge) return Math.min(12, Math.max(0, (pointerY - bottom + edge) / edge * 12));
  return 0;
}
