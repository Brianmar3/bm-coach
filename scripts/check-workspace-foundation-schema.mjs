import process from "node:process";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

const phaseArgument = process.argv.find((argument) => argument.startsWith("--phase="));
const phase = phaseArgument?.slice("--phase=".length);
if (phase !== "expand" && phase !== "contract") throw new Error("Indicá --phase=expand o --phase=contract.");

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const tables = ["users", "workspaces", "workspace_memberships"];
const roots = [
  "students", "coach_settings", "monthly_summaries", "trainer_push_subscriptions",
  "trainer_notifications", "payments", "events", "coach_events", "routines",
  "training_routines", "training_library_folders", "training_library_tags",
  "training_block_templates", "evaluations", "weekly_class_schedules",
  "class_occurrences", "classes",
];
const legacyIndexes = [
  "trainer_push_subscriptions_endpoint_key",
  "trainer_notifications_eventKey_key",
  "training_library_folders_normalizedName_key",
  "training_library_tags_normalizedName_key",
  "monthly_summaries_year_month_key",
];
const workspaceIndexes = [
  "trainer_push_subscriptions_workspaceId_endpoint_key",
  "trainer_notifications_workspaceId_eventKey_key",
  "training_library_folders_workspaceId_normalizedName_key",
  "training_library_tags_workspaceId_normalizedName_key",
  "monthly_summaries_workspaceId_year_month_key",
];
const workspaceForeignKeys = [
  "workspace_memberships_workspaceId_fkey",
  "workspace_memberships_userId_fkey",
  ...roots.map((table) => `${table}_workspaceId_fkey`),
];

try {
  const [relations, columns, indexes, scopes, foreignKeys] = await Promise.all([
    prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`,
    prisma.$queryRaw`SELECT table_name, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'workspaceId'`,
    prisma.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`,
    prisma.$queryRaw`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid WHERE pg_type.typname = 'WorkspaceContentScope' ORDER BY enumsortorder`,
    prisma.$queryRaw`SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_schema = current_schema() AND constraint_type = 'FOREIGN KEY'`,
  ]);
  const relationNames = new Set(relations.map((row) => row.tablename));
  const nullability = new Map(columns.map((row) => [row.table_name, row.is_nullable]));
  const indexNames = new Set(indexes.map((row) => row.indexname));
  const foreignKeyNames = new Set(foreignKeys.map((row) => row.constraint_name));
  const checks = {
    foundationTables: tables.every((table) => relationNames.has(table)),
    workspaceColumns: roots.every((table) => nullability.has(table)),
    expectedNullability: roots.every((table) => nullability.get(table) === (phase === "expand" ? "YES" : "NO")),
    workspaceScope: scopes.map((row) => row.enumlabel).join(",") === "GLOBAL,WORKSPACE",
    workspaceIndexes: workspaceIndexes.every((index) => indexNames.has(index)),
    legacyIndexes: phase === "expand"
      ? legacyIndexes.every((index) => indexNames.has(index))
      : legacyIndexes.every((index) => !indexNames.has(index)),
    workspaceForeignKeys: workspaceForeignKeys.every((constraint) => foreignKeyNames.has(constraint)),
  };
  console.log(JSON.stringify({ phase, checks }, null, 2));
  if (Object.values(checks).some((check) => !check)) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
