import { ModuleShell } from "@/componentes/module-shell";
import { PointsRanking } from "@/componentes/points-ranking";

export default function RankingPage() {
  return <ModuleShell title="Ranking por puntos" subtitle="Puntos, posiciones y movimientos registrados." hideHeader flushTop>
    <PointsRanking />
  </ModuleShell>;
}
