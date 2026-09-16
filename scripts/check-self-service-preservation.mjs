import assert from "node:assert/strict";
import process from "node:process";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

try {
  const students = await prisma.studentRecord.findMany({
    where: { data: { path: ["accountType"], equals: "SELF_SERVICE" } },
    select: {
      data: true,
      workspace: { select: { type: true, _count: { select: { students: true } } } },
      portalCredential: { select: { active: true, _count: { select: { sessions: true } } } },
      _count: {
        select: {
          routineAssignments: true,
          workoutSessions: true,
          quickLogs: true,
          pointTransactions: true,
          weeklyMissions: true,
          physicalEvaluations: true,
        },
      },
    },
  });

  assert.equal(students.length, 1, "Se esperaba exactamente un SELF_SERVICE.");
  const student = students[0];
  assert.equal(student.workspace?.type, "PERSONAL", "SELF_SERVICE no está en un workspace PERSONAL.");
  assert.equal(student.workspace?._count.students, 1, "El workspace PERSONAL no es exclusivo.");
  assert.ok(student.data && typeof student.data === "object" && !Array.isArray(student.data) && Object.keys(student.data).length > 1, "El perfil SELF_SERVICE está vacío.");
  assert.ok(student.portalCredential, "SELF_SERVICE perdió su credencial.");

  console.log(JSON.stringify({
    selfServiceStudents: students.length,
    personalWorkspaceExclusive: true,
    profilePreserved: true,
    credentialPreserved: true,
    credentialActive: student.portalCredential.active,
    portalSessions: student.portalCredential._count.sessions,
    routineAssignments: student._count.routineAssignments,
    workoutSessions: student._count.workoutSessions,
    progressRecords: student._count.quickLogs + student._count.pointTransactions + student._count.weeklyMissions + student._count.physicalEvaluations,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
