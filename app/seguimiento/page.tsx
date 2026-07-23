import { redirect } from "next/navigation";

export default function LegacyFollowUpPage() {
  redirect("/rutinas?tab=seguimiento");
}
