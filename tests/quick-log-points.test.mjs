import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isPointEligibleQuickLog } from '../lib/quick-log-point-rules.ts';
import { buildSportsPointEvents } from '../lib/sports-point-policy.ts';
import * as services from '../lib/student-service.ts';
import * as paymentRules from '../lib/payment-notification-rules.ts';
import * as dates from '../lib/payment-dates.ts';
import { weekRange } from '../lib/weekly-attendance.ts';
import { buildValidPointEvents, effectivePointDate } from '../lib/point-event-rules.ts';
const require = createRequire(import.meta.url), ts = require('typescript');
const date = new Date('2026-10-08T12:00:00Z');
const log = (id, fields = {}) => ({ id, studentId: 'a', type: 'NOTE', metricType: 'free_note', exerciseName: '', sets: null, repetitions: null, currentValue: null, previousValue: null, durationMinutes: null, date, createdAt: date, ...fields });
const strength = { type: 'PROGRESS', metricType: 'carga', exerciseName: 'Sentadilla', sets: 3, repetitions: 10, currentValue: 40 };

function fixture(sportsStart = '') {
  const logs = [], rows = [], notifications = [], pushes = [], payments = [];
  const students = [{ id: 'a', workspaceId: 'w1', serviceType: 'MIXED', data: { status: 'activo', name: 'A' } }, { id: 'b', workspaceId: 'w2', serviceType: 'MIXED', data: { status: 'activo', name: 'B' } }];
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(item => matches(row, item));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('gt' in value && !(row[key] > value.gt)) return false;
      if ('gt' in value) return true;
      if ('gte' in value) return row[key] >= value.gte;
      if ('lt' in value) return row[key] < value.lt;
    }
    return row[key] === value;
  });
  let transactionTail = Promise.resolve();
  const empty = { findMany: async () => [] };
  const prisma = {
    studentRecord: { findUnique: async ({where}) => students.find(s => s.id === where.id), findMany: async ({where}) => students.filter(s => s.workspaceId === where.workspaceId) },
    quickLog: { findMany: async ({where}) => logs.filter(row => matches(row, where)) },
    classOccurrenceAttendance: empty, classAttendance: empty, workoutSession: empty, studentWeeklyMission: empty, studentPayment: {findMany: async ({where}) => payments.filter(row => matches(row, where))},
    studentMembershipHistory: { findMany: async () => [] },
    studentPointTransaction: {
      findMany: async ({where}) => rows.filter(row => matches(row, where)),
      upsert: async ({where, create, update}) => { const found = rows.find(row => matches(row, where.studentId_eventKey)); if (found) Object.assign(found, update); else rows.push({ id: `p${rows.length}`, active: true, notifiedAt: null, ...create }); },
      updateMany: async ({where, data}) => { const selected = rows.filter(row => matches(row, where)); selected.forEach(row => Object.assign(row, data)); return {count: selected.length}; },
      aggregate: async ({where}) => ({_sum: {points: rows.filter(row => matches(row, where)).reduce((sum, row) => sum + row.points, 0)}}),
    },
    studentNotification: { create: async ({data}) => notifications.push(data) },
    $executeRaw: async () => {},
    $transaction: async callback => {
      if (!sportsStart) return callback(prisma);
      const result = transactionTail.then(() => callback(prisma));
      transactionTail = result.catch(() => {});
      return result;
    },
  };
  const dependencies = {
    '@prisma/client': {Prisma:{sql: (...args) => args}}, '@/lib/payment-dates': {...dates, argentinaMonthBounds: () => dates.argentinaMonthBounds(sportsStart || undefined), argentinaDateKey: (date) => date ? dates.argentinaDateKey(date) : sportsStart ? '2026-12-06' : dates.argentinaDateKey()}, '@/lib/weekly-attendance': {weekRange},
    '@/lib/sports-point-policy': {activeSportsPointStart: () => sportsStart, buildSportsPointEvents},
    '@/lib/sports-point-data': {loadSportsActivity: async (studentId) => ({days: [{id:'session',date:'2026-12-02',kind:'routine',hasWeight:true}], contracts: [], serviceType: students.find(student => student.id === studentId)?.serviceType})},
    '@/lib/notifiable-achievements': {loadNotifiableAchievements: async () => []},
    'server-only': {}, 'next/server': {after: () => {}}, '@/lib/prisma': {prisma},
    '@/lib/attendance': {studentName: data => data.name},
    '@/lib/point-event-rules': {buildValidPointEvents, effectivePointDate, pointEventKeysToInvalidate: (previous, desired) => previous.filter(row => row.active && !desired.some(event => event.eventKey === row.eventKey)).map(row => row.eventKey)},
    '@/lib/quick-log-point-rules': {isPointEligibleQuickLog},
    '@/lib/trainer-notifications': {}, '@/lib/push-notifications': {sendStudentPush: async (...args) => pushes.push(args)},
    '@/lib/trainer-notification-destination': {}, '@/lib/weekly-mission-data': {resolveCurrentWeeklyMission: async () => {}, reconcileWeeklyMissionForDate: async () => {}},
    '@/lib/payment-notification-rules': paymentRules, '@/lib/point-period': {pointPeriodStart: period => sportsStart && period === 'month' ? new Date('2026-12-01T03:00:00Z') : null},
    '@/lib/student-service': services,
    '@/lib/student-media': {studentProfilePhoto: () => ''}, '@/lib/coached-students': {coachedStudentsWhere: {}},
  };
  const load = path => { const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText; const compiled = {exports:{}}; new Function('require','module','exports',code)(id => { assert.ok(id in dependencies, `Unexpected dependency ${id}`); return dependencies[id]; },compiled,compiled.exports); return compiled.exports; };
  const repair = load('../lib/quick-log-point-reconciliation.ts');
  dependencies['@/lib/quick-log-point-reconciliation'] = repair;
  return {logs, rows, notifications, pushes, students, payments, ...repair, ...load('../lib/student-points.ts'), ...load('../lib/point-ranking.ts')};
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

test('sports sync preserves all pre-cutoff movement fields and replaces obsolete December bonuses', async () => {
 const f=fixture('2026-12-01');
 const historic={studentId:'a',eventKey:'historic',sourceType:'ACHIEVEMENT',sourceId:'old',points:3,occurredAt:new Date('2026-11-28T12:00:00Z'),active:true,notifiedAt:null};
 const obsolete={...historic,eventKey:'weekly-mission:obsolete',sourceType:'WEEKLY_MISSION',points:15,occurredAt:new Date('2026-12-02T12:00:00Z')};
 f.rows.push({...historic},obsolete);
 await f.syncStudentPoints('a',{notify:false});
 await f.syncStudentPoints('a',{notify:false});
 assert.deepEqual(f.rows[0],historic);
 assert.equal(obsolete.active,false);
 assert.deepEqual(f.rows.filter(item=>item.active&&item!==f.rows[0]).map(item=>item.points),[2,1]);
});

test('24 solicitudes concurrentes a sync producen un movimiento por clave y un aviso', async () => {
 const f=fixture('2026-12-01');
 await Promise.all(Array.from({length:24},()=>f.syncStudentPoints('a')));
 assert.deepEqual(f.rows.map(row=>row.points),[2,1]);
 assert.equal(f.notifications.length,1);
 assert.equal(f.pushes.length,1);
});

test('ranking general incluye Personalizado y limita el mes y el workspace', async () => {
 const f=fixture('2026-12-01');
 f.students.push({id:'p',workspaceId:'w1',serviceType:'PERSONALIZED',data:{name:'P',status:'activo'}});
 const row=(studentId,day,eventKey,points)=>({studentId,occurredAt:new Date(day+'T12:00:00Z'),eventKey,points,active:true,eventType:'RECORD'});
 f.rows.push(row('p','2026-12-02','sports:training:2026-12-02',2),
   row('p','2027-01-01','sports:training:2027-01-01',99),
   row('a','2026-12-03','weekly-mission:legacy',15),
   row('b','2026-12-03','sports:training:2026-12-03',99));
 assert.deepEqual((await f.loadPointRanking('month','w1')).map(({studentId,total})=>[studentId,total]),[['p',2],['a',0]]);
});

test('el pago puntual mantiene +5 al cruzar el corte, entra en el ranking y las correcciones de diciembre revierten el mismo movimiento', async () => {
 const f=fixture('2026-12-01');
 const november={studentId:'a',eventKey:'payment-on-time:nov',sourceType:'PAYMENT',sourceId:'nov',eventType:'PAYMENT',
  points:5,occurredAt:new Date('2026-11-30T12:00:00Z'),active:true,notifiedAt:null};
 f.rows.push({...november});
 const december={id:'dec',studentId:'a',status:'PAGADO',amount:55000,paidDate:new Date('2026-12-01T00:00:00Z'),dueDate:new Date('2026-12-02T12:00:00Z')};
 f.payments.push(december, {...december,id:"free",amount:0});
 await Promise.all(Array.from({length:5},()=>f.syncStudentPoints('a',{notify:false})));
 assert.deepEqual(f.rows[0],november);
 assert.equal(f.rows.some(row=>row.eventKey==='payment-on-time:free'),false);
 const matching=()=>f.rows.filter(row=>row.eventKey==='payment-on-time:dec');
 assert.deepEqual(matching().map(row=>[row.active,row.points,row.occurredAt.toISOString()]),[[true,5,'2026-12-01T12:00:00.000Z']]);
 assert.equal((await f.loadPointRanking('month','w1'))[0].total,8);
 december.paidDate=new Date('2026-12-03T12:00:00Z');
 await f.syncStudentPoints('a',{notify:false});
 assert.equal(matching()[0].active,false);
 december.paidDate=new Date('2026-12-01T12:00:00Z');
 await f.syncStudentPoints('a',{notify:false});
 assert.equal(matching()[0].active,true);
 december.status='ANULADO';
 await f.syncStudentPoints('a',{notify:false});
 assert.deepEqual(matching().map(row=>row.active),[false]);
 assert.equal((await f.loadPointRanking('month','w1'))[0].total,3);
 assert.deepEqual(f.rows[0],november);
});
