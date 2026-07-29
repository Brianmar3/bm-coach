export const PROFILE_AVATARS = [
  { id: "fitness-kettlebell-v2", label: "Kettlebell", src: "/avatars/bm-kettlebell-v2.webp" },
  { id: "fitness-dumbbell-v2", label: "Mancuerna", src: "/avatars/bm-dumbbell-v2.webp" },
  { id: "fitness-barbell-v2", label: "Barra con discos", src: "/avatars/bm-barbell-v2.webp" },
  { id: "fitness-stopwatch-v2", label: "Cronómetro", src: "/avatars/bm-stopwatch-v2.webp" },
  { id: "fitness-athlete-man-v2", label: "Atleta masculino", src: "/avatars/bm-athlete-man-v2.webp" },
  { id: "fitness-athlete-woman-v2", label: "Atleta femenina", src: "/avatars/bm-athlete-woman-v2.webp" },
  { id: "fitness-shield-v2", label: "Escudo fitness", src: "/avatars/bm-fitness-shield-v2.webp" },
] as const;

export function profileAvatarById(id: string) {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id);
}
