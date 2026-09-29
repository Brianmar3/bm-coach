import { createPaymentReminders, sendPaymentReminderPush } from "@/lib/payment-notifications";
import {
  createServiceExpirationReminders,
  sendServiceExpirationReminder,
} from "@/lib/service-expiration-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const [paymentReminders, serviceReminders] = await Promise.all([
      createPaymentReminders(),
      createServiceExpirationReminders(),
    ]);
    for (const reminder of paymentReminders) {
      await sendPaymentReminderPush(reminder).catch((error) => {
        console.error("No se pudo enviar un push de cuota", error);
      });
    }
    for (const reminder of serviceReminders) {
      await sendServiceExpirationReminder(reminder).catch((error) => {
        console.error("No se pudo enviar un push de vencimiento de servicio", error);
      });
    }
    return Response.json({
      ok: true,
      created: paymentReminders.length + serviceReminders.length,
      paymentCreated: paymentReminders.length,
      serviceCreated: serviceReminders.length,
    });
  } catch (error) {
    console.error("No se pudieron procesar los recordatorios de pago", error);
    return Response.json({ error: "No se pudieron procesar los recordatorios." }, { status: 500 });
  }
}
