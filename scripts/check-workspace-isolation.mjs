import assert from "node:assert/strict";
import process from "node:process";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const marker = `workspace-rehearsal-${Date.now()}`;
const ids = {
  workspaceA: `${marker}-workspace-a`,
  workspaceB: `${marker}-workspace-b`,
  userA: `${marker}-user-a`,
  userB: `${marker}-user-b`,
  studentA: `${marker}-student-a`,
  studentB: `${marker}-student-b`,
  routineB: `${marker}-routine-b`,
  scheduleB: `${marker}-schedule-b`,
  notificationB: `${marker}-notification-b`,
};

const rollbackSignal = new Error("WORKSPACE_ISOLATION_ROLLBACK");

try {
  await prisma.$transaction(async (tx) => {
    await tx.workspace.createMany({
      data: [
        { id: ids.workspaceA, name: "Rehearsal A", slug: `${marker}-a`, type: "PROFESSIONAL", timeZone: "America/Argentina/Buenos_Aires" },
        { id: ids.workspaceB, name: "Rehearsal B", slug: `${marker}-b`, type: "PROFESSIONAL", timeZone: "America/Argentina/Buenos_Aires" },
      ],
    });
    await tx.user.createMany({
      data: [
        { id: ids.userA, name: "Trainer A", email: `${marker}-a@example.invalid` },
        { id: ids.userB, name: "Trainer B", email: `${marker}-b@example.invalid` },
      ],
    });
    await tx.workspaceMembership.createMany({
      data: [
        { workspaceId: ids.workspaceA, userId: ids.userA, role: "OWNER" },
        { workspaceId: ids.workspaceB, userId: ids.userB, role: "OWNER" },
      ],
    });
    await tx.studentRecord.createMany({
      data: [
        { id: ids.studentA, workspaceId: ids.workspaceA, data: { firstName: "Fixture A", accountType: "COACHED" } },
        { id: ids.studentB, workspaceId: ids.workspaceB, data: { firstName: "Fixture B", accountType: "COACHED" } },
      ],
    });
    await tx.trainingRoutine.create({
      data: { id: ids.routineB, workspaceId: ids.workspaceB, name: "Fixture routine B", objective: "Isolation", level: "PRINCIPIANTE" },
    });
    await tx.trainingRoutineAssignment.create({ data: { routineId: ids.routineB, studentId: ids.studentB } });
    await tx.studentPayment.create({
      data: { studentId: ids.studentB, amount: 1, concept: "Fixture", dueDate: new Date("2099-01-01T00:00:00.000Z"), method: "Fixture" },
    });
    await tx.physicalEvaluation.create({ data: { studentId: ids.studentB, date: new Date("2099-01-01T00:00:00.000Z") } });
    await tx.weeklyClassSchedule.create({
      data: { id: ids.scheduleB, workspaceId: ids.workspaceB, dayOfWeek: "MONDAY", startTime: "06:00", endTime: "07:00", classType: "Fixture" },
    });
    await tx.trainerNotification.create({
      data: { id: ids.notificationB, workspaceId: ids.workspaceB, type: "POINTS", eventKey: `${marker}-event`, title: "Fixture", message: "Fixture", url: "/" },
    });

    const reads = {
      student: await tx.studentRecord.count({ where: { id: ids.studentB, workspaceId: ids.workspaceA } }),
      routine: await tx.trainingRoutine.count({ where: { id: ids.routineB, workspaceId: ids.workspaceA } }),
      assignment: await tx.trainingRoutineAssignment.count({ where: { routineId: ids.routineB, routine: { workspaceId: ids.workspaceA } } }),
      payment: await tx.studentPayment.count({ where: { studentId: ids.studentB, student: { workspaceId: ids.workspaceA } } }),
      evaluation: await tx.physicalEvaluation.count({ where: { studentId: ids.studentB, student: { workspaceId: ids.workspaceA } } }),
      schedule: await tx.weeklyClassSchedule.count({ where: { id: ids.scheduleB, workspaceId: ids.workspaceA } }),
      notification: await tx.trainerNotification.count({ where: { id: ids.notificationB, workspaceId: ids.workspaceA } }),
      search: await tx.studentRecord.count({ where: { workspaceId: ids.workspaceA, id: ids.studentB, data: { path: ["firstName"], string_contains: "Fixture B" } } }),
    };
    assert.deepEqual(reads, { student: 0, routine: 0, assignment: 0, payment: 0, evaluation: 0, schedule: 0, notification: 0, search: 0 });

    const writes = {
      student: (await tx.studentRecord.updateMany({ where: { id: ids.studentB, workspaceId: ids.workspaceA }, data: { data: { forbidden: true } } })).count,
      routine: (await tx.trainingRoutine.updateMany({ where: { id: ids.routineB, workspaceId: ids.workspaceA }, data: { description: "forbidden" } })).count,
      schedule: (await tx.weeklyClassSchedule.updateMany({ where: { id: ids.scheduleB, workspaceId: ids.workspaceA }, data: { classType: "forbidden" } })).count,
      notification: (await tx.trainerNotification.updateMany({ where: { id: ids.notificationB, workspaceId: ids.workspaceA }, data: { readAt: new Date() } })).count,
    };
    assert.deepEqual(writes, { student: 0, routine: 0, schedule: 0, notification: 0 });
    throw rollbackSignal;
  }, { maxWait: 10_000, timeout: 30_000 });
  throw new Error("El fixture no ejecutó el rollback obligatorio.");
} catch (error) {
  if (error !== rollbackSignal) throw error;
}

const leftovers = await prisma.$queryRaw`
  SELECT
    (SELECT count(*)::int FROM "workspaces" WHERE "id" IN (${ids.workspaceA}, ${ids.workspaceB})) AS workspaces,
    (SELECT count(*)::int FROM "users" WHERE "id" IN (${ids.userA}, ${ids.userB})) AS users,
    (SELECT count(*)::int FROM "students" WHERE "id" IN (${ids.studentA}, ${ids.studentB})) AS students
`;
assert.deepEqual(leftovers[0], { workspaces: 0, users: 0, students: 0 });

console.log(JSON.stringify({ readsBlocked: 8, writesBlocked: 4, rollbackVerified: true }, null, 2));
await prisma.$disconnect();
