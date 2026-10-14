import type { CSSProperties } from "react";
import Link from "next/link";
import { invitationOutcomeContent, STUDENT_LOGIN_URL, type InvitationOutcome } from "@/lib/student-invitation-access";
import { workspaceBrandingVariables } from "@/lib/workspace-branding";

export function StudentInvitationOutcome({ status, branding }: { status: InvitationOutcome; branding?: { displayName: string; accentColor: string } }) {
  const content = invitationOutcomeContent(status);
  return <main className="workspace-brand grid min-h-[100dvh] place-items-center bg-black p-4 text-white" style={workspaceBrandingVariables(branding?.accentColor) as CSSProperties}><section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><p className="text-xs font-black uppercase tracking-widest text-[var(--brand-text)]">{branding?.displayName ?? "BM Training"}</p><h1 className="mt-3 text-2xl font-black">{content.title}</h1><p className="mt-3 text-zinc-300">{content.description}</p>{content.login && <><Link href={STUDENT_LOGIN_URL} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-[var(--bm-accent)] px-4 font-bold text-[var(--bm-accent-contrast)]">Ingresar</Link><p className="mt-4 break-words text-sm text-zinc-400">Tu acceso permanente: <Link href={STUDENT_LOGIN_URL} className="text-[var(--brand-text)] underline">/portal/login?mode=student</Link></p></>}</section></main>;
}
