import { redirect } from "next/navigation";
import { TrainerOnboarding } from "@/componentes/trainer-onboarding";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { prisma } from "@/lib/prisma";

export default async function TrainerOnboardingPage() {
  const actor = await requireTrainerWorkspace();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (user.onboardingCompleted) redirect("/dashboard");
  return <main className="grid min-h-screen place-items-center bg-zinc-950 p-5"><TrainerOnboarding initial={{ name: user.name, brandName: user.brandName || "", city: user.city || "", serviceType: user.serviceType || "MIXED" }}/></main>;
}
