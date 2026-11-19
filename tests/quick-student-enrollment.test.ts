import test from "node:test";
import assert from "node:assert/strict";
import { parseQuickStudentLine, quickStudentBatchFits, quickStudentIssue } from "../lib/quick-student-enrollment.ts";

test("interpreta nombres solos y teléfonos opcionales", () => {
  assert.deepEqual(parseQuickStudentLine("Ana Pérez"), { firstName: "Ana", lastName: "Pérez", phone: "" });
  assert.deepEqual(parseQuickStudentLine("Juan Gómez, 3411234567"), { firstName: "Juan", lastName: "Gómez", phone: "3411234567" });
  assert.deepEqual(parseQuickStudentLine("Luz Ramos 3411234567"), { firstName: "Luz", lastName: "Ramos", phone: "3411234567" });
});

test("el lote completo respeta cupos activos y pendientes", () => {
  assert.equal(quickStudentBatchFits(20, 15, 2, 3), true);
  assert.equal(quickStudentBatchFits(20, 15, 2, 4), false);
  assert.equal(quickStudentBatchFits(null, 50, 5, 50), true);
});

test("marca entradas ambiguas, inválidas y duplicadas dentro del espacio consultado", () => {
  const ana = { firstName: "Ana", lastName: "Pérez", phone: "" };
  assert.match(quickStudentIssue(parseQuickStudentLine("Ana"), []) ?? "", /nombre y apellido/);
  assert.match(quickStudentIssue({ ...ana, phone: "abc" }, []) ?? "", /teléfono/);
  assert.match(quickStudentIssue({ firstName: "Ána", lastName: "Perez", phone: "" }, [ana]) ?? "", /existente/);
  assert.match(quickStudentIssue(ana, [], [ana]) ?? "", /esta carga/);
  assert.equal(quickStudentIssue(ana, [{ firstName: "Otra", lastName: "Persona", phone: "" }]), null);
});
