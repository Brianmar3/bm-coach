import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import * as dates from "../lib/payment-dates.ts";

test("anular un pago viejo no revierte el vencimiento establecido por otro pago del mismo día", async () => {
  const paidDate = dates.dateKeyToDatabase("2026-10-09");
  const first = { id: "first", studentId: "a", status: "PAGADO", paidDate, createdAt: new Date("2026-10-09T10:00:00Z"), dueDate: dates.dateKeyToDatabase("2026-10-09"), nextDueDateSnapshot: dates.dateKeyToDatabase("2026-11-09"), student: { data: { dueDate: "2026-11-09" } } };
  const second = { ...first, id: "second", createdAt: new Date("2026-10-09T11:00:00Z") };
  for (const laterExists of [true, false]) {
    let dueDateWrites = 0;
    const tx = {
      studentPayment: {
        findUnique: async () => first,
        findFirst: async ({ where }: { where: { paidDate?: { gt: Date }; OR?: Array<{ paidDate?: { gt: Date }; createdAt?: { gt: Date } }> } }) => {
          if (!laterExists) return null;
          const terms = where.OR ?? [where];
          return terms.some(term => term.paidDate && second.paidDate > term.paidDate.gt || term.createdAt && second.createdAt > term.createdAt.gt) ? second : null;
        },
        update: async () => ({ ...first, status: "ANULADO" }),
      },
      studentRecord: { update: async () => { dueDateWrites++; } },
    };
    const deps: Record<string, unknown> = {
      "@prisma/client": { Prisma }, "@/lib/prisma": { prisma: { $transaction: async (run: (value: unknown) => Promise<unknown>) => run(tx) } },
      "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: "wa" }) }, "@/lib/payment-dates": dates,
      "@/lib/payments": { storedStudent: (value: unknown) => value, serializePayment: (value: unknown) => value, paymentDashboard: async () => ({}) },
    };
    const code = ts.transpileModule(readFileSync("app/api/pagos/[id]/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {} as { PATCH: (request: Request, context: unknown) => Promise<Response> };
    new Function("require", "exports", code)((name: string) => deps[name], exports);
    const response = await exports.PATCH(new Request("https://test.local/api/pagos/first", { method: "PATCH", body: JSON.stringify({ action: "void", reason: "Carga equivocada" }) }), { params: Promise.resolve({ id: "first" }) });
    assert.equal(response.status, 200);
    assert.equal(dueDateWrites, laterExists ? 0 : 1);
  }
});
