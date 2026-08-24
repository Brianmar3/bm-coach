"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { BmEyeIcon, BmEyeOffIcon } from "@/componentes/icons";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, id, className = "", onKeyDown, onKeyUp, onBlur, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const capsLockId = `${inputId}-caps-lock`;
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  function updateCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  const describedBy = [props["aria-describedby"], error ? errorId : null, capsLock ? capsLockId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="block text-sm">
      <label htmlFor={inputId} className="font-semibold">{label}</label>
      <span className="relative mt-1 block">
        <input
          {...props}
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onKeyDown={(event) => { updateCapsLock(event); onKeyDown?.(event); }}
          onKeyUp={(event) => { updateCapsLock(event); onKeyUp?.(event); }}
          onBlur={(event) => { setCapsLock(false); onBlur?.(event); }}
          className={`w-full rounded-xl border bg-zinc-950 px-4 py-3 pr-14 text-base text-white outline-none transition sm:text-sm ${error ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/25" : "border-zinc-700 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/15"} ${className}`}
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-1 my-auto grid size-11 place-items-center rounded-lg text-lg text-zinc-400 transition hover:bg-white/5 hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          {visible ? <BmEyeOffIcon size={20} /> : <BmEyeIcon size={20} />}
        </button>
      </span>
      {capsLock && <span id={capsLockId} className="mt-1.5 block text-xs text-amber-300">Bloq Mayús está activado.</span>}
      {error && <span id={errorId} role="alert" className="mt-1.5 block text-xs text-red-300">{error}</span>}
    </div>
  );
});
