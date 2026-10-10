import { QuickLogHistory } from "@/componentes/quick-log";

export default async function PortalQuickLogPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const params = await searchParams;
  return <QuickLogHistory key={params.new === "1" ? "create" : "history"} startCreating={params.new === "1"} />;
}
