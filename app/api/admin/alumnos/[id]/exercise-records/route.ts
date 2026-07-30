import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthError,
  verifyAdminSessionValue,
} from "@/lib/admin-auth";
import { loadUnifiedExerciseRecords } from "@/lib/unified-exercise-records";

async function authorize() {
  const auth = verifyAdminSessionValue(
    (await cookies()).get(ADMIN_SESSION_COOKIE)?.value,
  );
  return auth.ok ? null : adminAuthError(auth);
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/alumnos/[id]/exercise-records">,
) {
  const failure = await authorize();
  if (failure) {
    return Response.json({ error: failure.error }, { status: failure.status });
  }
  const { id } = await context.params;
  const records = await loadUnifiedExerciseRecords(id);
  return Response.json({ records });
}
