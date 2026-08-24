import type { ComponentType } from "react";
import {
  BmBellIcon,
  BmHelpCircleIcon,
  BmLockIcon,
  BmLogoutIcon,
  BmShieldCheckIcon,
  BmSlidersIcon,
  type BmIconProps,
} from "@/componentes/icons";

export type SettingsIconName =
  | "bell"
  | "security"
  | "privacy"
  | "preferences"
  | "help"
  | "logout";

const settingsIcons: Record<SettingsIconName, ComponentType<BmIconProps>> = {
  bell: BmBellIcon,
  security: BmShieldCheckIcon,
  privacy: BmLockIcon,
  preferences: BmSlidersIcon,
  help: BmHelpCircleIcon,
  logout: BmLogoutIcon,
};

/** Compatibility adapter. New code should import icons from `@/componentes/icons`. */
export function SettingsIcon({
  name,
  className = "size-6",
}: {
  name: SettingsIconName;
  className?: string;
}) {
  const Icon = settingsIcons[name];
  return <Icon className={className} />;
}
