import test from "node:test";
import assert from "node:assert/strict";
import { verifyStagingDatabase } from "../scripts/staging-database-check.mjs";

const env = {
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "codex/safari-staging",
  DATABASE_URL: "postgresql://photos_staging_owner:fixture@ep-icy-mud-avwd38s0-pooler.c-11.us-east-1.aws.neon.tech/fixture?sslmode=require",
};
const identity = {
  role: "photos_staging_owner",
  branch: "br-rapid-haze-avzo0dxy",
  endpoint: "ep-icy-mud-avwd38s0",
};

test("validates Preview, branch and DSN before creating the client", async () => {
  const neverConnect = () => assert.fail("unexpected connection");
  for (const [override, expected] of [
    [{ VERCEL_ENV: "production" }, /preview_required/],
    [{ VERCEL_TARGET_ENV: "development" }, /preview_required/],
    [{ VERCEL_GIT_COMMIT_REF: "main" }, /branch_required/],
    [{ VERCEL_GIT_COMMIT_REF: undefined }, /branch_required/],
    ...["", "not-a-url", env.DATABASE_URL.replace("sslmode=require", "sslmode=disable"),
      env.DATABASE_URL + "&sslmode=require", env.DATABASE_URL + "&sslaccept=accept_invalid_certs",
      env.DATABASE_URL.replace("ep-icy-mud-avwd38s0", "unexpected"),
      env.DATABASE_URL.replace("photos_staging_owner", "other")].map(
      (DATABASE_URL) => [{ DATABASE_URL }, /destination_invalid/]),
  ]) {
    await assert.rejects(verifyStagingDatabase({ ...env, ...override }, neverConnect), expected);
  }
});

test("executes exactly one metadata query and disconnects", async () => {
  let calls = 0;
  let disconnected = false;
  await verifyStagingDatabase(env, (dsn) => {
    assert.equal(dsn, env.DATABASE_URL);
    return {
      async $queryRaw([sql], ...params) {
        calls++;
        assert.deepEqual(params, []);
        assert.equal(sql.trim().replace(/\s+/g, " "), "SELECT current_user AS role, current_setting('neon.branch_id', true) AS branch, current_setting('neon.endpoint_id', true) AS endpoint");
        return [identity];
      },
      async $disconnect() { disconnected = true; },
    };
  });
  assert.equal(calls, 1);
  assert.equal(disconnected, true);
});

test("rejects missing metadata and mismatched identity", async () => {
  for (const rows of [[], [{ ...identity, branch: null }], [{ ...identity, endpoint: "other" }], [{ ...identity, role: "other" }]]) {
    await assert.rejects(verifyStagingDatabase(env, () => ({
      $queryRaw: async () => rows,
      $disconnect: async () => {},
    })), /^Error: metadata_mismatch$/);
  }
});

test("redacts driver errors", async () => {
  await assert.rejects(verifyStagingDatabase(env, () => ({
    $queryRaw: async () => { throw new Error("driver could include a secret"); },
    $disconnect: async () => {},
  })), /^Error: metadata_unavailable$/);
});
