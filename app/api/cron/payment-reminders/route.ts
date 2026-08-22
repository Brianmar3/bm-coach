import { createPaymentReminders, sendPaymentReminderPush } from "@/lib/payment-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const reminders = await createPaymentReminders();
    for (const reminder of reminders) {
      await sendPaymentReminderPush(reminder).catch((error) => {
        console.error("No se pudo programar el push de vencimiento", error);
      });
    }
    return Response.json({ ok: true, created: reminders.length });
  } catch (error) {
    console.error("No se pudieron procesar los recordatorios de pago", error);
    return Response.json({ error: "No se pudieron procesar los recordatorios." }, { status: 500 });
  }
}
