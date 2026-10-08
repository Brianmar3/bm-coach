import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// Execute the real loaders, ledger writer and ranking against an isolated DB double.
// No production database, notifications or network are used.
function fixture() {
  const students = ['a', 'b', 'c'].map((id, i) => ({ id, workspaceId: i === 2 ? 'other' : 'workspace', serviceType: 'CLASSES', data: { status: 'activo', firstName: id, plan: '2 días' } }));
  const missions = [], occurrences = [], legacy = [], ledger = [];
  const memberships = students.map(s => ({ studentId: s.id, startDate: new Date('2020-01-01'), endDate: null, frequencyDays: 2, serviceType: 'CLASSES' }));
  const compare = (value, condition) => {
    // Attendance/mission dates are PostgreSQL @db.Date calendar values.
    if (condition === null || typeof condition !== 'object' || condition instanceof Date) return value instanceof Date && condition instanceof Date ? value.toISOString().slice(0, 10) === condition.toISOString().slice(0, 10) : value === condition;
    return Object.entries(condition).every(([key, expected]) => {
      if (key === 'in') return expected.includes(value);
      if (key === 'not') return !compare(value, expected);
      const left = value instanceof Date ? value.toISOString().slice(0, 10) : value;
      const right = expected instanceof Date ? expected.toISOString().slice(0, 10) : expected;
      if (key === 'gte') return left >= right;
      if (key === 'gt') return left > right;
      if (key === 'lt') return left < right;
      if (key === 'lte') return left <= right;
      return compare(value?.[key], expected);
    });
  };
  const matches = (row, where = {}) => Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return condition.some(item => matches(row, item));
    if (key === 'AND') return condition.every(item => matches(row, item));
    return compare(row[key], condition);
  });
  const table = rows => ({
    findMany: async ({ where = {} } = {}) => rows.filter(row => matches(row, where)).sort((a, b) => (a.occurredAt ?? a.date ?? a.weekStart ?? 0) - (b.occurredAt ?? b.date ?? b.weekStart ?? 0)),
    findUnique: async ({ where }) => {
      const condition = where.studentId_weekStart ?? where.studentId_eventKey ?? where;
      return rows.find(row => matches(row, condition)) ?? null;
    },
    update: async ({ where, data }) => { const row = rows.find(row => matches(row, where)); assert.ok(row); Object.assign(row, data); return row; },
    updateMany: async ({ where, data }) => { const found = rows.filter(row => matches(row, where)); found.forEach(row => Object.assign(row, data)); return { count: found.length }; },
    create: async ({ data }) => { const row = { id: `row-${rows.length}`, completedAt: null, pointsAwardedAt: null, active: true, notifiedAt: null, createdAt: new Date(), ...data }; rows.push(row); return row; },
    upsert: async ({ where, create, update }) => {
      const condition = where.studentId_eventKey ?? where.scheduleId_studentId_date ?? where;
      const row = rows.find(row => matches(row, condition));
      if (row) { Object.assign(row, update); return row; }
      const added = { id: `row-${rows.length}`, active: true, invalidatedAt: null, notifiedAt: null, createdAt: new Date(), ...create }; rows.push(added); return added;
    },
    aggregate: async ({ where }) => ({ _sum: { points: rows.filter(row => matches(row, where)).reduce((sum, row) => sum + row.points, 0) } }),
  });
  const prisma = {
    studentRecord: table(students), studentWeeklyMission: table(missions), studentPointTransaction: table(ledger),
    classOccurrenceAttendance: table(occurrences), classAttendance: table(legacy), studentMembershipHistory: table(memberships),
    quickLog: table([]), workoutSession: table([]), studentPayment: table([]), studentNotification: table([]),
    weeklyClassSchedule: table([]), classOccurrence: table([]),
    $transaction: async fn => fn(prisma),
  };
  prisma.classAttendance.findFirst = prisma.classAttendance.findUnique;
  prisma.classAttendance.deleteMany = async ({ where }) => { for (let i = legacy.length - 1; i >= 0; i--) if (matches(legacy[i], where)) legacy.splice(i, 1); return { count: 1 }; };
  prisma.studentRecord.findUnique = async ({ where }) => {
    const student = students.find(s => matches(s, where));
    return student ? { ...student, membershipHistory: memberships.filter(m => m.studentId === student.id) } : null;
  };
  const cache = new Map();
  const stubs = {
    'server-only': {}, 'next/server': { after() {} }, '@/lib/prisma': { prisma },
    '@/lib/coached-students': { coachedStudentsWhere: {} },
    '@/lib/student-enrollment': { planDays: () => 2, weeklyScheduleLabel: () => 'Clase' },
    '@/lib/student-media': { studentProfilePhoto: () => '' },
    '@/lib/trainer-workspace': { requireTrainerWorkspace: async () => ({ workspaceId: 'workspace' }) },
    '@/lib/class-occurrences': { ensureClassOccurrences: async () => {} },
    '@/lib/effective-class-session': {},
    '@/lib/trainer-notifications': { dispatchTrainerPush: async () => {}, TRAINER_OWNER_KEY: 'trainer' },
    '@/lib/push-notifications': { sendStudentPush: async () => {}, notifyNewAchievements: async () => [], achievementCelebrationPayload: async () => [] },
  };
  function load(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute);
    const compiled = { exports: {} }; cache.set(absolute, compiled.exports);
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const resolve = id => {
      if (id in stubs) return stubs[id];
      if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`);
      if (id.startsWith('.')) return load(path.resolve(path.dirname(absolute), id));
      return require(id);
    };
    new Function('require', 'module', 'exports', code)(resolve, compiled, compiled.exports);
    return compiled.exports;
  }
  const dates = load('lib/weekly-attendance.ts');
  const today = dates.argentinaDateKey();
  const range = dates.weekRange(today);
  const day = offset => dates.addDateDays(range.start, offset);
  const addMission = (studentId, start = range.start) => {
    const week = dates.weekRange(start);
    const mission = { id: `${studentId}-${start}`, studentId, weekStart: new Date(start), weekEnd: new Date(week.end), title: 'Completá tus 2 entrenamientos semanales', target: 2, scheduledClassKeys: [], progress: 0, state: 'ACTIVE', rewardPoints: 9, completedAt: null, pointsAwardedAt: null };
    missions.push(mission); return mission;
  };
  const mark = (studentId, date, status) => {
    const student = students.find(s => s.id === studentId);
    const id = `${studentId}-${date}`;
    const old = occurrences.find(a => a.id === id);
    if (old) old.actualAttendance = status;
    else occurrences.push({ id, studentId, actualAttendance: status, checkedInAt: new Date(), updatedAt: new Date(), occurrence: { workspaceId: student.workspaceId, date: new Date(date), status: 'SCHEDULED', classNameSnapshot: 'Clase', startTime: '17:00', endTime: '18:00', scheduleId: 'schedule' } });
  };
  return { missions, ledger, students, day, range, today, addMission, mark, load, legacy, memberships };
}

test('0 → 1 → 2 → Ausente → Presente: misión, fechas, ledger, historial y ranking reconciliables', async () => {
  const f = fixture(), mission = f.addMission('a');
  const service = f.load('lib/weekly-mission-data.ts'), points = f.load('lib/student-points.ts'), ranking = f.load('lib/point-ranking.ts');
  for (const [secondStatus, expected] of [[null, 0], [null, 1], ['PRESENT', 2], ['ABSENT', 1], ['PRESENT', 2], ['ABSENT', 0], ['PRESENT', 2]]) {
    if (expected > 0) f.mark('a', f.day(0), 'PRESENT');
    else if (secondStatus) f.mark('a', f.day(0), 'ABSENT');
    if (secondStatus) f.mark('a', f.day(1), secondStatus);
    await points.syncStudentPoints('a', { notify: false, attendanceDate: f.day(1) });
    const view = await service.loadCurrentWeeklyMission('a', f.today);
    assert.equal(view.progress, expected); assert.equal(view.percentage, expected * 50);
    assert.equal(view.state, expected === 2 ? 'COMPLETED' : 'ACTIVE');
    assert.equal(Boolean(mission.completedAt), expected === 2);
    assert.equal(Boolean(mission.pointsAwardedAt), expected === 2);
    const summary = await points.loadStudentPointSummary('a', 40);
    const expectedPoints = expected * 7 + (expected === 2 ? 5 : 0); // unchanged +5 attendance, +2 session, +5 bonus
    assert.equal(summary.total, expectedPoints);
    assert.equal(summary.recent.reduce((sum, row) => sum + row.points, 0), expectedPoints);
    const board = await ranking.loadPointRanking('month', 'workspace');
    assert.ok(board.every(row => row.studentId !== 'c'));
    const monthly = summary.recent.filter(row => new Date(row.occurredAt) >= f.load('lib/point-period.ts').pointPeriodStart('month')).reduce((sum, row) => sum + row.points, 0);
    assert.equal(board.find(row => row.studentId === 'a').total, monthly);
    const bonus = f.ledger.filter(row => row.eventKey === `weekly-mission-bonus:${mission.id}`);
    assert.ok(bonus.length <= 1); assert.equal(bonus.filter(row => row.active).length, expected === 2 ? 1 : 0);
    assert.equal(f.ledger.some(row => row.points < 0), false);
  }
  const before = structuredClone(f.ledger);
  await points.syncStudentPoints('a', { notify: false, attendanceDate: f.day(1) });
  assert.deepEqual(f.ledger, before);
});

test('Justificada, sin marcar y Ausente no cuentan; al volver a Presente recupera el mismo bonus', async () => {
  const f = fixture(), mission = f.addMission('a'), points = f.load('lib/student-points.ts');
  f.mark('a', f.day(0), 'PRESENT');
  for (const status of ['PRESENT', 'CANCELLED', 'PRESENT', 'UNKNOWN', 'PRESENT', 'ABSENT', 'PRESENT']) {
    f.mark('a', f.day(1), status);
    await points.syncStudentPoints('a', { notify: false, attendanceDate: f.day(1) });
    assert.equal(mission.progress, status === 'PRESENT' ? 2 : 1);
    assert.equal(mission.state, status === 'PRESENT' ? 'COMPLETED' : 'ACTIVE');
    assert.equal(f.ledger.filter(row => row.active && row.eventKey.startsWith('weekly-mission-bonus:')).length, status === 'PRESENT' ? 1 : 0);
  }
  assert.equal(f.ledger.filter(row => row.eventKey.startsWith('weekly-mission-bonus:')).length, 1);
});

test('corregir una semana cerrada no cambia otras semanas, alumnos ni workspaces', async () => {
  const f = fixture(), dates = f.load('lib/weekly-attendance.ts'), service = f.load('lib/weekly-mission-data.ts'), points = f.load('lib/student-points.ts');
  const pastStart = dates.addDateDays(f.range.start, -7);
  const olderStart = dates.addDateDays(pastStart, -7);
  const older = f.addMission('a', olderStart);
  f.mark('a', olderStart, 'PRESENT'); f.mark('a', dates.addDateDays(olderStart, 1), 'PRESENT');
  await points.syncStudentPoints('a', { notify: false, attendanceDate: olderStart });
  const olderLedger = structuredClone(f.ledger);
  const past = f.addMission('a', pastStart);
  const others = [older, f.addMission('a'), f.addMission('a', dates.addDateDays(f.range.start, 7)), f.addMission('b'), f.addMission('c')];
  f.mark('a', pastStart, 'PRESENT'); f.mark('a', dates.addDateDays(pastStart, 1), 'PRESENT');
  await points.syncStudentPoints('a', { notify: false, attendanceDate: pastStart });
  const snapshots = structuredClone(others);
  // Seed unrelated ledger entries and verify their values/validity/timestamps remain unchanged.
  const unrelated = [{ id: 'b-points', studentId: 'b', eventKey: 'attendance:other-b', points: 5, active: true }, { id: 'c-points', studentId: 'c', eventKey: 'attendance:other-c', points: 5, active: true }];
  f.ledger.push(...unrelated); const previous = structuredClone(unrelated);
  f.mark('a', dates.addDateDays(pastStart, 1), 'ABSENT');
  await points.syncStudentPoints('a', { notify: false, attendanceDate: pastStart });
  assert.equal(past.progress, 1); assert.equal(past.state, 'EXPIRED'); assert.equal(past.completedAt, null); assert.equal(past.pointsAwardedAt, null);
  assert.deepEqual(others, snapshots); assert.deepEqual(unrelated, previous);
  assert.deepEqual(f.ledger.filter(row => olderLedger.some(old => old.id === row.id)), olderLedger);
  assert.equal(f.ledger.find(row => row.eventKey === `weekly-mission-bonus:${past.id}`).active, false);
  f.mark('a', dates.addDateDays(pastStart, 1), 'PRESENT');
  await points.syncStudentPoints('a', { notify: false, attendanceDate: pastStart });
  assert.equal(past.state, 'COMPLETED'); assert.deepEqual(others, snapshots);
  assert.equal(f.ledger.filter(row => row.eventKey === `weekly-mission-bonus:${past.id}`).length, 1);
  // Noon UTC date keys and existing Argentina weekly boundaries are retained.
  assert.equal(dates.weekRange(dates.argentinaDateKey(new Date('2026-10-12T02:30:00Z'))).start, '2026-10-05');
  assert.equal(await service.reconcileWeeklyMissionForDate('a', dates.addDateDays(olderStart, -7)), null);
});

test('lectura de Home repara el snapshot COMPLETED obsoleto; merge acepta la regresión', async () => {
  const f = fixture(), mission = f.addMission('a');
  Object.assign(mission, { progress: 2, state: 'COMPLETED', completedAt: new Date(), pointsAwardedAt: new Date() });
  f.mark('a', f.day(0), 'PRESENT'); f.mark('a', f.day(1), 'ABSENT');
  const view = await f.load('lib/weekly-mission-data.ts').loadCurrentWeeklyMission('a', f.today);
  assert.equal(view.state, 'ACTIVE'); assert.equal(view.progress, 1); assert.equal(view.percentage, 50);
  const merge = f.load('lib/portal-weekly-mission-refresh.ts').mergePortalRefresh;
  const incoming = { profile: { id: 'a', status: 'activo', serviceType: 'CLASSES' }, home: { weeklyMission: view } };
  const previous = { ...incoming, home: { weeklyMission: { ...view, state: 'COMPLETED', progress: 2, percentage: 100 } } };
  assert.equal(merge(previous, incoming, f.today).home.weeklyMission, view);
});

test('endpoint de Asistencias reconcilia también Justificada y borrar, con la fecha editada', async () => {
  const f = fixture(), mission = f.addMission('a'), api = f.load('app/api/asistencias/route.ts');
  const save = async (date, status) => {
    const response = await api.PUT(new Request('https://bm.test/api/asistencias', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, records: [{ studentId: 'a', status }] }) }));
    assert.equal(response.status, 200, await response.text());
  };
  await save(f.day(0), 'presente');
  for (const status of ['presente', 'ausente', 'presente', 'justificado', 'presente', null, 'presente']) {
    await save(f.day(1), status);
    assert.equal(mission.progress, status === 'presente' ? 2 : 1);
    assert.equal(mission.state, status === 'presente' ? 'COMPLETED' : 'ACTIVE');
  }
  const before = structuredClone(f.missions);
  const rejected = await api.PUT(new Request('https://bm.test/api/asistencias', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: f.day(1), records: [{ studentId: 'c', status: 'ausente' }] }) }));
  assert.equal(rejected.status, 400); assert.deepEqual(f.missions, before);
});
