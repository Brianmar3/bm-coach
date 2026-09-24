import { PlatformTrainers } from "@/componentes/platform-trainers";

export default async function PlatformTrainersPage({ searchParams }: { searchParams: Promise<{ new?: string; view?: string; filter?: string }> }) {
  const query = await searchParams;
  return <main className="admin-page min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl"><PlatformTrainers initialInviteOpen={query.new === "1"} initialView={query.view === "invitations" ? "invitations" : "accounts"} initialFilter={query.filter} /></div></main>;
}
