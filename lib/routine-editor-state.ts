import type { ClassBaseRoutineDraft as Draft } from "./class-template-base.ts";

export function reorderItems<T>(items: T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export function transferBlock(draft: Draft, sourceDay: string, targetDay: string, blockId: string, copy: boolean): Draft {
  if (sourceDay === targetDay) return draft;
  const source = draft.days.find(day => day.clientId === sourceDay)?.blocks.find(block => block.clientId === blockId);
  const target = draft.days.find(day => day.clientId === targetDay);
  if (!source || !target || target.blocks.length >= 20) return draft;
  // A cross-day move is a new placement. Never reuse database IDs from a different day.
  const inserted = { ...source, id: undefined, clientId: crypto.randomUUID(), exercises: source.exercises.map(exercise => ({ ...exercise, id: undefined, clientId: crypto.randomUUID() })) };
  return { ...draft, days: draft.days.map(day => ({ ...day, blocks: (day.clientId === targetDay ? [...day.blocks, inserted] : day.clientId === sourceDay && !copy ? day.blocks.filter(block => block.clientId !== blockId) : day.blocks).map((block, i) => ({ ...block, order: i + 1 })) })) };
}

export function draftSignature(draft: Draft): string {
  return JSON.stringify(draft, (key, value) => key === "id" || key === "clientId" ? undefined : value);
}

export class DraftHistory<T> {
  past: T[] = [];
  future: T[] = [];
  private lastGroup = "";
  private lastAt = 0;
  present: T;
  private limit: number;
  constructor(present: T, limit = 60) { this.present = present; this.limit = limit; }
  record(next: T, group = "", now = Date.now()) {
    if (next === this.present) return;
    if (!group || group !== this.lastGroup || now - this.lastAt > 700) this.past = [...this.past.slice(-(this.limit - 1)), this.present];
    this.present = next; this.future = []; this.lastGroup = group; this.lastAt = now;
  }
  undo() { if (!this.past.length) return this.present; this.future.unshift(this.present); this.present = this.past.pop()!; this.lastGroup = ""; return this.present; }
  redo() { if (!this.future.length) return this.present; this.past.push(this.present); this.present = this.future.shift()!; this.lastGroup = ""; return this.present; }
  reset(next: T) { this.present = next; this.past = []; this.future = []; this.lastGroup = ""; }
}

/** Keep the prescription's block semantics when moving to another day. */
export function transferExercise(draft: Draft, sourceDay: string, sourceBlock: string, exerciseId: string, targetDay: string, targetBlock?: string): Draft {
  if (sourceDay === targetDay && (!targetBlock || sourceBlock === targetBlock)) return draft;
  const source = draft.days.find(day => day.clientId === sourceDay)?.blocks.find(block => block.clientId === sourceBlock);
  const exercise = source?.exercises.find(item => item.clientId === exerciseId);
  const target = draft.days.find(day => day.clientId === targetDay);
  if (!source || !exercise || !target) return draft;
  const destination = targetBlock ? target.blocks.find(block => block.clientId === targetBlock) : target.blocks.find(block => block.type === source.type);
  if (targetBlock && (!destination || destination.type !== source.type)) return draft;
  if ((!destination && target.blocks.length >= 20) || (destination && destination.exercises.length >= 100)) return draft;
  const inserted = { ...exercise, id: undefined, clientId: crypto.randomUUID(), order: (destination?.exercises.length ?? 0) + 1 };
  return { ...draft, days: draft.days.map(day => {
    if (day.clientId !== sourceDay && day.clientId !== targetDay) return day;
    let blocks = day.blocks.map(block => {
      if (day.clientId === sourceDay && block.clientId === sourceBlock) return { ...block, exercises: block.exercises.filter(item => item.clientId !== exerciseId).map((item, index) => ({ ...item, order: index + 1 })) };
      if (day.clientId === targetDay && block.clientId === destination?.clientId) return { ...block, exercises: [...block.exercises, inserted] };
      return block;
    });
    if (day.clientId === targetDay && !destination) blocks = [...blocks, { ...source, id: undefined, clientId: crypto.randomUUID(), order: blocks.length + 1, exercises: [inserted] }];
    return { ...day, blocks };
  }) };
}
