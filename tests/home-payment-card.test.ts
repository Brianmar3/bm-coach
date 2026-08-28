import assert from "node:assert/strict";
import test from "node:test";
import { homePaymentCardCopy } from "../lib/home-payment-card.ts";

const today = "2026-08-27";

test("Tu cuota presenta el estado al día con el próximo vencimiento", () => {
  assert.deepEqual(homePaymentCardCopy("AL_DIA", "2026-09-25", today), {
    title: "Al día",
    detail: "Próximo vencimiento: 25/09",
    tone: "current",
  });
});

test("Tu cuota distingue vencimiento próximo y vencimiento de hoy", () => {
  assert.deepEqual(homePaymentCardCopy("VENCE_PRONTO", "2026-08-30", today), {
    title: "Vence el 30/08",
    detail: "Faltan 3 días",
    tone: "due-soon",
  });
  assert.deepEqual(homePaymentCardCopy("VENCE_PRONTO", today, today), {
    title: "Vence hoy",
    detail: "27/08",
    tone: "due-soon",
  });
});

test("Tu cuota informa cuánto tiempo lleva vencida", () => {
  assert.deepEqual(homePaymentCardCopy("VENCIDA", "2026-08-25", today), {
    title: "Vencida",
    detail: "Venció hace 2 días",
    tone: "overdue",
  });
});

test("Tu cuota orienta al alumno cuando todavía no está configurada", () => {
  assert.deepEqual(homePaymentCardCopy("SIN_CONFIGURAR", "", today), {
    title: "Sin configurar",
    detail: "Consultar con tu entrenador",
    tone: "neutral",
  });
});
