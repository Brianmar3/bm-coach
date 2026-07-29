export const PROFILE_AVATARS = [
  { id: "bm-ring", label: "Aro dorado", src: "/avatars/bm-ring.svg" },
  { id: "bm-bolt", label: "Energía", src: "/avatars/bm-bolt.svg" },
  { id: "bm-lines", label: "Líneas", src: "/avatars/bm-lines.svg" },
  { id: "bm-diamond", label: "Diamante", src: "/avatars/bm-diamond.svg" },
] as const;

export function profileAvatarById(id: string) {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id);
}
