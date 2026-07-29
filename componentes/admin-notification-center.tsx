"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type TrainerNotification = {
  id: string;
  type: "CLASS_RESPONSE";
  title: string;
  message: string;
  url: string;
  response: "GOING" | "NOT_GOING";
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  notifications: TrainerNotification[];
  unreadCount: number;
};

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminNotificationCenter() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<TrainerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as NotificationsResponse;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markRead(id: string) {
    const response = await fetch("/api/admin/notifications", {
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
    const response = await fetch("/api/admin/notifications", {
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

  async function openNotification(notification: TrainerNotification) {
    if (!notification.readAt) await markRead(notification.id);
    setOpen(false);
    router.push(notification.url);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void loadNotifications();
        }}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 text-zinc-300 transition hover:border-yellow-400/30 hover:bg-yellow-400/10 hover:text-yellow-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
        aria-label={`Notificaciones${unreadCount ? `, ${unreadCount} sin leer` : ""}`}
        aria-expanded={open}
      >
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
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-yellow-400 px-1 text-center text-[10px] font-black leading-5 text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none" />
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Centro de notificaciones"
            className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[80] flex max-h-[min(72dvh,38rem)] flex-col overflow-hidden rounded-2xl border border-yellow-400/20 bg-zinc-950 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-20 sm:top-[calc(env(safe-area-inset-top)+4rem)] sm:w-[25rem]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <div>
                <p className="font-bold text-white">Notificaciones</p>
                <p className="text-xs text-zinc-500">
                  Respuestas de asistencia recientes
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-yellow-300 hover:bg-yellow-400/10"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain">
              {loading ? (
                <p className="p-5 text-sm text-zinc-500">
                  Cargando notificaciones…
                </p>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-semibold text-zinc-300">
                    No hay notificaciones
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Las respuestas de los alumnos aparecerán acá.
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
        </>
      )}
    </>
  );
}
