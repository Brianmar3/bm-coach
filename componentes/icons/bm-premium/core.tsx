import { createBmIcon } from "./icon";

// Core family. Each silhouette fits the same grid, with an open, quiet contour.
export const BmHomeIcon = createBmIcon("BmHomeIcon", <><path d="m3 10 9-7 9 7"/><path d="M5.5 9.5V20h4v-6h5v6h4V9.5"/></>);
export const BmRoutineIcon = createBmIcon("BmRoutineIcon", <><rect x="5" y="6" width="3" height="12" rx="1"/><rect x="16" y="6" width="3" height="12" rx="1"/><path d="M8 12h8M2.5 9v6M21.5 9v6"/></>);
export const BmClassesIcon = createBmIcon("BmClassesIcon", <><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17"/><path d="M7.5 14h1M15.5 14h1M7.5 17.5h1"/><circle cx="16" cy="17.5" r="1" fill="currentColor" stroke="none"/></>);
export const BmNutritionIcon = createBmIcon("BmNutritionIcon", <><path d="M12 8c-2-1.8-5.7-2-7.3.9-2 3.9.4 10.5 3.7 11.7 1.2.5 2.1-.6 3.6-.6s2.4 1.1 3.6.6c3.3-1.2 5.7-7.8 3.7-11.7C17.7 6 14 6.2 12 8Z"/><path d="M12 8c.1-2-1-3.5-2.5-4.5M12.5 6.5c3.4.1 5.4-1.4 5.8-4-3.4-.1-5.4 1.4-5.8 4Z"/></>);
export const BmAppleIcon = BmNutritionIcon;
export const BmEvaluationIcon = createBmIcon("BmEvaluationIcon", <><path d="M14.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5L14.5 3Z"/><path d="M14.5 3v5.5H20M8 7h3M8 10.5h3M8 17l3-3 3 1 3-4M14 11h3v3"/></>);
export const BmStudentsIcon = createBmIcon("BmStudentsIcon", <><circle cx="9" cy="7" r="3.5"/><path d="M3 20v-2.5A5.5 5.5 0 0 1 8.5 12h1a5.5 5.5 0 0 1 5.5 5.5V20H3Z"/><path d="M16 4.5a3 3 0 0 1 0 6M18 13a4.5 4.5 0 0 1 3 4.5V20h-3"/></>);
export const BmTargetIcon = createBmIcon("BmTargetIcon", <><path d="M19.5 10a8.5 8.5 0 1 1-5.5-5.5M15.5 11.5A4.5 4.5 0 1 1 11 7"/><path d="m11 13 9-9M16 4h4v4"/><circle cx="11" cy="13" r=".8" fill="currentColor" stroke="none"/></>);
export const BmFocusIcon = createBmIcon("BmFocusIcon", <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></>);
export const BmProgressIcon = createBmIcon("BmProgressIcon", <><path d="M4 20v-3M9 20v-5M14 20v-7M19 20v-9"/><path d="M3.5 12.5 8.5 9l4 1 7-6M15.5 4h4v4"/></>);
export const BmDiscomfortIcon = createBmIcon("BmDiscomfortIcon", <><path d="M9.5 8V7a3.5 3.5 0 1 1 7-1M9.5 8 6 9.5a4 4 0 0 0-2.5 3.7L3 20M7 13l.5 8h9l.5-5M19 15l2 5"/><circle cx="17" cy="10" r="3.5"/><circle cx="17" cy="10" r="1" fill="currentColor" stroke="none"/></>);
export const BmCalendarIcon = createBmIcon("BmCalendarIcon", <><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17M7.5 14h2M14.5 14h2M7.5 17.5h2M14.5 17.5h2"/></>);
export const BmTimerIcon = createBmIcon("BmTimerIcon", <><circle cx="12" cy="13.5" r="7.5"/><path d="M9.5 2.5h5M12 2.5V6M18.5 5.5l1.5 1.5M12 13.5l3.5-3.5"/><circle cx="12" cy="13.5" r=".75" fill="currentColor" stroke="none"/></>);
export const BmRankingIcon = createBmIcon("BmRankingIcon", <><path d="m6 3 4 6M18 3l-4 6M9 3l3 4 3-4"/><circle cx="12" cy="15" r="6"/><path d="m12 11.5 1 2 2.2.3-1.6 1.6.4 2.1-2-1-2 1 .4-2.1-1.6-1.6 2.2-.3 1-2Z"/></>);

// Profile data: separate metaphors rather than repeating the goal target.
export const BmHeightIcon = createBmIcon("BmHeightIcon", <><rect x="8" y="3" width="8" height="18" rx="1.5"/><path d="M8 7h4M8 12h3M8 17h4M4 5v14m-1.5-12L4 5l1.5 2m-3 10L4 19l1.5-2"/></>);
export const BmWeightIcon = createBmIcon("BmWeightIcon", <><rect x="3.5" y="4" width="17" height="17" rx="3"/><path d="M8 9a4.5 4.5 0 0 1 8 0M12 10l2-3M8 17h8"/></>);
export const BmMeasurementsIcon = createBmIcon("BmMeasurementsIcon", <><path d="m3.5 16 12.5-12.5L20.5 8 8 20.5l-4.5-4.5Z"/><path d="m7 12.5 2 2m2-6 2 2m2-6 2 2"/></>);
export const BmLevelIcon = createBmIcon("BmLevelIcon", <><rect x="3.5" y="15" width="4" height="6" rx="1"/><rect x="10" y="10" width="4" height="11" rx="1"/><rect x="16.5" y="3" width="4" height="18" rx="1"/></>);
export const BmBirthdayIcon = createBmIcon("BmBirthdayIcon", <><path d="M5 11h14v9H5v-9ZM3 20h18M12 11V7M5 15c1.5 2 3.2-2 4.7 0s3.1-2 4.6 0 3.2-2 4.7 0"/><path d="M12 3c-2 2-1.5 4 0 4s2-2 0-4Z"/></>);
export const BmDashboardIcon = createBmIcon("BmDashboardIcon", <><rect x="3.5" y="3.5" width="7" height="9" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/></>);
export const BmMonthlyIcon = createBmIcon("BmMonthlyIcon", <><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17M7.5 14h4M7.5 17.5h7M15 14h1.5"/></>);
export const BmMenuIcon = createBmIcon("BmMenuIcon", <path d="M4 6h16M4 12h12M4 18h16"/>);
export const BmDumbbellIcon = BmRoutineIcon;
export const BmBarbellIcon = BmRoutineIcon;
