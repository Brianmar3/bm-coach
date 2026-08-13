"use client";

import { TrainerFloatingActions } from "@/componentes/trainer-floating-actions";
import { quickAddCommands } from "@/lib/trainer-commands";

export function DashboardFloatingActions({ enabled = true }: { enabled?: boolean }) {
  return <TrainerFloatingActions enabled={enabled} mode="menu" title="Agregar rápido" actions={quickAddCommands} />;
}
