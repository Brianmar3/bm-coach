"use client";

import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from "react";
import { appendNormalizedLibraryTags } from "@/lib/training-library";

export function TrainingTagInput({ value, onChange, label = "Tags", placeholder = "Escribí una etiqueta y presioná Enter", disabled = false }: {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  function commit(raw = draft) {
    const next = appendNormalizedLibraryTags(value, raw);
    if (next.length !== value.length || next.some((tag, index) => tag !== value[index])) onChange(next);
    setDraft("");
  }

  function remove(index: number) {
    onChange(value.filter((_, currentIndex) => currentIndex !== index));
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && draft.trim()) {
      event.preventDefault();
      event.stopPropagation();
      commit();
      return;
    }
    if (event.key === ",") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Tab" && draft.trim()) {
      commit();
      return;
    }
    if (event.key === "Backspace" && !draft && value.length) {
      event.preventDefault();
      remove(value.length - 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.includes(",")) return;
    event.preventDefault();
    commit(draft ? `${draft},${pasted}` : pasted);
  }

  function focusInput(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) inputRef.current?.focus();
  }

  return <div className="min-w-0">
    <label htmlFor={id} className="block text-sm text-zinc-200">{label}</label>
    <div onClick={focusInput} className="mt-1 flex min-h-11 min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-zinc-700 bg-black px-2.5 py-2 transition focus-within:border-yellow-400 focus-within:ring-1 focus-within:ring-yellow-400/30">
      {value.map((tag, index) => <span key={`${tag}-${index}`} className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg border border-yellow-400/15 bg-white/[.045] py-1 pl-2.5 pr-1 text-xs text-zinc-200">
        <span className="min-w-0 break-words">{tag}</span>
        <button type="button" disabled={disabled} onClick={() => remove(index)} aria-label={`Quitar etiqueta ${tag}`} className="grid size-6 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[.06] hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50">×</button>
      </span>)}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        disabled={disabled || value.length >= 20}
        maxLength={60}
        data-enter-next="tag-input"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={value.length ? "Agregar etiqueta…" : placeholder}
        className="min-h-7 min-w-[8rem] flex-[1_1_9rem] bg-transparent px-1 text-sm text-white outline-none placeholder:text-zinc-600 disabled:opacity-50"
      />
    </div>
  </div>;
}
