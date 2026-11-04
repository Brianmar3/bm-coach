import { ModuleShell } from "@/componentes/module-shell";
import { RoutineFollowUpDashboard } from "@/componentes/routine-follow-up-dashboard";

type FollowUpParams = { studentId?: string; sessionId?: string; studentIds?: string; sessionIds?: string };

export default async function FollowUpPage({ searchParams }: { searchParams: Promise<FollowUpParams> }) {
  const params = await searchParams;
  const value = (input: unknown) => typeof input === "string" ? input : "";
  return <ModuleShell title="Seguimiento" subtitle="Seguimiento de entrenamientos" hideHeader>
    <RoutineFollowUpDashboard initialStudentId={value(params.studentId)} initialSessionId={value(params.sessionId)} initialStudentIds={value(params.studentIds).split(",").filter(Boolean)} initialSessionIds={value(params.sessionIds).split(",").filter(Boolean)} />
  </ModuleShell>;
}
