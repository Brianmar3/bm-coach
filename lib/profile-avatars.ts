export const PROFILE_AVATARS = [
  { id: "athlete-man-01", label: "Atleta hombre", category: "Personajes", src: "/avatars/bm-athlete-man-v3.webp" },
  { id: "athlete-woman-01", label: "Atleta mujer", category: "Personajes", src: "/avatars/bm-athlete-woman-v3.webp" },
  { id: "coach-man-01", label: "Entrenador", category: "Personajes", src: "/avatars/bm-coach-man-v3.webp" },
  { id: "coach-woman-01", label: "Entrenadora", category: "Personajes", src: "/avatars/bm-coach-woman-v3.webp" },
  { id: "runner-man-01", label: "Corredor", category: "Personajes", src: "/avatars/bm-runner-man-v3.webp" },
  { id: "runner-woman-01", label: "Corredora", category: "Personajes", src: "/avatars/bm-runner-woman-v3.webp" },
  { id: "kettlebell-01", label: "Kettlebell", category: "Equipamiento", src: "/avatars/bm-kettlebell-v3.webp" },
  { id: "dumbbell-01", label: "Mancuerna", category: "Equipamiento", src: "/avatars/bm-dumbbell-v3.webp" },
  { id: "barbell-01", label: "Barra con discos", category: "Equipamiento", src: "/avatars/bm-barbell-v3.webp" },
  { id: "stopwatch-01", label: "Cronómetro", category: "Equipamiento", src: "/avatars/bm-stopwatch-v3.webp" },
  { id: "bm-shield-01", label: "Escudo BM", category: "Equipamiento", src: "/avatars/bm-shield-v3.webp" },
  { id: "power-01", label: "Potencia", category: "Equipamiento", src: "/avatars/bm-power-v3.webp" },
  { id: "functional-woman-01", label: "Funcional mujer", category: "Personajes", src: "/avatars/bm-ball-woman-v3.webp" },
  { id: "functional-man-01", label: "Funcional hombre", category: "Personajes", src: "/avatars/bm-battlerope-man-v3.webp" },
  { id: "boxer-man-01", label: "Boxeador", category: "Personajes", src: "/avatars/bm-box-man-v3.webp" },
  { id: "boxer-woman-01", label: "Boxeadora", category: "Personajes", src: "/avatars/bm-box-woman-v3.webp" },
  { id: "strength-man-01", label: "Fuerza hombre", category: "Personajes", src: "/avatars/bm-isometric-man-v3.webp" },
  { id: "cardio-man-01", label: "Cardio hombre", category: "Personajes", src: "/avatars/bm-jump-man-v3.webp" },
  { id: "mobility-woman-01", label: "Movilidad mujer", category: "Personajes", src: "/avatars/bm-streching-woman-v3.webp" },
  { id: "strength-woman-01", label: "Fuerza mujer", category: "Personajes", src: "/avatars/bm-strength-woman-v3.webp" },
] as const;

export const DEFAULT_PROFILE_AVATAR = PROFILE_AVATARS[10];

export function profileAvatarById(id: string) {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id);
}
