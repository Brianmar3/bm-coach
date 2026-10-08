import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { enqueueCelebrations, reconcileWeeklyCelebration, weeklyCelebrationKey, weeklyCelebrationConfirmed } from '../lib/portal-celebrations.ts';
import { getWeeklyMissionProgress } from '../lib/weekly-mission.ts';
const require = createRequire(import.meta.url), ts = require('typescript');
const mission = (changes = {}) => ({ ...getWeeklyMissionProgress({ id: 'mission-a', weekStart: '2026-10-05', weekEnd: '2026-10-11', progress: 2, target: 2, state: 'COMPLETED', completedAt: '2026-10-06T12:00:00Z', pointsAwardedAt: '2026-10-06T15:00:00Z' }), ...changes });
const achievement = (id, name = 'Primer entrenamiento') => ({ kind: 'achievement', key: id, achievement: { notificationId: id, id: name, name } });

test('Home detecta una misión ya completada al abrir, y los refresh no duplican la cola', () => {
  const current = mission();
  let queue = reconcileWeeklyCelebration([], current, new Set());
  assert.equal(queue.length, 1); assert.equal(queue[0].kind, 'weekly');
  for (let i = 0; i < 5; i++) queue = reconcileWeeklyCelebration(queue, { ...current }, new Set());
  assert.equal(queue.length, 1);
  assert.equal(weeklyCelebrationKey(mission({ pointsAwardedAt: null })), null);
});

test('confirmar oculta; ACTIVE reaparece; nuevo otorgamiento permite celebrar otra vez', () => {
  const first = mission(), confirmed = new Set([weeklyCelebrationKey(first)]);
  assert.equal(weeklyCelebrationConfirmed(first, confirmed), true);
  assert.deepEqual(reconcileWeeklyCelebration([], first, confirmed), []);
  const active = mission({ state: 'ACTIVE', progress: 1, pointsAwardedAt: null });
  assert.equal(weeklyCelebrationConfirmed(active, confirmed), false);
  assert.deepEqual(reconcileWeeklyCelebration([{ kind: 'weekly', key: weeklyCelebrationKey(first), mission: first }], active, confirmed), []);
  const completedAgain = mission({ pointsAwardedAt: '2026-10-07T16:00:00Z' });
  assert.notEqual(weeklyCelebrationKey(completedAgain), weeklyCelebrationKey(first));
  assert.equal(reconcileWeeklyCelebration([], completedAgain, confirmed).length, 1);
  assert.equal(weeklyCelebrationConfirmed(mission({ id: 'next-week', state: 'ACTIVE', progress: 0 }), confirmed), false);
});

test('confirmación del servidor evita repetir tras reload, sin depender de storage local', () => {
  const confirmed = mission({ celebrationConfirmed: true });
  assert.equal(weeklyCelebrationConfirmed(confirmed, new Set()), true);
  assert.deepEqual(reconcileWeeklyCelebration([], confirmed, new Set()), []);
});

test('varios logros y objetivo comparten cola; deduplicación por evento, no por nombre', () => {
  const first = achievement('n1'), second = achievement('n2');
  let queue = enqueueCelebrations([], [first, first, second], new Set());
  assert.deepEqual(queue.map(item => item.key), ['n1', 'n2']);
  queue = reconcileWeeklyCelebration(queue, mission(), new Set());
  assert.equal(queue.length, 3);
  queue = enqueueCelebrations(queue.slice(1), [first, second], new Set(['n1']));
  assert.equal(queue.length, 2); assert.equal(queue[0].key, 'n2');
});

function serverFixture() {
  const receipts = [];
  let studentId = 'a', current = mission(), origin = true;
  const prisma = { achievementNotification: {
    findUnique: async ({ where }) => receipts.find(row => row.studentId === where.studentId_achievementKey.studentId && row.achievementKey === where.studentId_achievementKey.achievementKey) ?? null,
    upsert: async ({ where, create, update }) => {
      assert.deepEqual(update, {});
      const found = receipts.find(row => row.studentId === where.studentId_achievementKey.studentId && row.achievementKey === where.studentId_achievementKey.achievementKey);
      if (found) return found;
      const row = { id: `receipt-${receipts.length}`, ...create }; receipts.push(row); return row;
    },
    updateMany: async ({ where, data }) => {
      const rows = receipts.filter(row => row.id === where.id && row.studentId === where.studentId && row.celebratedAt === null);
      rows.forEach(row => Object.assign(row, data)); return { count: rows.length };
    },
    findFirst: async ({ where }) => receipts.find(row => row.id === where.id && row.studentId === where.studentId && row.celebratedAt) ?? null,
  } };
  const dependencies = {
    'server-only': {}, '@/lib/prisma': { prisma },
    '@/lib/notifiable-achievements': {},
    '@/lib/portal-auth': { getPortalSession: async () => studentId ? { studentId } : null, validRequestOrigin: () => origin },
    '@/lib/portal-celebrations': { weeklyCelebrationKey },
    '@/lib/weekly-mission-data': { loadCurrentWeeklyMission: async () => current },
  };
  const load = file => {
    const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const compiled = { exports: {} };
    new Function('require', 'module', 'exports', output)(id => { assert.ok(id in dependencies, `Unexpected dependency ${id}`); return dependencies[id]; }, compiled, compiled.exports);
    return compiled.exports;
  };
  const route = load('app/api/portal/achievements/celebration/route.ts');
  return { receipts, setStudent: id => studentId = id, setMission: value => current = value, setOrigin: value => origin = value,
    confirm: body => route.PATCH(new Request('https://bm.test/api/portal/achievements/celebration', { method: 'PATCH', body: JSON.stringify(body) })),
    state: load('lib/weekly-celebration-state.ts').withWeeklyCelebrationState,
  };
}

test('confirmación semanal persistente e idempotente, aislada por alumno y sin escribir puntos', async () => {
  const f = serverFixture(), key = weeklyCelebrationKey(mission());
  assert.equal((await f.state('a', mission())).celebrationConfirmed, false);
  for (let i = 0; i < 3; i++) assert.equal((await f.confirm({ kind: 'weekly', key })).status, 200);
  assert.equal(f.receipts.length, 1); assert.equal(f.receipts[0].status, 'BASELINE');
  assert.equal((await f.state('a', mission())).celebrationConfirmed, true);
  assert.equal((await f.state('b', mission())).celebrationConfirmed, false);
  f.setMission(mission({ state: 'ACTIVE', progress: 1, pointsAwardedAt: null }));
  assert.equal((await f.confirm({ kind: 'weekly', key })).status, 409);
  const renewed = mission({ pointsAwardedAt: '2026-10-07T16:00:00Z' }); f.setMission(renewed);
  assert.equal((await f.state('a', renewed)).celebrationConfirmed, false);
  assert.equal((await f.confirm({ kind: 'weekly', key })).status, 409);
  assert.equal((await f.confirm({ kind: 'weekly', key: weeklyCelebrationKey(renewed) })).status, 200);
  assert.equal(f.receipts.length, 2);
});

test('PATCH de logro admite reintentos y rechaza IDs ajenos, origen inválido y sesión vencida', async () => {
  const f = serverFixture();
  f.receipts.push({ id: 'own', studentId: 'a', celebratedAt: null }, { id: 'foreign', studentId: 'b', celebratedAt: null });
  assert.equal((await f.confirm({ notificationId: 'own' })).status, 200);
  assert.equal((await f.confirm({ notificationId: 'own' })).status, 200);
  assert.equal((await f.confirm({ notificationId: 'foreign' })).status, 404);
  f.setOrigin(false); assert.equal((await f.confirm({ notificationId: 'own' })).status, 403);
  f.setOrigin(true); f.setStudent(null); assert.equal((await f.confirm({ notificationId: 'own' })).status, 401);
});
