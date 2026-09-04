import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { currentWeatherOrNull } from "@/lib/weather";

export const runtime = "nodejs";

export async function GET() {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;

  const weather = await currentWeatherOrNull();
  return Response.json(
    { weather },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
