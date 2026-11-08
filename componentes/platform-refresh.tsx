"use client";
import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
/** Only mounted on read-only Master pages. No writes or cross-workspace navigation. */
export function PlatformRefresh() {
 const router = useRouter();
 const [pending, startTransition] = useTransition();
 useEffect(() => {
  const refresh = () => { if (document.visibilityState === 'visible' && !document.querySelector('[role=dialog]')) startTransition(() => router.refresh()); };
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  const interval = window.setInterval(refresh, 60_000);
  return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.clearInterval(interval); };
 }, [router]);
 return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="min-h-11 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-300 disabled:opacity-50">{pending ? 'Actualizando…' : 'Actualizar datos'}</button>;
}
