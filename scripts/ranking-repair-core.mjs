export function normalizePersonName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveRepairMode(args) {
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  const confirmed = args.includes("--confirm-ranking-repair");
  if (dryRun && apply) throw new Error("Elegí un único modo: --dry-run o --apply.");
  if (apply && !confirmed) throw new Error("--apply requiere también --confirm-ranking-repair. No se modificó ningún dato.");
  if (!dryRun && !apply) throw new Error("Indicá --dry-run para diagnosticar o --apply --confirm-ranking-repair para aplicar.");
  return apply ? "apply" : "dry-run";
}

export function buildRepairPlan(transactions, sourceMaps, effectiveDate) {
  const changes = [];
  for (const item of transactions) {
    if (item.sourceType === "ACHIEVEMENT") {
      changes.push({
        action: "INVALIDATE",
        reason: "Un logro derivado no es actividad puntuable independiente",
        studentId: item.studentId,
        student: item.student,
        transactionId: item.id,
        eventKey: item.eventKey,
        points: item.points,
      });
      continue;
    }
    const sourceMap = sourceMaps[item.sourceType];
    const source = sourceMap?.get(item.sourceId);
    if (sourceMap && (!source || !source.valid)) {
      changes.push({
        action: "INVALIDATE",
        reason: source ? "El evento fuente ya no es válido" : "No existe el evento fuente",
        studentId: item.studentId,
        student: item.student,
        transactionId: item.id,
        eventKey: item.eventKey,
        points: item.points,
      });
      continue;
    }
    if (source?.date) {
      const expected = effectiveDate(source.date);
      if (item.occurredAt.getTime() !== expected.getTime()) {
        changes.push({
          action: "CORRECT_DATE",
          reason: "Usar la fecha efectiva del evento",
          studentId: item.studentId,
          student: item.student,
          transactionId: item.id,
          eventKey: item.eventKey,
          points: item.points,
          from: item.occurredAt.toISOString(),
          to: expected.toISOString(),
        });
      }
    }
  }
  return changes;
}

export function summarizeRepair(transactions, changes, result = {}) {
  const invalid = changes.filter((item) => item.action === "INVALIDATE");
  const dateCorrections = changes.filter((item) => item.action === "CORRECT_DATE");
  const byStudent = new Map();
  for (const item of changes) {
    const current = byStudent.get(item.studentId) ?? {
      studentId: item.studentId,
      student: item.student,
      invalidMovements: 0,
      invalidPoints: 0,
      datesToCorrect: 0,
    };
    if (item.action === "INVALIDATE") {
      current.invalidMovements += 1;
      current.invalidPoints += item.points;
    } else {
      current.datesToCorrect += 1;
    }
    byStudent.set(item.studentId, current);
  }
  return {
    analyzed: transactions.length,
    invalidMovements: invalid.length,
    invalidPoints: invalid.reduce((sum, item) => sum + item.points, 0),
    datesToCorrect: dateCorrections.length,
    affectedStudents: byStudent.size,
    applied: result.applied ?? 0,
    omitted: result.omitted ?? 0,
    errors: result.errors ?? 0,
    byStudent: [...byStudent.values()].sort((left, right) => left.student.localeCompare(right.student, "es")),
  };
}

function assertAllowedChange(change) {
  if (change.action !== "INVALIDATE" && change.action !== "CORRECT_DATE") {
    throw new Error(`Acción no permitida: ${change.action}`);
  }
  if (!change.transactionId) throw new Error("La corrección no tiene transactionId.");
  if (change.action === "CORRECT_DATE" && (!change.from || !change.to)) {
    throw new Error("CORRECT_DATE requiere fecha anterior y fecha efectiva.");
  }
}

export async function applyRepairPlan(prisma, changes, now = new Date()) {
  changes.forEach(assertAllowedChange);
  return prisma.$transaction(async (transaction) => {
    let applied = 0;
    let omitted = 0;
    for (const change of changes) {
      const result = change.action === "INVALIDATE"
        ? await transaction.studentPointTransaction.updateMany({
            where: { id: change.transactionId, active: true },
            data: { active: false, invalidatedAt: now },
          })
        : await transaction.studentPointTransaction.updateMany({
            where: { id: change.transactionId, active: true, occurredAt: new Date(change.from) },
            data: { occurredAt: new Date(change.to) },
          });
      if (result.count === 1) applied += 1;
      else omitted += 1;
    }
    return { applied, omitted, errors: 0 };
  });
}

export async function executeRepairMode(prisma, mode, changes) {
  if (mode === "dry-run") return { applied: 0, omitted: 0, errors: 0 };
  if (mode !== "apply") throw new Error(`Modo no permitido: ${mode}`);
  return applyRepairPlan(prisma, changes);
}
