import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isPointEligibleQuickLog } from '../lib/quick-log-point-rules.ts';
import { buildValidPointEvents } from '../lib/point-event-rules.ts';
const require = createRequire(import.meta.url), ts = require('typescript');
const date = new Date('2026-10-08T12:00:00Z');
const log = (id, fields = {}) => ({ id, studentId: 'a', type: 'NOTE', metricType: 'free_note', exerciseName: '', sets: null, repetitions: null, currentValue: null, previousValue: null, durationMinutes: null, date, createdAt: date, ...fields });
const strength = { type: 'PROGRESS', metricType: 'carga', exerciseName: 'Sentadilla', sets: 3, repetitions: 10, currentValue: 40 };

function fixture() {
  const logs = [], rows = [], notifications = [], pushes = [];
  const students = [{ id: 'a', workspaceId: 'w1', serviceType: 'MIXED', data: { status: 'activo', name: 'A' } }, { id: 'b', workspaceId: 'w2', serviceType: 'MIXED', data: { status: 'activo', name: 'B' } }];
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(item => matches(row, item));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('gte' in value) return row[key] >= value.gte;
    }
    return row[key] === value;
  });
  const empty = { findMany: async () => [] };
  const prisma = {
    studentRecord: { findUnique: async ({where}) => students.find(s => s.id === where.id), findMany: async ({where}) => students.filter(s => s.workspaceId === where.workspaceId) },
    quickLog: { findMany: async ({where}) => logs.filter(row => matches(row, where)) },
    classOccurrenceAttendance: empty, classAttendance: empty, workoutSession: empty, studentWeeklyMission: empty, studentPayment: empty,
    studentMembershipHistory: { findMany: async () => [] },
    studentPointTransaction: {
      findMany: async ({where}) => rows.filter(row => matches(row, where)),
      upsert: async ({where, create, update}) => { const found = rows.find(row => matches(row, where.studentId_eventKey)); if (found) Object.assign(found, update); else rows.push({ id: `p${rows.length}`, active: true, notifiedAt: null, ...create }); },
      updateMany: async ({where, data}) => { const selected = rows.filter(row => matches(row, where)); selected.forEach(row => Object.assign(row, data)); return {count: selected.length}; },
      aggregate: async ({where}) => ({_sum: {points: rows.filter(row => matches(row, where)).reduce((sum, row) => sum + row.points, 0)}}),
    },
    studentNotification: { create: async ({data}) => notifications.push(data) },
    $transaction: async callback => callback(prisma),
  };
  const dependencies = {
    'server-only': {}, 'next/server': {after: () => {}}, '@/lib/prisma': {prisma},
    '@/lib/attendance': {studentName: data => data.name},
    '@/lib/point-event-rules': {buildValidPointEvents, pointEventKeysToInvalidate: (previous, desired) => previous.filter(row => row.active && !desired.some(event => event.eventKey === row.eventKey)).map(row => row.eventKey)},
    '@/lib/quick-log-point-rules': {isPointEligibleQuickLog},
    '@/lib/trainer-notifications': {}, '@/lib/push-notifications': {sendStudentPush: async (...args) => pushes.push(args)},
    '@/lib/trainer-notification-destination': {}, '@/lib/weekly-mission-data': {resolveCurrentWeeklyMission: async () => {}, reconcileWeeklyMissionForDate: async () => {}},
    '@/lib/payment-notification-rules': {}, '@/lib/point-period': {pointPeriodStart: () => null},
    '@/lib/student-service': {isCompetitiveGamificationEligible: () => true, wasCompetitiveDuringMembership: () => true},
    '@/lib/student-media': {studentProfilePhoto: () => ''}, '@/lib/coached-students': {coachedStudentsWhere: {}},
  };
  const load = path => { const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText; const compiled = {exports:{}}; new Function('require','module','exports',code)(id => { assert.ok(id in dependencies, `Unexpected dependency ${id}`); return dependencies[id]; },compiled,compiled.exports); return compiled.exports; };
  const repair = load('../lib/quick-log-point-reconciliation.ts');
  dependencies['@/lib/quick-log-point-reconciliation'] = repair;
  return {logs, rows, notifications, pushes, ...repair, ...load('../lib/student-points.ts'), ...load('../lib/point-ranking.ts')};
}

test('allowlist conserva métricas actuales; texto, fotos y tipos desconocidos valen cero', () => {
  for (const facts of [strength, {...strength,currentValue:null}, {type:'PROGRESS',metricType:'peso',exerciseName:'Peso corporal',currentValue:70}, {type:'WORKOUT',metricType:'for_time',currentValue:120}, {type:'WORKOUT',metricType:'rounds',sets:4}, {type:'WORKOUT',metricType:'amrap',sets:4,durationMinutes:10}, {type:'WORKOUT',metricType:'emom',sets:8,durationMinutes:10}, {type:'WORKOUT',metricType:'cardio',durationMinutes:30}, {type:'WORKOUT',metricType:'intervals',sets:5,currentValue:30,previousValue:15}, {type:'WORKOUT',metricType:'peso',durationMinutes:30}]) assert.equal(isPointEligibleQuickLog(facts),true,JSON.stringify(facts));
  for (const facts of [{...strength,type:'NOTE'}, {type:'PHOTO'}, {type:'WORKOUT'}, {type:'WORKOUT',metricType:'free_note',durationMinutes:30}, {type:'PROGRESS',metricType:'observacion',exerciseName:'Texto',currentValue:1}, {type:'UNKNOWN'}]) assert.equal(isPointEligibleQuickLog(facts),false,JSON.stringify(facts));
});
test('crear/editar/eliminar nota no crea movimiento, notificación, push ni ranking', async () => {
  const f=fixture(); f.logs.push(log('note'));
  for (const content of ['Nota personal','Observación actualizada']) { f.logs[0].content=content; assert.equal((await f.syncStudentPoints('a')).total,0); }
  f.logs.length=0; await f.syncStudentPoints('a');
  assert.deepEqual(f.rows,[]); assert.deepEqual(f.notifications,[]); assert.deepEqual(f.pushes,[]);
  assert.equal((await f.loadPointRanking('total','w1'))[0].total,0);
});
test('registro válido da +3 y editar/reintentar no duplica movimiento ni aviso', async () => {
  const f=fixture(); f.logs.push(log('strength',strength));
  assert.equal((await f.syncStudentPoints('a')).total,3);
  f.logs[0].currentValue=45; await f.syncStudentPoints('a'); await f.syncStudentPoints('a');
  assert.equal(f.rows.length,1); assert.equal(f.notifications.length,1); assert.equal(f.pushes.length,1);
  assert.equal((await f.loadPointRanking('total','w1'))[0].total,3);
});
test('eliminar registro válido inactiva su movimiento, conserva historial técnico y es idempotente', async () => {
  const f=fixture(); f.logs.push(log('strength',strength)); await f.syncStudentPoints('a'); f.logs.length=0;
  assert.equal((await f.syncStudentPoints('a')).total,0); await f.syncStudentPoints('a');
  assert.equal(f.rows.length,1); assert.equal(f.rows[0].active,false);
  assert.equal((await f.loadStudentPointSummary('a')).recent.length,0);
});
test('cambiar a NOTE retira puntos aunque conserve campos numéricos; otro alumno/workspace intactos', async () => {
  const f=fixture(); f.logs.push(log('strength',strength),log('other',{...strength,studentId:'b'}));
  await f.syncStudentPoints('a'); await f.syncStudentPoints('b');
  f.logs[0].type='NOTE'; assert.equal((await f.syncStudentPoints('a')).total,0);
  assert.equal(f.rows.find(row=>row.studentId==='b').active,true);
  assert.equal((await f.loadPointRanking('total','w2'))[0].total,3);
});
test('ranking reconcilia +3 históricos por alumno/fuente/id/clave sin tocar válidos ni coincidencias textuales', async () => {
  const f=fixture(); f.logs.push(log('note'),log('valid',strength),log('b-note',{studentId:'b'}));
  for (const [id,studentId,sourceType] of [['note','a','QUICK_LOG'],['valid','a','QUICK_LOG'],['b-note','b','QUICK_LOG'],['unrelated','a','PAYMENT']]) f.rows.push({id,studentId,eventKey:`record:quick-log:${id}`,sourceId:id,sourceType,active:true,points:3,occurredAt:date,description:'Registro cargado: nota personal'});
  assert.equal((await f.loadPointRanking('total','w1'))[0].total,6);
  assert.equal(f.rows[0].active,false); assert.ok(f.rows.slice(1).every(row=>row.active));
  await f.reconcileInformativeQuickLogPoints(['a']); assert.ok(f.rows.slice(1).every(row=>row.active));
});
test('notas no alimentan logros por puntos ni de fuerza; celebraciones permanecen fuera de esta corrección', () => {
  const source=readFileSync(new URL('../lib/notifiable-achievements.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/studentPointTransaction|loadStudentPointSummary/);
  const strengthSource=readFileSync(new URL('../lib/quick-log-achievements.ts',import.meta.url),'utf8');
  assert.match(strengthSource,/type: "PROGRESS",\s+metricType: "carga"/);
  assert.deepEqual(buildValidPointEvents({quickLogs:[{...log('note'),description:'Nota'}]}),[]);
});
