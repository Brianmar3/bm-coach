import "./nutrition.css";
import type { ReactNode } from "react";
import { NutritionAssistantDock } from "@/componentes/nutrition-assistant-dock";

export default function NutritionLayout({ children }: { children: ReactNode }) {
  return <NutritionAssistantDock>{children}</NutritionAssistantDock>;
}
