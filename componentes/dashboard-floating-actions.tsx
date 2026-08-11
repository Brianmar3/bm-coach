"use client";

import { TrainerFloatingActions } from "@/componentes/trainer-floating-actions";

const actions = [
  { label: "Nuevo alumno", href: "/alumnos?accion=nuevo", symbol: "+" },
  { label: "Registrar pago", href: "/pagos", symbol: "$" },
  { label: "Tomar asistencia", href: "/asistencias", symbol: "✓" },
  { label: "Crear clase", href: "/clases", symbol: "C" },
  { label: "Nueva evaluación", href: "/evaluaciones", symbol: "E" },
  { label: "Agregar evento", href: "/eventos", symbol: "●" },
] as const;

export function DashboardFloatingActions({ enabled = true }: { enabled?: boolean }) {
  return <TrainerFloatingActions enabled={enabled} title="Agregar rápido" actions={[...actions]} />;
}
