import process from "node:process";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { foundationCounts, INITIAL_WORKSPACE, isSelfServiceRecord } from "./workspace-foundation-core.mjs";

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

const phaseArgument = process.argv.find((argument) => argument.startsWith("--phase="));
const phase = phaseArgument?.slice("--phase=".length);
if (phase !== "expand" && phase !== "contract") {
  console.error("Indicá explícitamente --phase=expand o --phase=contract.");
  process.exit(1);
}

const workspaceTables = [
  "students",
  "coach_settings",
  "monthly_summaries",
  "trainer_push_subscriptions",
  "trainer_notifications",
  "payments",
  "events",
  "coach_events",
  "routines",
  "training_routines",
  "training_library_folders",
  "training_library_tags",
  "training_block_templates",
  "evaluations",
  "weekly_class_schedules",
  "class_occurrences",
  "classes",
];
const legacyUniqueIndexes = [
  "trainer_push_subscriptions_endpoint_key",
  "trainer_notifications_eventKey_key",
  "training_library_folders_normalizedName_key",
  "training_library_tags_normalizedName_key",
  "monthly_summaries_year_month_key",
];
const workspaceUniqueIndexes = [
  "trainer_push_subscriptions_workspaceId_endpoint_key",
  "trainer_notifications_workspaceId_eventKey_key",
  "training_library_folders_workspaceId_normalizedName_key",
  "training_library_tags_workspaceId_normalizedName_key",
  "monthly_summaries_workspaceId_year_month_key",
];

const operationalRoots = {
  routineRecords: prisma.routineRecord,
  trainingRoutines: prisma.trainingRoutine,
  libraryFolders: prisma.trainingLibraryFolder,
  libraryTags: prisma.trainingLibraryTag,
  blockTemplates: prisma.trainingBlockTemplate,
  schedules: prisma.weeklyClassSchedule,
  occurrences: prisma.classOccurrence,
  classSessions: prisma.classSession,
  coachEvents: prisma.coachEvent,
  eventRecords: prisma.eventRecord,
  paymentRecords: prisma.paymentRecord,
  evaluationRecords: prisma.evaluationRecord,
  monthlySummaries: prisma.monthlySummary,
  trainerPushSubscriptions: prisma.trainerPushSubscription,
  trainerNotifications: prisma.trainerNotification,
};

try {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: INITIAL_WORKSPACE.slug },
    include: { memberships: { where: { role: "OWNER", status: "ACTIVE" }, include: { user: true } } },
  });
  const counts = await foundationCounts(prisma, workspace?.id ?? null);
  const [personalStudents, personalWorkspaces, rootNullEntries, privateContentWithoutWorkspace, crossRows, workspaceColumns, databaseIndexes] = await Promise.all([
    prisma.studentRecord.findMany({
      where: { data: { path: ["accountType"], equals: "SELF_SERVICE" } },
      select: { id: true, workspaceId: true, workspace: { select: { type: true } } },
    }),
    prisma.workspace.findMany({ where: { type: "PERSONAL" }, select: { id: true, students: { select: { id: true, data: true } } } }),
    Promise.all(Object.entries(operationalRoots).map(async ([name, delegate]) => [name, await delegate.count({ where: { workspaceId: null } })])),
    Promise.all([
      prisma.trainingRoutine.count({ where: { scope: "WORKSPACE", workspaceId: null } }),
      prisma.trainingLibraryFolder.count({ where: { scope: "WORKSPACE", workspaceId: null } }),
      prisma.trainingLibraryTag.count({ where: { scope: "WORKSPACE", workspaceId: null } }),
      prisma.trainingBlockTemplate.count({ where: { scope: "WORKSPACE", workspaceId: null } }),
    ]),
    Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "training_routine_assignments" a JOIN "training_routines" r ON r.id = a."routineId" JOIN "students" s ON s.id = a."studentId" WHERE r."workspaceId" IS NULL OR s."workspaceId" IS NULL OR r."workspaceId" <> s."workspaceId"`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "weekly_class_assignments" a JOIN "weekly_class_schedules" c ON c.id = a."scheduleId" JOIN "students" s ON s.id = a."studentId" WHERE c."workspaceId" IS NULL OR s."workspaceId" IS NULL OR c."workspaceId" <> s."workspaceId"`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "students" s JOIN "weekly_class_schedules" c ON c.id = s."primaryScheduleId" WHERE s."workspaceId" IS NULL OR c."workspaceId" IS NULL OR s."workspaceId" <> c."workspaceId"`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "class_occurrences" o JOIN "weekly_class_schedules" c ON c.id = o."scheduleId" WHERE o."workspaceId" IS NULL OR c."workspaceId" IS NULL OR o."workspaceId" <> c."workspaceId"`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "class_occurrence_attendances" a JOIN "class_occurrences" o ON o.id = a."occurrenceId" JOIN "students" s ON s.id = a."studentId" WHERE o."workspaceId" IS NULL OR s."workspaceId" IS NULL OR o."workspaceId" <> s."workspaceId"`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "workout_sessions" w JOIN "training_routines" r ON r.id = w."routineId" JOIN "students" s ON s.id = w."studentId" WHERE r."workspaceId" IS NULL OR s."workspaceId" IS NULL OR r."workspaceId" <> s."workspaceId"`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "trainer_notifications" n LEFT JOIN "students" s ON s.id = n."studentId" LEFT JOIN "class_occurrences" o ON o.id = n."occurrenceId" WHERE n."workspaceId" IS NULL OR (s.id IS NOT NULL AND n."workspaceId" <> s."workspaceId") OR (o.id IS NOT NULL AND n."workspaceId" <> o."workspaceId")`,
    ]),
    prisma.$queryRaw`SELECT table_name, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'workspaceId'`,
    prisma.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`,
  ]);
  const rootNulls = Object.fromEntries(rootNullEntries);
  const personalById = new Map(personalWorkspaces.map((item) => [item.id, item]));
  const personalIds = personalStudents.map((student) => student.workspaceId);
  const crossCounts = crossRows.map((rows) => Number(rows[0]?.count ?? 0));
  const workspaceColumnNullability = new Map(workspaceColumns.map((column) => [column.table_name, column.is_nullable]));
  const indexNames = new Set(databaseIndexes.map((index) => index.indexname));
  const allWorkspaceColumnsPresent = workspaceTables.every((table) => workspaceColumnNullability.has(table));
  const phaseSchemaCompatible = phase === "expand"
    ? workspaceTables.every((table) => workspaceColumnNullability.get(table) === "YES")
      && legacyUniqueIndexes.every((index) => indexNames.has(index))
    : workspaceTables.every((table) => workspaceColumnNullability.get(table) === "NO")
      && legacyUniqueIndexes.every((index) => !indexNames.has(index));
  const checks = {
    allWorkspaceColumnsPresent,
    workspaceUniqueIndexesPresent: workspaceUniqueIndexes.every((index) => indexNames.has(index)),
    phaseSchemaCompatible,
    workspaceBM: Boolean(workspace),
    ownerMembership: workspace?.memberships.length === 1,
    eligibleStudentsAssigned: counts.coachedWithoutWorkspace === 0,
    selfServiceExcluded: counts.selfServiceAssignedToInitialWorkspace === 0,
    selfServiceAssigned: counts.selfServiceWithoutWorkspace === 0,
    personalWorkspaceType: personalStudents.every((student) => student.workspace?.type === "PERSONAL"),
    personalWorkspaceExclusive: new Set(personalIds).size === personalIds.length && personalStudents.every((student) => {
      const personal = student.workspaceId ? personalById.get(student.workspaceId) : null;
      return personal?.students.length === 1 && personal.students[0].id === student.id && isSelfServiceRecord(personal.students[0].data);
    }),
    coachSettingsAssigned: counts.coachSettingsTotal > 0 && counts.coachSettingsWithoutWorkspace === 0,
    operationalRootsAssigned: Object.values(rootNulls).every((value) => value === 0),
    privateContentAssigned: privateContentWithoutWorkspace.every((value) => value === 0),
    noCrossWorkspaceRelations: crossCounts.every((value) => value === 0),
  };
  console.log(`Fase verificada: ${phase.toUpperCase()}`);
  console.log(`Contrato de schema ${phase.toUpperCase()}: ${checks.phaseSchemaCompatible ? "OK" : "INCOMPATIBLE"}`);
  console.log(`Índices únicos workspace: ${checks.workspaceUniqueIndexesPresent ? "OK" : "FALTAN"}`);
  console.log(`Workspace BM: ${checks.workspaceBM ? "OK" : "FALTA"}`);
  console.log(`Owner membership: ${checks.ownerMembership ? "OK" : "FALTA"}`);
  console.log(`Students totales: ${counts.studentsTotal}`);
  console.log(`Students BM: ${counts.studentsInInitialWorkspace}`);
  console.log(`Students sin workspace: ${counts.studentsWithoutWorkspace}`);
  console.log(`SELF_SERVICE sin workspace: ${counts.selfServiceWithoutWorkspace}`);
  console.log(`Coach settings: ${checks.coachSettingsAssigned ? "OK" : "PENDIENTE"}`);
  console.log(`Raíces operativas sin workspace: ${JSON.stringify(rootNulls)}`);
  console.log(`Contenido privado sin workspace: ${privateContentWithoutWorkspace.reduce((sum, value) => sum + value, 0)}`);
  console.log(`Relaciones cross-workspace: ${crossCounts.reduce((sum, value) => sum + value, 0)}`);
  console.log(`Aislamiento completo: ${Object.values(checks).every(Boolean) ? "OK" : "PENDIENTE"}`);
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
} catch (error) {
  console.error("No se pudo verificar Workspace Foundation:", error.code ?? error.name, error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
