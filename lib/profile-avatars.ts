export const PROFILE_AVATARS = [
  { id: "athlete-man-01", label: "Avatar 01", src: "/avatars/bm-athlete-man-v3.webp" },
  { id: "athlete-woman-01", label: "Avatar 02", src: "/avatars/bm-athlete-woman-v3.webp" },
  { id: "coach-man-01", label: "Avatar 03", src: "/avatars/bm-coach-man-v3.webp" },
  { id: "coach-woman-01", label: "Avatar 04", src: "/avatars/bm-coach-woman-v3.webp" },
  { id: "runner-man-01", label: "Avatar 05", src: "/avatars/bm-runner-man-v3.webp" },
  { id: "runner-woman-01", label: "Avatar 06", src: "/avatars/bm-runner-woman-v3.webp" },
  { id: "functional-woman-01", label: "Avatar 07", src: "/avatars/bm-ball-woman-v3.webp" },
  { id: "functional-man-01", label: "Avatar 08", src: "/avatars/bm-battlerope-man-v3.webp" },
  { id: "boxer-man-01", label: "Avatar 09", src: "/avatars/bm-box-man-v3.webp" },
  { id: "boxer-woman-01", label: "Avatar 10", src: "/avatars/bm-box-woman-v3.webp" },
  { id: "strength-man-01", label: "Avatar 11", src: "/avatars/bm-isometric-man-v3.webp" },
  { id: "cardio-man-01", label: "Avatar 12", src: "/avatars/bm-jump-man-v3.webp" },
  { id: "mobility-woman-01", label: "Avatar 13", src: "/avatars/bm-streching-woman-v3.webp" },
  { id: "strength-woman-01", label: "Avatar 14", src: "/avatars/bm-strength-woman-v3.webp" },
  ...Array.from({ length: 18 }, (_, index) => ({
    id: `bm-avatar-${String(index + 1).padStart(2, "0")}`,
    label: `Avatar ${String(index + 15).padStart(2, "0")}`,
    src: `/avatars/bm-avatar-${String(index + 1).padStart(2, "0")}.webp`,
  })),
];

// Fallback histórico: no forma parte de la galería seleccionable.
export const DEFAULT_PROFILE_AVATAR = { id: "bm-shield-01", label: "Avatar predeterminado", src: "/avatars/bm-shield-v3.webp" };

export function profileAvatarById(id: string) {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id);
}

export function profileAvatarBySrc(src: string) {
  return PROFILE_AVATARS.find((avatar) => avatar.src === src);
}
