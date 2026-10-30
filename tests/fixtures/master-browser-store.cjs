// Explicitly opt-in, loopback-only fixture for exercising the real production Next server without a database.
const Module = require("node:module"); // eslint-disable-line @typescript-eslint/no-require-imports -- Node --require preload is CommonJS.
const { scryptSync } = require("node:crypto"); // eslint-disable-line @typescript-eslint/no-require-imports -- Node --require preload is CommonJS.
if (process.env.BM_MASTER_BROWSER_FIXTURE !== "1" || process.env.DATABASE_URL !== "postgresql://local_only:local_only@127.0.0.1:1/bm_master_browser") {
  throw new Error("Master browser fixture requires its explicit flag and dummy local database URL.");
}
const originalLoad = Module._load;
const salt = "master-local-fixture";
const passwordHash = `scrypt$v1$${salt}$${scryptSync("MasterFixture123!", salt, 64).toString("base64url")}`;
const workspace = { id: "fixture-workspace", slug: "fixture", name: "BM Local Fixture", status: "ACTIVE", type: "PROFESSIONAL" };
const owner = { id: "fixture-owner", email: "master-fixture@bm.test", name: "Master Local Fixture", status: "ACTIVE", platformRole: "PLATFORM_OWNER", passwordHash, onboardingCompleted: true, memberships: [{ id: "fixture-membership", userId: "fixture-owner", workspaceId: workspace.id, role: "OWNER", status: "ACTIVE", workspace }] };
const forbidden = () => { throw new Error("Database writes and unimplemented reads are forbidden in the Master browser fixture."); };
const model = overrides => new Proxy(overrides, { get: (target, key) => key in target ? target[key] : forbidden });
const fixture = {
  user: model({ findUnique: async ({ where }) => where.id === owner.id || where.email === owner.email ? owner : null, findMany: async () => [] }),
  trainerPasswordResetToken: model({ findFirst: async () => null }),
  trainerInvitation: model({ findMany: async () => [] }),
  platformSettings: model({ findUnique: async () => null }),
  workspaceMembership: model({ findFirst: async () => owner.memberships[0], findMany: async () => owner.memberships }),
  workspace: model({ findUnique: async () => workspace }),
  $disconnect: async () => {},
};
class MasterBrowserPrisma {
  constructor() { return new Proxy(fixture, { get: (target, key) => key in target ? target[key] : model({}) }); }
}
globalThis.prisma = new MasterBrowserPrisma();
Module._load = function (name, ...args) {
  const loaded = originalLoad.call(this, name, ...args);
  // Turbopack gives external packages a content-hashed require alias in production.
  return name === "@prisma/client" || name.startsWith("@prisma/client-") ? { ...loaded, PrismaClient: MasterBrowserPrisma } : loaded;
};
