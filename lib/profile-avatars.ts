export const PROFILE_AVATARS = [
  { id: "athlete-man-01", label: "Atleta hombre", category: "Personajes", src: "/avatars/bm-athlete-man-v3.webp" },
  { id: "athlete-woman-01", label: "Atleta mujer", category: "Personajes", src: "/avatars/bm-athlete-woman-v3.webp" },
  { id: "coach-man-01", label: "Entrenador", category: "Personajes", src: "/avatars/bm-coach-man-v3.webp" },
  { id: "coach-woman-01", label: "Entrenadora", category: "Personajes", src: "/avatars/bm-coach-woman-v3.webp" },
  { id: "runner-man-01", label: "Corredor", category: "Personajes", src: "/avatars/bm-runner-man-v3.webp" },
  { id: "runner-woman-01", label: "Corredora", category: "Personajes", src: "/avatars/bm-runner-woman-v3.webp" },
  { id: "kettlebell-01", label: "Kettlebell", category: "Entrenamiento", src: "/avatars/bm-kettlebell-v3.webp" },
  { id: "dumbbell-01", label: "Mancuerna", category: "Entrenamiento", src: "/avatars/bm-dumbbell-v3.webp" },
  { id: "barbell-01", label: "Barra con discos", category: "Entrenamiento", src: "/avatars/bm-barbell-v3.webp" },
  { id: "stopwatch-01", label: "Cronómetro", category: "Entrenamiento", src: "/avatars/bm-stopwatch-v3.webp" },
  { id: "bm-shield-01", label: "Escudo BM", category: "Entrenamiento", src: "/avatars/bm-shield-v3.webp" },
  { id: "power-01", label: "Potencia", category: "Entrenamiento", src: "/avatars/bm-power-v3.webp" },
] as const;

export const DEFAULT_PROFILE_AVATAR = PROFILE_AVATARS[10];

export function profileAvatarById(id: string) {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id);
}
