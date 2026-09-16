export const INITIAL_WORKSPACE = Object.freeze({
  name: "BM Fuerza & Funcional",
  slug: "bm-fuerza-funcional",
  type: "PROFESSIONAL",
  status: "ACTIVE",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function isSelfServiceRecord(data) {
  return Boolean(data && typeof data === "object" && !Array.isArray(data) && data.accountType === "SELF_SERVICE");
}

export function personalWorkspaceData(studentId) {
  if (!studentId) throw new Error("Falta el alumno del workspace PERSONAL.");
  return { ...INITIAL_WORKSPACE, name: "Mi entrenamiento", slug: `personal-${studentId}`, type: "PERSONAL" };
}

/** @param {unknown} settingsData @param {Record<string, string | undefined>} environment */
export function ownerIdentity(settingsData, environment = process.env) {
  const settings = settingsData && typeof settingsData === "object" && !Array.isArray(settingsData) ? settingsData : {};
  const email = String(environment.BM_INITIAL_OWNER_EMAIL || settings.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Definí BM_INITIAL_OWNER_EMAIL o configurá un email válido en CoachSettings antes del backfill.");
  }
  const name = String(environment.BM_INITIAL_OWNER_NAME || settings.coachName || "Brian").trim() || "Brian";
  return { email, name };
}

export async function foundationCounts(prisma, workspaceId = null) {
  const [students, coachSettings, workspaces, users, memberships] = await Promise.all([
    prisma.studentRecord.findMany({ select: { id: true, workspaceId: true, data: true } }),
    prisma.coachSettingsRecord.findMany({ select: { id: true, workspaceId: true } }),
    prisma.workspace.count(),
    prisma.user.count(),
    prisma.workspaceMembership.count(),
  ]);
  const selfService = students.filter((student) => isSelfServiceRecord(student.data));
  const coached = students.filter((student) => !isSelfServiceRecord(student.data));
  return {
    studentsTotal: students.length,
    coachedStudents: coached.length,
    selfServiceStudents: selfService.length,
    studentsWithoutWorkspace: students.filter((student) => !student.workspaceId).length,
    coachedWithoutWorkspace: coached.filter((student) => !student.workspaceId).length,
    selfServiceWithoutWorkspace: selfService.filter((student) => !student.workspaceId).length,
    selfServiceAssignedToInitialWorkspace: workspaceId ? selfService.filter((student) => student.workspaceId === workspaceId).length : 0,
    studentsInInitialWorkspace: workspaceId ? students.filter((student) => student.workspaceId === workspaceId).length : 0,
    coachSettingsTotal: coachSettings.length,
    coachSettingsWithoutWorkspace: coachSettings.filter((setting) => !setting.workspaceId).length,
    coachSettingsInInitialWorkspace: workspaceId ? coachSettings.filter((setting) => setting.workspaceId === workspaceId).length : 0,
    workspaces,
    users,
    memberships,
  };
}

export const WORKSPACE_BACKFILL_BATCH_SIZE = 100;
const PHASE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

function chunks(values, size = WORKSPACE_BACKFILL_BATCH_SIZE) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function addToGroup(groups, workspaceId, id) {
  const current = groups.get(workspaceId) ?? [];
  current.push(id);
  groups.set(workspaceId, current);
}

async function updateGrouped(delegate, groups, extraData = {}) {
  let updated = 0;
  for (const [workspaceId, ids] of groups) {
    for (const batch of chunks(ids)) {
      const result = await delegate.updateMany({
        where: { id: { in: batch }, workspaceId: null },
        data: { workspaceId, ...extraData },
      });
      updated += result.count;
    }
  }
  return updated;
}

function ownershipFromJson(value, studentWorkspace, initialWorkspaceId, label, recordId) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : Array.isArray(value) ? { students: value } : {};
  const nested = data.data && typeof data.data === "object" && !Array.isArray(data.data) ? data.data : {};
  const values = [data.studentId, nested.studentId, ...(Array.isArray(data.studentIds) ? data.studentIds : []), ...(Array.isArray(data.students) ? data.students.map((item) => typeof item === "string" ? item : item?.id) : [])];
  const workspaceIds = new Set(values.filter((id) => typeof id === "string" && studentWorkspace.has(id)).map((id) => studentWorkspace.get(id)).filter(Boolean));
  if (workspaceIds.size > 1) throw new Error(`${label} ${recordId} contiene alumnos de varios workspaces.`);
  return workspaceIds.values().next().value ?? initialWorkspaceId;
}

async function assignJsonRoot(tx, delegateName, label, studentWorkspace, initialWorkspaceId, dataField = "data") {
  const delegate = tx[delegateName];
  const records = await delegate.findMany({ where: { workspaceId: null }, select: { id: true, [dataField]: true } });
  const groups = new Map();
  for (const record of records) addToGroup(groups, ownershipFromJson(record[dataField], studentWorkspace, initialWorkspaceId, label, record.id), record.id);
  return { inspected: records.length, updated: await updateGrouped(delegate, groups) };
}

async function validateWorkspaceRelations(prisma) {
  if (!prisma.$queryRawUnsafe) return { inspected: 0, updated: 0, skipped: 0 };
  const checks = [
    `SELECT COUNT(*)::int AS count FROM "training_routine_assignments" a JOIN "training_routines" r ON r.id = a."routineId" JOIN "students" s ON s.id = a."studentId" WHERE r."workspaceId" IS NULL OR s."workspaceId" IS NULL OR r."workspaceId" <> s."workspaceId"`,
    `SELECT COUNT(*)::int AS count FROM "weekly_class_assignments" a JOIN "weekly_class_schedules" c ON c.id = a."scheduleId" JOIN "students" s ON s.id = a."studentId" WHERE c."workspaceId" IS NULL OR s."workspaceId" IS NULL OR c."workspaceId" <> s."workspaceId"`,
    `SELECT COUNT(*)::int AS count FROM "students" s JOIN "weekly_class_schedules" c ON c.id = s."primaryScheduleId" WHERE s."workspaceId" IS NULL OR c."workspaceId" IS NULL OR s."workspaceId" <> c."workspaceId"`,
    `SELECT COUNT(*)::int AS count FROM "class_occurrence_attendances" a JOIN "class_occurrences" o ON o.id = a."occurrenceId" JOIN "students" s ON s.id = a."studentId" WHERE o."workspaceId" IS NULL OR s."workspaceId" IS NULL OR o."workspaceId" <> s."workspaceId"`,
    `SELECT COUNT(*)::int AS count FROM "workout_sessions" w JOIN "training_routines" r ON r.id = w."routineId" JOIN "students" s ON s.id = w."studentId" WHERE r."workspaceId" IS NULL OR s."workspaceId" IS NULL OR r."workspaceId" <> s."workspaceId"`,
  ];
  const results = await Promise.all(checks.map((query) => prisma.$queryRawUnsafe(query)));
  const invalid = results.reduce((sum, rows) => sum + Number(rows[0]?.count ?? 0), 0);
  if (invalid) throw new Error(`La validación final detectó ${invalid} relaciones cross-workspace.`);
  return { inspected: checks.length, updated: 0, skipped: checks.length };
}

/** @param {any} prisma @param {Record<string, string | undefined>} environment @param {{onProgress?: (message: string) => void, afterPhase?: (phase: number) => unknown}} options */
export async function runWorkspaceFoundation(prisma, environment = process.env, options = {}) {
  const onProgress = options.onProgress ?? (() => {});
  const before = await foundationCounts(prisma);
  const operationalUpdated = {};
  let workspace;
  let user;
  let membership;
  let studentsUpdated = 0;
  let personalStudentsUpdated = 0;
  let settingsUpdated = 0;

  const runPhase = async (number, name, callback) => {
    const started = performance.now();
    try {
      const metrics = await callback();
      const inspected = Number(metrics?.inspected ?? 0);
      const updated = Number(metrics?.updated ?? 0);
      const skipped = Number(metrics?.skipped ?? Math.max(0, inspected - updated));
      const durationMs = Math.round(performance.now() - started);
      onProgress(`[${number}/10] ${name} inspected=${inspected} updated=${updated} skipped=${skipped} durationMs=${durationMs}`);
      await options.afterPhase?.(number);
      return { inspected, updated, skipped, durationMs };
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      onProgress(`[${number}/10] ${name} FAILED durationMs=${durationMs}`);
      throw error;
    }
  };

  await runPhase(1, "Workspace base", async () => prisma.$transaction(async (tx) => {
    const settingsRecord = await tx.coachSettingsRecord.findUnique({ where: { id: "main" }, select: { data: true, workspaceId: true } });
    const owner = ownerIdentity(settingsRecord?.data, environment);
    const existingWorkspace = tx.workspace.findUnique ? await tx.workspace.findUnique({ where: { slug: INITIAL_WORKSPACE.slug } }) : null;
    workspace = await tx.workspace.upsert({ where: { slug: INITIAL_WORKSPACE.slug }, update: {}, create: INITIAL_WORKSPACE });
    const existingUser = tx.user.findUnique ? await tx.user.findUnique({ where: { email: owner.email } }) : null;
    user = await tx.user.upsert({ where: { email: owner.email }, update: {}, create: { name: owner.name, email: owner.email, passwordHash: null, status: "ACTIVE" } });
    const membershipWhere = { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } };
    const existingMembership = tx.workspaceMembership.findUnique ? await tx.workspaceMembership.findUnique({ where: membershipWhere }) : null;
    membership = await tx.workspaceMembership.upsert({ where: membershipWhere, update: {}, create: { workspaceId: workspace.id, userId: user.id, role: "OWNER", status: "ACTIVE" } });
    if (workspace.type !== "PROFESSIONAL" || workspace.status !== "ACTIVE" || user.status !== "ACTIVE" || membership.status !== "ACTIVE" || membership.role !== "OWNER") throw new Error("El workspace inicial o su owner no están activos. El backfill no reactiva permisos.");
    if (settingsRecord?.workspaceId && settingsRecord.workspaceId !== workspace.id) throw new Error("La configuración main pertenece a otro workspace.");
    const unassigned = await tx.studentRecord.findMany({ where: { workspaceId: null }, select: { data: true } });
    if (unassigned.some((student) => !isSelfServiceRecord(student.data)) && await tx.workspace.count({ where: { type: "PROFESSIONAL" } }) > 1) throw new Error("Hay varios workspaces profesionales: no se puede inferir el dueño de alumnos sin workspace.");
    return { inspected: 3, updated: Number(!existingWorkspace) + Number(!existingUser) + Number(!existingMembership) };
  }, PHASE_TRANSACTION_OPTIONS));

  await runPhase(2, "Personal workspaces", async () => {
    const unassigned = await prisma.studentRecord.findMany({ where: { workspaceId: null }, select: { id: true, data: true } });
    const personalStudents = unassigned.filter((student) => isSelfServiceRecord(student.data));
    for (const student of personalStudents) {
      personalStudentsUpdated += await prisma.$transaction(async (tx) => {
        const data = personalWorkspaceData(student.id);
        const personal = await tx.workspace.upsert({ where: { slug: data.slug }, update: {}, create: data });
        if (personal.type !== "PERSONAL" || personal.status !== "ACTIVE") throw new Error("Workspace PERSONAL incompatible.");
        const result = await tx.studentRecord.updateMany({ where: { id: { in: [student.id] }, workspaceId: null }, data: { workspaceId: personal.id } });
        return result.count;
      }, PHASE_TRANSACTION_OPTIONS);
    }
    return { inspected: personalStudents.length, updated: personalStudentsUpdated };
  });

  await runPhase(3, "Students and settings", async () => prisma.$transaction(async (tx) => {
    const unassigned = await tx.studentRecord.findMany({ where: { workspaceId: null }, select: { id: true, data: true } });
    const ids = unassigned.filter((student) => !isSelfServiceRecord(student.data)).map((student) => student.id);
    const studentResult = ids.length ? await tx.studentRecord.updateMany({ where: { id: { in: ids }, workspaceId: null }, data: { workspaceId: workspace.id } }) : { count: 0 };
    const settingsResult = await tx.coachSettingsRecord.updateMany({ where: { id: "main", workspaceId: null }, data: { workspaceId: workspace.id } });
    studentsUpdated = studentResult.count;
    settingsUpdated = settingsResult.count;
    return { inspected: ids.length + 1, updated: studentsUpdated + settingsUpdated };
  }, PHASE_TRANSACTION_OPTIONS));

  if (prisma.trainingRoutine) {
    await runPhase(4, "Routines and library", async () => prisma.$transaction(async (tx) => {
      const routines = await tx.trainingRoutine.findMany({ where: { workspaceId: null }, select: { id: true, assignments: { select: { student: { select: { workspaceId: true } } } } } });
      const groups = new Map();
      for (const routine of routines) {
        const ids = new Set(routine.assignments.map((item) => item.student.workspaceId).filter(Boolean));
        if (ids.size > 1) throw new Error(`Rutina ${routine.id} tiene asignaciones cross-workspace.`);
        addToGroup(groups, ids.values().next().value ?? workspace.id, routine.id);
      }
      operationalUpdated.trainingRoutines = await updateGrouped(tx.trainingRoutine, groups, { scope: "WORKSPACE" });
      for (const [delegateName, key] of [["trainingLibraryFolder", "libraryFolders"], ["trainingLibraryTag", "libraryTags"], ["trainingBlockTemplate", "blockTemplates"]]) {
        const result = await tx[delegateName].updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } });
        operationalUpdated[key] = result.count;
      }
      const updated = operationalUpdated.trainingRoutines + operationalUpdated.libraryFolders + operationalUpdated.libraryTags + operationalUpdated.blockTemplates;
      return { inspected: routines.length + updated - operationalUpdated.trainingRoutines, updated };
    }, PHASE_TRANSACTION_OPTIONS));

    await runPhase(5, "Schedules and occurrences", async () => prisma.$transaction(async (tx) => {
      const schedules = await tx.weeklyClassSchedule.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } });
      operationalUpdated.schedules = schedules.count;
      const occurrences = await tx.classOccurrence.findMany({ where: { workspaceId: null }, select: { id: true, schedule: { select: { workspaceId: true } } } });
      const groups = new Map();
      for (const occurrence of occurrences) addToGroup(groups, occurrence.schedule?.workspaceId ?? workspace.id, occurrence.id);
      operationalUpdated.occurrences = await updateGrouped(tx.classOccurrence, groups);
      return { inspected: schedules.count + occurrences.length, updated: schedules.count + operationalUpdated.occurrences };
    }, PHASE_TRANSACTION_OPTIONS));

    await runPhase(6, "Legacy JSON roots", async () => prisma.$transaction(async (tx) => {
      const students = await tx.studentRecord.findMany({ select: { id: true, workspaceId: true } });
      const studentWorkspace = new Map(students.map((student) => [student.id, student.workspaceId]));
      let inspected = 0;
      let updated = 0;
      for (const [delegateName, key, dataField] of [["routineRecord", "routineRecords", "data"], ["classSession", "classSessions", "students"], ["paymentRecord", "paymentRecords", "data"], ["evaluationRecord", "evaluationRecords", "data"]]) {
        const result = await assignJsonRoot(tx, delegateName, key, studentWorkspace, workspace.id, dataField);
        operationalUpdated[key] = result.updated;
        inspected += result.inspected;
        updated += result.updated;
      }
      return { inspected, updated };
    }, PHASE_TRANSACTION_OPTIONS));

    await runPhase(7, "Remaining ownership", async () => prisma.$transaction(async (tx) => {
      const coachEvents = await tx.coachEvent.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } });
      const eventRecords = await tx.eventRecord.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } });
      operationalUpdated.coachEvents = coachEvents.count;
      operationalUpdated.eventRecords = eventRecords.count;
      return { inspected: coachEvents.count + eventRecords.count, updated: coachEvents.count + eventRecords.count };
    }, PHASE_TRANSACTION_OPTIONS));

    await runPhase(8, "Notifications, Push and summaries", async () => prisma.$transaction(async (tx) => {
      for (const [delegateName, key] of [["monthlySummary", "monthlySummaries"], ["trainerPushSubscription", "trainerPushSubscriptions"]]) {
        const result = await tx[delegateName].updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } });
        operationalUpdated[key] = result.count;
      }
      const notifications = await tx.trainerNotification.findMany({ where: { workspaceId: null }, select: { id: true, student: { select: { workspaceId: true } }, occurrence: { select: { workspaceId: true } } } });
      const groups = new Map();
      for (const notification of notifications) {
        const studentWorkspace = notification.student?.workspaceId;
        const occurrenceWorkspace = notification.occurrence?.workspaceId;
        if (studentWorkspace && occurrenceWorkspace && studentWorkspace !== occurrenceWorkspace) throw new Error(`Notificación ${notification.id} cruza workspaces.`);
        addToGroup(groups, studentWorkspace ?? occurrenceWorkspace ?? workspace.id, notification.id);
      }
      operationalUpdated.trainerNotifications = await updateGrouped(tx.trainerNotification, groups);
      const updated = operationalUpdated.monthlySummaries + operationalUpdated.trainerPushSubscriptions + operationalUpdated.trainerNotifications;
      return { inspected: notifications.length + operationalUpdated.monthlySummaries + operationalUpdated.trainerPushSubscriptions, updated };
    }, PHASE_TRANSACTION_OPTIONS));

    await runPhase(9, "Cross-workspace validation", () => validateWorkspaceRelations(prisma));
  } else {
    for (let phase = 4; phase <= 9; phase += 1) await runPhase(phase, "Operational roots unavailable in test double", async () => ({ inspected: 0, updated: 0 }));
  }

  let after;
  await runPhase(10, "Final ownership counts", async () => {
    after = await foundationCounts(prisma, workspace.id);
    const inspected = after.studentsTotal + after.coachSettingsTotal;
    const pending = after.studentsWithoutWorkspace + after.coachSettingsWithoutWorkspace;
    if (pending) throw new Error(`Quedan ${pending} registros base sin workspace.`);
    return { inspected, updated: 0, skipped: inspected };
  });

  return { workspace, user, membership, studentsUpdated, personalStudentsUpdated, settingsUpdated, operationalUpdated, before, after };
}
