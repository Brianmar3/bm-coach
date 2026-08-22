import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hasTransferDetails, normalizeTransferDetails, openTransferObligations, transferCopyText } from "../lib/transfer-payment.ts";
import type { PortalPaymentObligation } from "../types/portal.ts";

const pending: PortalPaymentObligation = {
  id: "pending-1",
  period: "2026-08-01",
  expectedAmount: 30000,
  paidAmount: 10000,
  balance: 20000,
  dueDate: "2026-08-10",
  status: "PARTIAL",
};

test("normaliza los datos configurados y no inventa valores ausentes", () => {
  assert.deepEqual(normalizeTransferDetails({ holder: " Brian ", alias: " bm.training ", accountNumber: "000 123", institution: " Banco " }), {
    holder: "Brian",
    alias: "bm.training",
    accountNumber: "000123",
    institution: "Banco",
  });
  assert.equal(hasTransferDetails(null), false);
  assert.equal(hasTransferDetails({ alias: "bm.training" }), true);
});

test("sólo habilita transferencia para obligaciones con saldo real abierto", () => {
  const paid: PortalPaymentObligation = { ...pending, id: "paid", paidAmount: 30000, balance: 0, status: "PAID" };
  const voided: PortalPaymentObligation = { ...pending, id: "void", status: "VOID" };
  assert.deepEqual(openTransferObligations([paid, voided, pending]).map((item) => item.id), ["pending-1"]);
  assert.equal(openTransferObligations([paid]).length, 0);
});

test("copiar todos incluye importe dinámico y únicamente datos presentes", () => {
  const copied = transferCopyText({ holder: "Brian", alias: "bm.training", accountNumber: "", institution: "Billetera" }, 20000);
  assert.match(copied, /^Transferencia BM Training/);
  assert.match(copied, /Titular: Brian/);
  assert.match(copied, /Alias: bm\.training/);
  assert.match(copied, /Importe: \$\s?20\.000/);
  assert.doesNotMatch(copied, /CBU\/CVU:/);
});

test("el portal usa un modal informativo accesible sin confirmar ni crear pagos", () => {
  const sheet = readFileSync("componentes/portal-transfer-payment-sheet.tsx", "utf8");
  const portal = readFileSync("componentes/portal-section.tsx", "utf8");
  const route = readFileSync("app/api/portal/data/route.ts", "utf8");
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /navigator\.clipboard\.writeText/);
  assert.match(sheet, /Datos de transferencia no disponibles/);
  assert.match(sheet, /únicamente informativo/);
  assert.doesNotMatch(sheet, /Ya transferí|Confirmar pago|method:\s*["']POST["']/);
  assert.match(portal, /openTransferObligations\(data\.paymentObligations\)/);
  assert.match(route, /monthlyStudentObligation\.findMany/);
  assert.match(route, /studentPayment\.groupBy/);
});

test("la configuración mantiene los datos bancarios fuera de Prisma", () => {
  const configuration = readFileSync("app/configuracion/page.tsx", "utf8");
  const store = readFileSync("app/api/store/[collection]/route.ts", "utf8");
  assert.match(configuration, /Datos para transferencias/);
  assert.match(configuration, /CBU o CVU/);
  assert.match(store, /normalizeTransferDetails/);
});
