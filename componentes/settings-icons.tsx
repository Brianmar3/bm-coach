import type { ReactNode } from "react";

export type SettingsIconName =
  | "bell"
  | "security"
  | "privacy"
  | "preferences"
  | "help"
  | "logout";

const paths: Record<SettingsIconName, ReactNode> = {
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  security: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  privacy: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  preferences: <><path d="M4 7h4M12 7h8M4 17h8M16 17h4" /><circle cx="10" cy="7" r="2" /><circle cx="14" cy="17" r="2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.15c-.83.43-1.3.95-1.3 1.85" /><path d="M12 17h.01" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></>,
};

export function SettingsIcon({
  name,
  className = "size-6",
}: {
  name: SettingsIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
