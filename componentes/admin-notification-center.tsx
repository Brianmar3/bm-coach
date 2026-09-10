"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeLayer } from "@/componentes/use-trainer-keyboard-interactions";
import { useRouter } from "next/navigation";
import { openNotificationSafely } from "@/lib/trainer-notification-destination";

type HeaderNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  url: string;
  destination?: string;
  response?: "GOING" | "NOT_GOING";
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  notifications: HeaderNotification[];
  unreadCount: number;
};

type Audience = "trainer" | "student";

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function NotificationCenter({ audience }: { audience: Audience }) {
  const router = useRouter();
  const endpoint =
    audience === "trainer"
      ? "/api/admin/notifications"
      : "/api/portal/notifications";
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const openingRef = useRef({ opening: false });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as NotificationsResponse;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    const onFocus = () => void loadNotifications();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadNotifications]);

  const close = useCallback(() => {
    setConfirmingDelete(false);
    setDeleteError("");
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [setOpen]);

  const closeDeleteConfirmation = useCallback(() => {
    if (deleting) return;
    setConfirmingDelete(false);
    setDeleteError("");
    window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  }, [deleting]);

  useEscapeLayer(open, close, { priority: 70, triggerRef });
  useEscapeLayer(confirmingDelete, closeDeleteConfirmation, { priority: 80, triggerRef: deleteTriggerRef });

  useEffect(() => {
    if (confirmingDelete) window.requestAnimationFrame(() => cancelDeleteRef.current?.focus());
  }, [confirmingDelete]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !confirmationRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [close, open]);

  async function markRead(id: string) {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) return false;
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, readAt: new Date().toISOString() }
          : notification,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    return true;
  }

  async function markAllRead() {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!response.ok) return;
    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? now,
      })),
    );
    setUnreadCount(0);
  }

  async function deleteAllNotifications() {
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) throw new Error("notification deletion failed");
      setNotifications([]);
      setUnreadCount(0);
      setConfirmingDelete(false);
    } catch {
      setDeleteError("No se pudieron borrar las notificaciones. Intentá nuevamente.");
    } finally {
      setDeleting(false);
    }
  }

  async function openNotification(notification: HeaderNotification) {
    await openNotificationSafely(
      {
        id: notification.id,
        readAt: notification.readAt,
        destination: audience === "student" ? notification.destination ?? "/portal" : notification.url,
      },
      openingRef.current,
      markRead,
      (destination) => {
        setOpen(false);
        if (audience === "trainer" && destination.startsWith("/alumnos?")) {
          window.location.assign(destination);
          return;
        }
        router.push(destination);
        window.setTimeout(() => { openingRef.current.opening = false; }, 1000);
      },
    );
  }

  const panel =
    open
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-[2px] sm:bg-black/30"
              aria-hidden="true"
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Centro de notificaciones"
              className="fixed inset-x-2 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[100] flex max-h-[calc(100dvh-env(safe-area-inset-top)-5.5rem)] flex-col overflow-hidden rounded-3xl border border-yellow-400/20 bg-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,.75)] sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[calc(env(safe-area-inset-top)+5rem)] sm:max-h-[min(72dvh,38rem)] sm:w-[25rem] sm:rounded-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-bold text-white">Notificaciones</p>
                  <p className="truncate text-xs text-zinc-500">
                    {audience === "trainer"
                      ? "Respuestas de asistencia recientes"
                      : "Mensajes, avisos y novedades"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!loading && notifications.length > 0 && (
                    <button
                      ref={deleteTriggerRef}
                      type="button"
                      onClick={() => {
                        setDeleteError("");
                        setConfirmingDelete(true);
                      }}
                      aria-label="Borrar todas las notificaciones"
                      className="min-h-10 rounded-lg px-2 text-xs font-semibold text-red-300 transition hover:bg-red-400/10 focus-visible:outline-2 focus-visible:outline-red-300"
                    >
                      Borrar todo
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="rounded-lg px-2 py-2 text-xs font-semibold text-yellow-300 hover:bg-yellow-400/10"
                    >
                      Leer todas
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Cerrar notificaciones"
                    className="grid h-10 w-10 place-items-center rounded-xl text-xl text-zinc-400 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-yellow-300"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                {loading ? (
                  <p className="p-5 text-sm text-zinc-500">
                    Cargando notificaciones…
                  </p>
                ) : notifications.length === 0 ? (
                  <div className="p-7 text-center">
                    <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-yellow-400/15 bg-yellow-400/[0.05] text-yellow-300">
                      <BellIcon />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-zinc-300">
                      No hay notificaciones
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {audience === "trainer"
                        ? "Las respuestas de los alumnos aparecerán acá."
                        : "Tus próximos avisos aparecerán acá."}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-800/80">
                    {notifications.map((notification) => (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => openNotification(notification)}
                          className={`block w-full px-4 py-3 text-left transition hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-yellow-300 ${
                            notification.readAt ? "" : "bg-yellow-400/[0.06]"
                          }`}
                        >
                          <span className="flex items-start gap-3">
                            <span
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                notification.readAt
                                  ? "bg-zinc-700"
                                  : notification.response === "GOING"
                                    ? "bg-emerald-400"
                                    : "bg-yellow-400"
                              }`}
                            />
                            <span className="min-w-0">
                              <span className="mb-0.5 block text-xs font-bold text-yellow-300">
                                  {notification.title}
                              </span>
                              <span
                                className={`block text-sm leading-5 ${
                                  notification.readAt
                                    ? "text-zinc-400"
                                    : "font-semibold text-zinc-100"
                                }`}
                              >
                                {notification.message}
                              </span>
                              <span className="mt-1 block text-xs text-zinc-600">
                                {formatNotificationDate(notification.createdAt)}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {confirmingDelete && (
              <div
                className="fixed inset-0 z-[110] flex items-end bg-black/75 p-0 sm:items-center sm:justify-center sm:p-4"
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) {
                    event.stopPropagation();
                    closeDeleteConfirmation();
                  }
                }}
              >
                <section
                  ref={confirmationRef}
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="delete-notifications-title"
                  aria-describedby="delete-notifications-description"
                  className="w-full rounded-t-3xl border border-red-400/25 bg-[#121212] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-red-300">Acción permanente</p>
                  <h2 id="delete-notifications-title" className="mt-2 text-xl font-black">Borrar todas las notificaciones</h2>
                  <p id="delete-notifications-description" className="mt-3 text-sm text-zinc-300">Se eliminarán todas tus notificaciones.</p>
                  {deleteError && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{deleteError}</p>}
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      ref={cancelDeleteRef}
                      type="button"
                      disabled={deleting}
                      onClick={closeDeleteConfirmation}
                      className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-300 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-yellow-300"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void deleteAllNotifications()}
                      className="min-h-11 rounded-xl border border-red-400/40 bg-red-400/10 px-4 text-sm font-black text-red-200 transition hover:bg-red-400/20 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-300"
                    >
                      {deleting ? "Borrando…" : "Borrar todo"}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void loadNotifications();
        }}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-800 text-zinc-300 transition hover:border-yellow-400/30 hover:bg-yellow-400/10 hover:text-yellow-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
        aria-label={`Notificaciones${unreadCount ? `, ${unreadCount} sin leer` : ""}`}
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-yellow-400 px-1 text-center text-[10px] font-black leading-5 text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 fill-none stroke-current"
      strokeWidth="1.8"
    >
      <path
        d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8ZM10 21h4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminNotificationCenter() {
  return <NotificationCenter audience="trainer" />;
}

export function StudentNotificationCenter() {
  return <NotificationCenter audience="student" />;
}
