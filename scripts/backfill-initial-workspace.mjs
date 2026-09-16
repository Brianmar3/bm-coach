import process from "node:process";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { runWorkspaceFoundation } from "./workspace-foundation-core.mjs";

if (!process.argv.includes("--apply")) {
  throw new Error("Backfill no ejecutado. Usá --apply únicamente después de desplegar y revisar la migración.");
}

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

try {
  const result = await runWorkspaceFoundation(prisma, process.env, { onProgress: console.log });
  console.log(JSON.stringify({
    workspace: { id: result.workspace.id, slug: result.workspace.slug },
    owner: { id: result.user.id, role: result.membership.role, passwordConfigured: Boolean(result.user.passwordHash) },
    studentsUpdated: result.studentsUpdated,
    personalStudentsUpdated: result.personalStudentsUpdated,
    settingsUpdated: result.settingsUpdated,
    operationalUpdated: result.operationalUpdated,
    before: result.before,
    after: result.after,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
