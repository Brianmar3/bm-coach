import { redirect } from "next/navigation";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";

export default async function MembershipsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requirePlatformOwnerPage();
  const requested = (await searchParams).filter;
  const allowed = ["ALL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRING"];
  const filter = requested && allowed.includes(requested) ? requested : "ALL";
  redirect(`/platform/trainers?filter=${filter}`);
}
