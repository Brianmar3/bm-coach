import type { ReactNode } from "react";

export type BmIconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
};

type IconDefinition = ReactNode;

function createBmIcon(name: string, definition: IconDefinition) {
  function BmIcon({ size = 24, className, strokeWidth = 1.8, title }: BmIconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
        focusable="false"
      >
        {title && <title>{title}</title>}
        {definition}
      </svg>
    );
  }
  BmIcon.displayName = name;
  return BmIcon;
}

// Navigation
export const BmHomeIcon = createBmIcon("BmHomeIcon", <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>);
export const BmClassesIcon = createBmIcon("BmClassesIcon", <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18M7 14h2M15 14h2M7 18h2" /></>);
export const BmRoutineIcon = createBmIcon("BmRoutineIcon", <><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" /></>);
export const BmNutritionIcon = createBmIcon("BmNutritionIcon", <><circle cx="12" cy="13" r="7" /><path d="M3 3v7M6 3v7M4.5 3v7M19 3v18M19 3c2 2 2 5 0 7" /></>);
export const BmAppleIcon = createBmIcon("BmAppleIcon", <><path d="M12 7.2C10.2 5 6.1 4.7 4.6 7.5 2.3 11.8 5.5 19 8.2 20.7c1.2.8 2.2-.7 3.8-.7s2.6 1.5 3.8.7c2.7-1.7 5.9-8.9 3.6-13.2C17.9 4.7 13.8 5 12 7.2Z" /><path d="M12 7.2c-.2-2.8 1.2-4.6 4-5.2M13.5 3.8c-1.4-.8-2.8-.8-4.1-.2" /></>);
export const BmEvaluationIcon = createBmIcon("BmEvaluationIcon", <><path d="M6 2h9l4 4v16H6zM15 2v5h5" /><path d="m9 17 3-4 2 2 3-5" /></>);
export const BmProfileIcon = createBmIcon("BmProfileIcon", <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const BmUserIcon = BmProfileIcon;
export const BmUserPlusIcon = createBmIcon("BmUserPlusIcon", <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" /></>);

// Account and settings
export const BmSettingsIcon = createBmIcon("BmSettingsIcon", <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.5v-.1A1.7 1.7 0 0 0 8.4 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4 15a1.7 1.7 0 0 0-.6-1A1.7 1.7 0 0 0 2.3 13H2V9h.3A1.7 1.7 0 0 0 4 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.46 3.2l.06.06A1.7 1.7 0 0 0 8.4 3.6a1.7 1.7 0 0 0 1-.6A1.7 1.7 0 0 0 9.8 2H14v.1A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.9V13h-.9a1.7 1.7 0 0 0-1.7 2Z" /></>);
export const BmBellIcon = createBmIcon("BmBellIcon", <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>);
export const BmShieldCheckIcon = createBmIcon("BmShieldCheckIcon", <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>);
export const BmLockIcon = createBmIcon("BmLockIcon", <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>);
export const BmSlidersIcon = createBmIcon("BmSlidersIcon", <><path d="M4 7h4M12 7h8M4 17h8M16 17h4" /><circle cx="10" cy="7" r="2" /><circle cx="14" cy="17" r="2" /></>);
export const BmHelpCircleIcon = createBmIcon("BmHelpCircleIcon", <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.15c-.83.43-1.3.95-1.3 1.85M12 17h.01" /></>);
export const BmLogoutIcon = createBmIcon("BmLogoutIcon", <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></>);

// General actions
export const BmPlusIcon = createBmIcon("BmPlusIcon", <path d="M12 5v14M5 12h14" />);
export const BmEditIcon = createBmIcon("BmEditIcon", <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>);
export const BmBackIcon = createBmIcon("BmBackIcon", <><path d="m15 18-6-6 6-6M9 12h12" /></>);
export const BmChevronRightIcon = createBmIcon("BmChevronRightIcon", <path d="m9 18 6-6-6-6" />);
export const BmCloseIcon = createBmIcon("BmCloseIcon", <path d="m6 6 12 12M18 6 6 18" />);
export const BmDeleteIcon = createBmIcon("BmDeleteIcon", <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>);
export const BmSearchIcon = createBmIcon("BmSearchIcon", <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>);
export const BmFilterIcon = createBmIcon("BmFilterIcon", <path d="M3 5h18l-7 8v6l-4 2v-8Z" />);
export const BmMoreIcon = createBmIcon("BmMoreIcon", <><circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" /></>);
export const BmCopyIcon = createBmIcon("BmCopyIcon", <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>);
export const BmCheckIcon = createBmIcon("BmCheckIcon", <path d="m5 12 4 4L19 6" />);
export const BmEyeIcon = createBmIcon("BmEyeIcon", <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const BmEyeOffIcon = createBmIcon("BmEyeOffIcon", <><path d="m3 3 18 18M10.6 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.2 3M6.5 6.5C3.5 8.4 2 12 2 12s3.5 6 10 6a10 10 0 0 0 4.1-.8M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>);

// Progress and business
export const BmRankingIcon = createBmIcon("BmRankingIcon", <><path d="M4 20v-5h5v5M9 20V9h6v11M15 20v-7h5v7M2 20h20" /><path d="m10 6 2-3 2 3" /></>);
export const BmPointsIcon = createBmIcon("BmPointsIcon", <><circle cx="12" cy="13" r="7" /><path d="m9 3 3 4 3-4M12 10l1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L9 12.3l2-.3Z" /></>);
export const BmTrophyIcon = createBmIcon("BmTrophyIcon", <><path d="M8 4h8v4a4 4 0 0 1-8 0ZM10 16h4M12 12v4M8 20h8" /><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4" /></>);
export const BmMedalIcon = createBmIcon("BmMedalIcon", <><path d="m8 3 4 6 4-6M6 3l4 7M18 3l-4 7" /><circle cx="12" cy="15" r="5" /></>);
export const BmCrownIcon = createBmIcon("BmCrownIcon", <><path d="m3 7 4 4 5-7 5 7 4-4-2 10H5Z" /><path d="M5 20h14" /></>);
export const BmAttendanceIcon = createBmIcon("BmAttendanceIcon", <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18m-12 6 2 2 4-4" /></>);
export const BmCalendarIcon = createBmIcon("BmCalendarIcon", <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></>);
export const BmBirthdayIcon = BmCalendarIcon;
export const BmPaymentIcon = createBmIcon("BmPaymentIcon", <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>);
export const BmWalletIcon = createBmIcon("BmWalletIcon", <><path d="M4 6h14a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h11" /><path d="M15 11h7v5h-7a2.5 2.5 0 0 1 0-5Z" /></>);
export const BmTargetIcon = createBmIcon("BmTargetIcon", <><circle cx="11" cy="13" r="8" /><circle cx="11" cy="13" r="4" /><path d="m14 10 7-7M17 3h4v4" /></>);
export const BmProgressIcon = createBmIcon("BmProgressIcon", <><path d="M4 20v-6M9 20V9M14 20v-4M19 20V5" /><path d="m3 12 5-4 5 2 7-7" /></>);
export const BmHistoryIcon = createBmIcon("BmHistoryIcon", <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>);
export const BmChartIcon = createBmIcon("BmChartIcon", <><path d="M4 20V10M9 20V6M14 20v-7M19 20V4M2 20h20" /></>);

// Training and tools
export const BmDumbbellIcon = BmRoutineIcon;
export const BmBarbellIcon = createBmIcon("BmBarbellIcon", <><path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12" /></>);
export const BmTimerIcon = createBmIcon("BmTimerIcon", <><circle cx="12" cy="13" r="8" /><path d="M12 9v5l3 2M9 2h6M12 2v3" /></>);
export const BmChallengeIcon = createBmIcon("BmChallengeIcon", <path d="m13 2-8 12h7l-1 8 8-12h-7Z" />);
export const BmWorkoutIcon = createBmIcon("BmWorkoutIcon", <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M8 10h8M8 14h5" /></>);
export const BmClipboardIcon = createBmIcon("BmClipboardIcon", <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M9 5V3h6v2M8 12l2 2 5-5" /></>);
export const BmFlameIcon = createBmIcon("BmFlameIcon", <path d="M12 22c4 0 7-3 7-7 0-3-2-6-5-9 0 3-1 4-2 5-1-3-3-5-5-7 0 5-2 7-2 11 0 4 3 7 7 7Z" />);
export const BmWeightIcon = createBmIcon("BmWeightIcon", <><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M9 7a3 3 0 0 1 6 0M12 11v4" /></>);
export const BmMeasurementsIcon = createBmIcon("BmMeasurementsIcon", <><path d="m4 16 12-12 4 4L8 20Z" /><path d="m11 9 2 2M8 12l2 2M14 6l2 2" /></>);
export const BmHealthIcon = createBmIcon("BmHealthIcon", <path d="M20.8 5.7a5 5 0 0 0-7.1 0L12 7.4l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.2a5 5 0 0 0 0-7.1Z" />);
export const BmHydrationIcon = createBmIcon("BmHydrationIcon", <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" />);

// Contact and information
export const BmPhoneIcon = createBmIcon("BmPhoneIcon", <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c1 .3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />);
export const BmMailIcon = createBmIcon("BmMailIcon", <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>);
export const BmInfoIcon = createBmIcon("BmInfoIcon", <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>);
