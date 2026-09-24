import { redirect } from "next/navigation";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";

export default async function PlatformInvitationsPage() {
  await requirePlatformOwnerPage();
  redirect("/platform/trainers?view=invitations");
}
