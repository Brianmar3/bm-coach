import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { runMasterDigest, prepareMasterDigest } from "../lib/master-email-service.ts";
import { MasterEmailDeliveryError } from "../lib/master-email.ts";

const migration = readFileSync("prisma/migrations/20261027110000_master_membership_email/migration.sql", "utf8");
const config = { apiKey: "fake-never-used", from: "BM Training <test@bm.test>", masterUrl: "https://bm.test/master" };
const now = new Date("2030-10-27T11:00:00Z");

// Run the actual migration, trigger and service against isolated PostgreSQL/WASM.
// This narrow Prisma-shaped bridge translates the exercised queries to SQL;
// no DATABASE_URL, production database, Resend account or network is used.
async function fixture(t) {
  // Prisma treats timestamp-without-time-zone values as UTC, independently of the host timezone.
  const pg = new PGlite({ parsers: { 1114: (value) => new Date(`${value}Z`) } });
  t.after(() => pg.close());
  await pg.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, "platformRole" TEXT NOT NULL DEFAULT 'TRAINER', status TEXT NOT NULL DEFAULT 'ACTIVE');`);
  await pg.exec(`CREATE TABLE workspaces (id TEXT PRIMARY KEY, type TEXT NOT NULL);
    CREATE TABLE workspace_memberships ("userId" TEXT, "workspaceId" TEXT, role TEXT);
    INSERT INTO workspaces VALUES ('professional', 'PROFESSIONAL'), ('personal', 'PERSONAL');`);
  await pg.exec(readFileSync("prisma/migrations/20260917180000_trainer_subscriptions/migration.sql", "utf8"));
  await pg.exec(migration);
  await pg.exec(`CREATE TABLE trainer_invitations (id TEXT PRIMARY KEY, "inviterId" TEXT, "firstName" TEXT, "lastName" TEXT, status TEXT, "acceptedAt" TIMESTAMP, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP);`);
  const quote = (key) => `"${key}"`;
  const bind = (params, value) => { params.push(value instanceof Date ? value.toISOString() : value); return `$${params.length}`; };
  function whereSql(where, params) {
    return Object.entries(where ?? {}).map(([key, value]) => {
      if (value === null) return `${quote(key)} IS NULL`;
      if (typeof value !== "object" || value instanceof Date) return `${quote(key)} = ${bind(params, value)}`;
      return Object.entries(value).map(([op, value]) => {
        if (op === "in") return value.length ? `${quote(key)} IN (${value.map((v) => bind(params, v)).join(",")})` : "FALSE";
        const operators = { lt: "<", lte: "<=", gt: ">", gte: ">=", not: "<>" };
        assert.ok(operators[op], `unsupported SQL bridge operator ${op}`);
        return `${quote(key)} ${operators[op]} ${bind(params, value)}`;
      }).join(" AND ");
    }).join(" AND ") || "TRUE";
  }
  function table(connection, name) {
    return {
      async findMany({ where, orderBy } = {}) {
        const params = [];
        const predicate = whereSql(where, params);
        const order = orderBy ? ` ORDER BY ${orderBy.flatMap((part) => Object.entries(part).map(([k,v]) => `${quote(k)} ${v}`)).join(",")}` : "";
        return (await connection.query(`SELECT * FROM ${quote(name)} WHERE ${predicate}${order}`, params)).rows;
      },
      async findUnique(args) { return (await this.findMany(args))[0] ?? null; },
      async findUniqueOrThrow(args) { const row = await this.findUnique(args); assert.ok(row); return row; },
      async create({ data }) {
        const values = { id: randomUUID(), ...data };
        const params = [];
        return (await connection.query(`INSERT INTO ${quote(name)} (${Object.keys(values).map(quote).join(",")}) VALUES (${Object.entries(values).map(([key,value]) => bind(params, key === "payload" ? JSON.stringify(value) : value)).join(",")}) RETURNING *`, params)).rows[0];
      },
      async updateMany({ where, data }) {
        const params = [];
        const set = Object.entries(data).map(([key,value]) => `${quote(key)} = ${bind(params, value)}`).join(",");
        const result = await connection.query(`UPDATE ${quote(name)} SET ${set} WHERE ${whereSql(where, params)} RETURNING *`, params);
        return { count: result.rows.length };
      },
      async update(args) { await this.updateMany(args); return this.findUniqueOrThrow({ where: args.where }); },
    };
  }
  function client(connection) {
    return {
      masterEmailDigest: table(connection, "master_email_digests"),
      masterEmailAttempt: table(connection, "master_email_attempts"),
      masterMembershipRenewal: table(connection, "master_membership_renewals"),
      user: { async findMany({where}) {
        assert.equal(where.status,"SUSPENDED");
        return (await connection.query(`SELECT u.id,u.name FROM users u WHERE u.status='SUSPENDED' AND u."platformRole"='TRAINER' AND EXISTS (SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m."workspaceId" WHERE m."userId"=u.id AND m.role='OWNER' AND w.type='PROFESSIONAL')`)).rows;
      } },
      trainerInvitation: { async findMany({where}) {
        assert.deepEqual(where.inviter,{platformRole:"PLATFORM_OWNER"});
        return (await connection.query(`SELECT i.* FROM trainer_invitations i JOIN users u ON u.id=i."inviterId" WHERE i.status='PENDING' AND i."acceptedAt" IS NULL AND i."createdAt" <= $1 AND i."expiresAt">=$2 AND i."expiresAt"<=$3 AND u."platformRole"='PLATFORM_OWNER' ORDER BY i."expiresAt",i.id`,[where.createdAt.lte,where.expiresAt.gte,where.expiresAt.lte])).rows;
      } },
      trainerSubscription: {
        async findMany({ where }) {
          const predicate = { status: where.status, ...(where.nextDueAt ? { nextDueAt: where.nextDueAt } : {}) };
          const rows = await table(connection, "trainer_subscriptions").findMany({ where: predicate, orderBy: [{ nextDueAt: "asc" }, { id: "asc" }] });
          assert.deepEqual(where.trainer, { platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } });
          const users = (await connection.query(`SELECT * FROM users u WHERE "platformRole" = 'TRAINER' AND EXISTS (
            SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m."workspaceId"
            WHERE m."userId"=u.id AND m.role='OWNER' AND w.type='PROFESSIONAL')`)).rows;
          return rows.filter((row) => users.some((u) => u.id === row.trainerUserId)).map((row) => ({ ...row, trainer: users.find((u) => u.id === row.trainerUserId) }));
        },
      },
      async $queryRaw(strings, ...values) { return connection.query(strings.reduce((sql, part, i) => sql + (i ? `$${i}` : "") + part, ""), values); },
    };
  }
  const db = { ...client(pg), $transaction: (callback) => pg.transaction((tx) => callback(client(tx))) };
  async function subscription(id, due = "2030-11-03T12:00:00Z") {
    await pg.query('INSERT INTO users (id,name) VALUES ($1,$2)', [id, `Trainer ${id}`]);
    await pg.query(`INSERT INTO workspace_memberships VALUES ($1, 'professional', 'OWNER')`, [id]);
    await pg.query(`INSERT INTO trainer_subscriptions (id,"trainerUserId",plan,"startedAt","updatedAt","nextDueAt") VALUES ($1,$1,'PRO','2026-01-01','2026-01-01',$2)`, [id, due]);
  }
  return { pg, db, subscription, options: { now: () => now, wait: async () => {} } };
}

test("migration: renewal capture covers payment, edit, reactivation; no insertion, no-op, cancellation or rolled-back event", async (t) => {
  const { pg, subscription } = await fixture(t);
  await subscription("one");
  const count = async () => Number((await pg.query("SELECT count(*) FROM master_membership_renewals")).rows[0].count);
  assert.equal(await count(), 0);
  await pg.exec(`UPDATE trainer_subscriptions SET notes='edit'; UPDATE trainer_subscriptions SET "nextDueAt"="nextDueAt";`);
  assert.equal(await count(), 0);
  await pg.exec(`UPDATE trainer_subscriptions SET "nextDueAt"='2031-01-01', "lastPaidAt"='2030-10-27';`);
  assert.equal(await count(), 1);
  await pg.exec(`UPDATE trainer_subscriptions SET "nextDueAt"='2031-02-01';`);
  assert.equal(await count(), 2);
  await pg.exec(`UPDATE trainer_subscriptions SET status='SUSPENDED'; UPDATE trainer_subscriptions SET status='ACTIVE', "nextDueAt"='2031-03-01';`);
  assert.equal(await count(), 3);
  await pg.exec(`UPDATE trainer_subscriptions SET status='CANCELLED', "nextDueAt"='2031-04-01';`);
  assert.equal(await count(), 3);
  await assert.rejects(pg.transaction(async (tx) => { await tx.exec(`UPDATE trainer_subscriptions SET status='ACTIVE', "nextDueAt"='2031-05-01'`); throw new Error("rollback"); }));
  assert.equal(await count(), 3);
  const rows = (await pg.query('SELECT * FROM master_membership_renewals ORDER BY "nextDueAt"')).rows;
  assert.equal(rows[0].trainerName, "Trainer one");
  assert.equal(rows[0].plan, "PRO");
  assert.equal(rows[0].nextDueAt.toISOString(), "2031-01-01T00:00:00.000Z");
  // Identical payment update does not create another event.
  await pg.exec(`UPDATE trainer_subscriptions SET status='ACTIVE'; UPDATE trainer_subscriptions SET "lastPaidAt"='2030-10-27';`);
  assert.equal(await count(), 3);
});

test("daily service: one combined email under concurrent cron invocations, immutable payload and persisted provider ID", async (t) => {
  const { db, pg, subscription, options } = await fixture(t);
  for (const [id, due] of [["7", "2030-11-03"], ["3", "2030-10-30"], ["1", "2030-10-28"], ["0", "2030-10-27"], ["overdue", "2030-10-24"], ["ignored", "2030-10-29"]]) await subscription(id, `${due}T12:00:00Z`);
  await subscription("renewed", "2030-10-24T12:00:00Z");
  await pg.exec(`UPDATE trainer_subscriptions SET "nextDueAt"='2030-11-27',"lastPaidAt"='2030-10-26' WHERE id='renewed'`);
  let calls = 0;
  const send = async (payload) => { calls++; assert.match(payload.text, /Renovación registrada/); assert.match(payload.text, /Trainer ignored/); return "provider-1"; };
  await Promise.all(Array.from({ length: 5 }, () => runMasterDigest(db, config, { ...options, send })));
  assert.equal(calls, 1);
  const digest = await db.masterEmailDigest.findUnique({ where: { day: "2030-10-27" } });
  assert.equal(digest.itemCount, 7);
  assert.equal(digest.status, "SENT");
  assert.equal(digest.providerId, "provider-1");
  assert.equal((await db.masterEmailAttempt.findMany()).length, 1);
  assert.equal((await db.masterMembershipRenewal.findMany())[0].digestId, digest.id);
  assert.equal((await runMasterDigest(db, config, { ...options, send })).status, "SENT");
  assert.equal(calls, 1);
});

test("no news skips email; renewal after cutoff survives for the following day", async (t) => {
  const { db, pg, subscription, options } = await fixture(t);
  await subscription("later", "2030-12-01T12:00:00Z");
  await pg.exec(`UPDATE trainer_subscriptions SET "nextDueAt"='2031-01-01'; UPDATE master_membership_renewals SET "occurredAt"='2030-10-27 11:00:00.001';`);
  const send = async () => { throw new Error("should not send"); };
  assert.equal((await runMasterDigest(db, config, { ...options, send })).status, "SKIPPED");
  assert.equal((await db.masterMembershipRenewal.findMany())[0].digestId, null);
  let calls = 0;
  await runMasterDigest(db, config, { ...options, now: () => new Date("2030-10-28T11:00:00Z"), send: async () => { calls++; return "next-day"; } });
  assert.equal(calls, 1);
  assert.notEqual((await db.masterMembershipRenewal.findMany())[0].digestId, null);
});

test("retries ambiguous network/429/5xx with identical key and payload and logs every attempt", async (t) => {
  const { db, subscription, options } = await fixture(t);
  await subscription("one");
  const requests = [];
  const send = async (payload, key) => {
    requests.push({ payload: JSON.stringify(payload), key });
    if (requests.length < 3) throw new MasterEmailDeliveryError("RESEND_NETWORK", true);
    return "accepted-once";
  };
  await runMasterDigest(db, config, { ...options, send });
  assert.equal(requests.length, 3);
  assert.deepEqual(requests[0], requests[2]);
  assert.deepEqual((await db.masterEmailAttempt.findMany({ orderBy: [{ createdAt: "asc" }] })).map((a) => a.status), ["FAILED", "FAILED", "ACCEPTED"]);
});

test("crash after provider acceptance: lease recovery reuses saved payload and idempotency key", async (t) => {
  const { db, subscription, options } = await fixture(t);
  await subscription("one");
  let accepted;
  const originalTransaction = db.$transaction;
  const send = async (payload, key) => {
    accepted = { payload, key };
    db.$transaction = async () => { throw new Error("DB unavailable after Resend accepted"); };
    return "provider-id";
  };
  await assert.rejects(runMasterDigest(db, config, { ...options, send }), /DB unavailable/);
  db.$transaction = originalTransaction;
  let replay = 0;
  const replaySend = async (payload, key) => { replay++; assert.deepEqual({ payload, key }, accepted); return "provider-id"; };
  assert.equal((await runMasterDigest(db, config, { ...options, send: replaySend })).status, "ALREADY_CLAIMED");
  await runMasterDigest(db, config, { ...options, now: () => new Date(now.getTime() + 121000), send: replaySend });
  assert.equal(replay, 1);
  assert.equal((await db.masterEmailDigest.findUnique({ where: { day: "2030-10-27" } })).status, "SENT");
});

test("permanent rejection requires review; unresolved older batch never resends after key expiration", async (t) => {
  const { db, subscription, options } = await fixture(t);
  await subscription("one");
  let calls = 0;
  const send = async () => { calls++; throw new MasterEmailDeliveryError("RESEND_HTTP_403", false); };
  await assert.rejects(runMasterDigest(db, config, { ...options, send }), /RESEND_HTTP_403/);
  assert.equal((await runMasterDigest(db, config, { ...options, send })).status, "REVIEW");
  assert.equal(calls, 1);
  const digest = await db.masterEmailDigest.findUnique({ where: { day: "2030-10-27" } });
  await db.masterEmailDigest.update({ where: { id: digest.id }, data: { status: "SENDING", leaseUntil: new Date("2030-10-27T11:02:00Z") } });
  await runMasterDigest(db, config, { ...options, now: () => new Date("2030-10-28T11:00:00Z"), send: async (_payload, key) => { assert.notEqual(key, `bm-master/${digest.id}`); return "new-day"; } });
  assert.equal(calls, 1);
  assert.equal((await db.masterEmailDigest.findUnique({ where: { id: digest.id } })).status, "REVIEW");
});

test("before 08:00 does not create a batch; snapshot rollback does not consume renewals", async (t) => {
  const { db, pg, subscription, options } = await fixture(t);
  assert.equal((await runMasterDigest(db, config, { ...options, now: () => new Date("2030-10-27T10:59:59Z") })).status, "BEFORE_SCHEDULE");
  assert.equal((await db.masterEmailDigest.findMany()).length, 0);
  await subscription("one");
  await pg.exec(`UPDATE trainer_subscriptions SET "nextDueAt"='2031-01-01';`);
  const transaction = db.$transaction;
  db.$transaction = (callback) => transaction(async (tx) => {
    tx.masterMembershipRenewal.updateMany = async () => { throw new Error("assignment failed"); };
    return callback(tx);
  });
  await assert.rejects(prepareMasterDigest(db, config, now), /assignment failed/);
  assert.equal((await db.masterEmailDigest.findMany()).length, 0);
  assert.equal((await db.masterMembershipRenewal.findMany())[0].digestId, null);
});

test("only professional trainer owners appear; platform owners and personal workspaces are excluded", async (t) => {
  const { db, pg, subscription, options } = await fixture(t);
  await subscription("platform");
  await subscription("personal");
  await subscription("coach");
  await pg.exec(`UPDATE users SET "platformRole"='PLATFORM_OWNER' WHERE id='platform';
    UPDATE workspace_memberships SET "workspaceId"='personal' WHERE "userId"='personal';
    UPDATE workspace_memberships SET role='COACH' WHERE "userId"='coach';`);
  assert.equal((await runMasterDigest(db, config, { ...options, send: async () => assert.fail("must not send") })).status, "SKIPPED");
  await pg.exec(`UPDATE trainer_subscriptions SET "nextDueAt"='2031-01-01'`);
  assert.equal((await db.masterMembershipRenewal.findMany()).length, 0);
});

test("digest covers old overdue, independent access suspension and pending invitations once daily", async t => {
 const {pg,db,subscription,options}=await fixture(t);
 await subscription("old","2030-09-01T12:00:00Z");
 await subscription("blocked","2030-12-01T12:00:00Z");
 await pg.exec(`UPDATE users SET status='SUSPENDED' WHERE id='blocked'; INSERT INTO users (id,name,"platformRole") VALUES ('owner','Owner','PLATFORM_OWNER'); INSERT INTO trainer_invitations VALUES ('invite','owner','Test','Invitation','PENDING',NULL,'2030-10-28','2030-10-26');`);
 let calls=0;
 const send=async payload=>{calls++; assert.match(payload.text,/Trainer old/); assert.match(payload.text,/Trainer blocked/); assert.match(payload.text,/Test Invitation/); assert.match(payload.text,/view=invitations/); return "one";};
 await runMasterDigest(db,config,{...options,send}); await runMasterDigest(db,config,{...options,send});
 assert.equal(calls,1);
 assert.equal((await db.masterEmailDigest.findUnique({where:{day:"2030-10-27"}})).itemCount,3);
});
