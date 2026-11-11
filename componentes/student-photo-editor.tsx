"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import styles from "./student-avatar-page.module.css";

const SIZE = 512;
const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 3 * 1024 * 1024;
type Position = { x: number; y: number };

function cropSize(image: HTMLImageElement, zoom: number) {
  const scale = SIZE * zoom / Math.min(image.naturalWidth, image.naturalHeight);
  return { width: image.naturalWidth * scale, height: image.naturalHeight * scale };
}

function boundedPosition(position: Position, image: HTMLImageElement, zoom: number) {
  const { width, height } = cropSize(image, zoom);
  const x = Math.max(0, (width - SIZE) / 2);
  const y = Math.max(0, (height - SIZE) / 2);
  return { x: Math.max(-x, Math.min(x, position.x)), y: Math.max(-y, Math.min(y, position.y)) };
}

function croppedFile(canvas: HTMLCanvasElement) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || !blob.size || blob.size > MAX_BYTES) {
        reject(new Error("No se pudo preparar la foto. Elegí otra imagen."));
        return;
      }
      resolve(new File([blob], "perfil.jpg", { type: blob.type }));
    }, "image/jpeg", 0.92);
  });
}

export function StudentPhotoEditor({ initialFile, onCancel, onSave }: {
  initialFile: File;
  onCancel: () => void;
  onSave: (file: File) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const saveLock = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [file, setFile] = useState(initialFile);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const source = URL.createObjectURL(file);
    const next = new Image();
    const fail = () => {
      if (!active) return;
      setLoading(false);
      setError("No se pudo abrir la foto. Elegí un archivo JPG, PNG o WebP válido.");
    };
    if (!file.size || file.size > MAX_BYTES || !ACCEPT.split(",").includes(file.type)) {
      queueMicrotask(() => {
        if (!active) return;
        setLoading(false);
        setError("Elegí una foto JPG, PNG o WebP de hasta 3 MB.");
      });
    } else {
      next.onload = () => {
        if (!active) return;
        if (!next.naturalWidth || !next.naturalHeight) return fail();
        setImage(next);
        setLoading(false);
      };
      next.onerror = fail;
      next.src = source;
    }
    return () => {
      active = false;
      URL.revokeObjectURL(source);
    };
  }, [file]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.fillStyle = "#141414";
    context.fillRect(0, 0, SIZE, SIZE);
    if (!image) return;
    const { width, height } = cropSize(image, zoom);
    context.drawImage(image, (SIZE - width) / 2 + position.x, (SIZE - height) / 2 + position.y, width, height);
  }, [image, position, zoom]);

  function move(x: number, y: number) {
    if (image && !saveLock.current) setPosition((current) => boundedPosition({ x: current.x + x, y: current.y + y }, image, zoom));
  }

  function dragPhoto(event: PointerEvent<HTMLCanvasElement>) {
    if (drag.current?.id !== event.pointerId) return;
    const { x, y } = drag.current;
    const scale = SIZE / event.currentTarget.getBoundingClientRect().width;
    move((event.clientX - x) * scale, (event.clientY - y) * scale);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  async function save() {
    if (saveLock.current || !image || !canvas.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave(await croppedFile(canvas.current));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la foto.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  return <dialog ref={dialog} className={styles.photoDialog} aria-labelledby="profile-photo-title" onCancel={(event) => {
    event.preventDefault();
    if (!saveLock.current) onCancel();
  }}>
    <form className={styles.photoLayout} onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <header className={styles.photoHeader}><h2 id="profile-photo-title">Editar foto</h2></header>
      <div className={styles.photoBody} data-photo-editor-scroll>
        <p id="profile-photo-instructions">Arrastrá la imagen o usá las flechas del teclado para encuadrarla.</p>
        <canvas ref={canvas} width={SIZE} height={SIZE} className={styles.photoCanvas} aria-label="Vista previa circular de tu foto" aria-describedby="profile-photo-instructions"
          tabIndex={image && !saving ? 0 : -1}
          onPointerDown={(event) => {
            if (!image || saveLock.current || !event.isPrimary || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerMove={dragPhoto}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={(event) => {
            const shifts: Record<string, [number, number]> = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
            const shift = shifts[event.key];
            if (!shift) return;
            event.preventDefault();
            move(...shift);
          }}
        />
        <label className={styles.photoZoom}>Zoom
          <input type="range" min="1" max="3" step="0.05" value={zoom} disabled={!image || saving} onChange={(event) => {
            if (!image) return;
            const next = Number(event.target.value);
            setPosition(boundedPosition(position, image, next));
            setZoom(next);
          }} />
        </label>
        <label className={styles.photoReplace}>Cambiar foto
          <input type="file" accept={ACCEPT} className="sr-only" disabled={saving} onChange={(event) => {
            const selected = event.target.files?.[0];
            event.target.value = "";
            if (!selected || saveLock.current) return;
            setError("");
            setImage(null);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
            setLoading(true);
            setFile(selected);
          }} />
        </label>
      </div>
      <footer className={styles.photoFooter} aria-busy={saving}>
        {error && <p role="alert" className={styles.photoError}>{error}</p>}
        <div className={styles.photoActions}>
          <button type="button" disabled={saving} onClick={onCancel}>Cancelar</button>
          <button type="submit" disabled={!image || loading || saving}>{saving ? "Guardando…" : loading ? "Preparando…" : "Guardar"}</button>
        </div>
      </footer>
    </form>
  </dialog>;
}
