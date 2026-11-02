import { StudentAttendanceHistoryView } from "@/componentes/student-attendance-history";

export default async function StudentAttendancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : undefined;
  return <StudentAttendanceHistoryView studentId={id} returnTo={value("returnTo")} initialQuery={new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string")).toString()}/>;
}
