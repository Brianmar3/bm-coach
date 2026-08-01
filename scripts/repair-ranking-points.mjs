import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  buildRepairPlan,
  executeRepairMode,
  normalizePersonName,
  resolveRepairMode,
  summarizeRepair,
} from "./ranking-repair-core.mjs";

let mode;
try {
  mode = resolveRepairMode(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Argumentos inválidos.");
  process.exit(2);
}

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

const prisma = new PrismaClient();
const noon = (value) => new Date(`${new Date(value).toISOString().slice(0, 10)}T12:00:00.000Z`);
const studentLabel = (data) => {
  const value = data && typeof data === "object" ? data : {};
  return [value.firstName ?? value.nombre, value.lastName ?? value.apellido].filter(Boolean).join(" ") || "Alumno sin nombre";
};

try {
  const transactions = await prisma.studentPointTransaction.findMany({
    where: { active: true },
    select: {
      id: true, studentId: true, eventKey: true, sourceType: true, sourceId: true,
      points: true, description: true, occurredAt: true,
      student: { select: { data: true } },
    },
    orderBy: [{ studentId: "asc" }, { occurredAt: "asc" }],
  });
  const ids = (sourceType) => transactions.filter((item) => item.sourceType === sourceType && item.sourceId).map((item) => item.sourceId);
  const [legacy, occurrence, quickLogs, sessions] = await Promise.all([
    prisma.classAttendance.findMany({ where: { id: { in: ids("LEGACY_ATTENDANCE") } }, select: { id: true, date: true, status: true } }),
    prisma.classOccurrenceAttendance.findMany({ where: { id: { in: ids("CLASS_OCCURRENCE_ATTENDANCE") } }, select: { id: true, actualAttendance: true, occurrence: { select: { date: true, status: true } } } }),
    prisma.quickLog.findMany({ where: { id: { in: ids("QUICK_LOG") } }, select: { id: true, date: true } }),
    prisma.workoutSession.findMany({ where: { id: { in: ids("WORKOUT_SESSION") } }, select: { id: true, date: true, status: true } }),
  ]);
  const maps = {
    LEGACY_ATTENDANCE: new Map(legacy.map((item) => [item.id, { valid: item.status === "PRESENT", date: item.date }])),
    CLASS_OCCURRENCE_ATTENDANCE: new Map(occurrence.map((item) => [item.id, { valid: item.actualAttendance === "PRESENT" && item.occurrence.status !== "CANCELLED", date: item.occurrence.date }])),
    QUICK_LOG: new Map(quickLogs.map((item) => [item.id, { valid: true, date: item.date }])),
    WORKOUT_SESSION: new Map(sessions.map((item) => [item.id, { valid: item.status === "COMPLETED", date: item.date }])),
  };
  const namedTransactions = transactions.map((item) => ({ ...item, student: studentLabel(item.student.data) }));
  const changes = buildRepairPlan(namedTransactions, maps, noon);
  let result = { applied: 0, omitted: 0, errors: 0 };
  let applyError = null;
  if (mode === "apply") {
    try {
      result = await executeRepairMode(prisma, mode, changes);
    } catch (error) {
      applyError = error;
      result = { applied: 0, omitted: 0, errors: 1 };
    }
  }
  const summary = summarizeRepair(namedTransactions, changes, result);
  const allStudents = await prisma.studentRecord.findMany({ select: { id: true, data: true } });
  const torrasca = allStudents.filter((record) => {
    const normalized = normalizePersonName(studentLabel(record.data));
    return normalized === "roman torrasca" || normalized.endsWith(" torrasca") || normalized === "torrasca";
  }).map((record) => {
    const active = namedTransactions.filter((item) => item.studentId === record.id);
    const detected = changes.filter((item) => item.studentId === record.id && item.action === "INVALIDATE");
    return {
      storedName: studentLabel(record.data),
      invalidMovements: detected.length,
      invalidPoints: detected.reduce((sum, item) => sum + item.points, 0),
      validMovements: active.length - detected.length,
      validPoints: active.filter((item) => !detected.some((change) => change.transactionId === item.id)).reduce((sum, item) => sum + item.points, 0),
    };
  });
  console.log(JSON.stringify({ mode, summary, romanTorrasca: torrasca.length ? torrasca : [{ status: "No aparece en los alumnos almacenados." }], changes }, null, 2));
  if (applyError) throw applyError;
} finally {
  await prisma.$disconnect();
}
