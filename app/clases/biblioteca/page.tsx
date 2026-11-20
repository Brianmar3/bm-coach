import { redirect } from "next/navigation";

export default function ClassLibraryPage() {
  redirect("/clases/planificacion?clases=completas");
}
