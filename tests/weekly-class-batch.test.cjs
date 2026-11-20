const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

const source = readFileSync('app/api/clases/route.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const input = (dayOfWeeks) => ({ dayOfWeek: dayOfWeeks[0], dayOfWeeks, classType: 'Funcional', startTime: '07:00', endTime: '08:00', active: true, capacity: 8, studentIds: ['alumno-1', 'alumno-2'] });

function route(options = {}) {
  const records = options.records ?? [];
  let failDay = options.failDay;
  const prisma = { weeklyClassSchedule: { findMany: async () => records }, $transaction: async (callback) => {
    const staged = records.map((record) => ({ ...record }));
    const result = await callback({
      $queryRaw: async () => [],
      weeklyClassSchedule: {
        findMany: async ({ where }) => staged.filter((item) => item.workspaceId === where.workspaceId && where.dayOfWeek.in.includes(item.dayOfWeek)),
        create: async ({ data }) => {
          if (data.dayOfWeek === failDay) throw new Error('falló la creación');
          const saved = { id: `horario-${staged.length + 1}`, ...data };
          staged.push(saved);
          return saved;
        },
      },
    });
    records.splice(0, records.length, ...staged);
    return result;
  } };
  const mocks = {
    '@prisma/client': { Prisma: { PrismaClientInitializationError: class extends Error {}, PrismaClientKnownRequestError: class extends Error {} } },
    '@/lib/prisma': { prisma },
    '@/lib/weekly-classes': {
      parseWeeklyClassInput: (body) => ({ data: { dayOfWeek: body.dayOfWeek, classType: body.classType, startTime: body.startTime, endTime: body.endTime, active: body.active, capacity: body.capacity, studentIds: body.studentIds }, error: null }),
      serializeWeeklyClass: (item) => item,
      studentsExist: async (_transaction, ids, workspaceId) => workspaceId === 'workspace-a' && ids.every((id) => id.startsWith('alumno-')),
      weeklyClassInclude: {}, WEEKDAYS: weekdays,
    },
    '@/lib/trainer-workspace': { requireTrainerWorkspace: async () => ({ workspaceId: 'workspace-a' }) },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)((name) => { if (!(name in mocks)) throw new Error(name); return mocks[name]; }, module, module.exports);
  return { POST: module.exports.POST, records, fail: (day) => { failDay = day; } };
}

const send = (POST, body) => POST(new Request('http://localhost/api/clases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

test('la validación real admite siete días y conserva límites de hora, cupo y alumnos', () => {
  const weeklySource = readFileSync('lib/weekly-classes.ts', 'utf8');
  const weeklyJs = ts.transpileModule(weeklySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', weeklyJs)((name) => name === 'server-only' ? {} : { coachedStudentsWhere: {} }, module, module.exports);
  const parse = module.exports.parseWeeklyClassInput;
  for (const dayOfWeek of weekdays) assert.equal(parse({ ...input([dayOfWeek]), dayOfWeek }).data?.dayOfWeek, dayOfWeek);
  assert.equal(parse({ ...input(['MONDAY']), endTime: '06:00' }).data, null);
  assert.equal(parse({ ...input(['MONDAY']), capacity: 1 }).data, null);
  assert.equal(parse({ ...input(['MONDAY']), studentIds: ['alumno-1', 'alumno-1'] }).data.studentIds.length, 1);
});

test('crea horarios independientes con alumnos, cupo, estado y horas compartidas', async () => {
  const { POST, records } = route();
  const response = await send(POST, input(['MONDAY', 'WEDNESDAY', 'SATURDAY']));
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.deepEqual(created.map((item) => item.dayOfWeek), ['MONDAY', 'WEDNESDAY', 'SATURDAY']);
  assert.equal(new Set(created.map((item) => item.id)).size, 3);
  for (const item of created) { assert.equal(item.workspaceId, 'workspace-a'); assert.equal(item.capacity, 8); assert.equal(item.active, true); assert.equal(item.startTime, '07:00'); assert.equal(item.endTime, '08:00'); assert.deepEqual(item.assignments.create.map((entry) => entry.studentId), ['alumno-1', 'alumno-2']); }
  assert.equal(records.length, 3);
});

test('una falla revierte toda la operación', async () => {
  const { POST, records } = route({ failDay: 'WEDNESDAY' });
  const originalError = console.error; console.error = () => {};
  try { assert.equal((await send(POST, input(['MONDAY', 'WEDNESDAY']))).status, 500); }
  finally { console.error = originalError; }
  assert.equal(records.length, 0);
});

test('rechaza selección repetida y horarios superpuestos sin crear duplicados', async () => {
  const { POST, records } = route();
  assert.equal((await send(POST, input(['MONDAY', 'MONDAY']))).status, 400);
  assert.equal((await send(POST, input(['MONDAY']))).status, 201);
  const originalError = console.error; console.error = () => {};
  try { assert.equal((await send(POST, { ...input(['MONDAY']), startTime: '07:30' })).status, 409); }
  finally { console.error = originalError; }
  assert.equal(records.length, 1);
});

test('la creación individual conserva la respuesta anterior', async () => {
  const { POST } = route();
  const { dayOfWeeks, ...single } = input(['SUNDAY']);
  const response = await send(POST, single);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).dayOfWeek, 'SUNDAY');
});
