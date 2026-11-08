import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { masterStudentCounts, masterWorkspaceTotals } from '../lib/master-student-counts.ts';
import * as limits from '../lib/trainer-plan-limits.ts';
import * as subscriptions from '../lib/trainer-subscription.ts';
function loadRoute(access: unknown, trainers: unknown[]) {
 const exports: Record<string, () => Promise<Response>> = {};
 let queried = false;
 const deps: Record<string, unknown> = {
  '@/lib/master-student-counts': { masterStudentCounts }, '@/lib/trainer-plan-limits': limits,
  '@/lib/trainer-subscription': subscriptions, '@/lib/coached-students': {coachedStudentsWhere:{OR:['managed-only']}},
  '@/lib/platform-auth': { platformOwnerApiAccess: async () => access },
  '@/lib/prisma': { prisma: { user: {findMany: async (query: {select: { memberships: {where: unknown} };where:unknown}) => {
   queried = true;
   assert.deepEqual(query.where, {platformRole:'TRAINER',memberships:{some:{role:'OWNER',workspace:{type:'PROFESSIONAL'}}}});
   assert.deepEqual(query.select.memberships.where,{role:'OWNER',workspace:{type:'PROFESSIONAL'}});
   return trainers;
  }},trainerInvitation:{findMany:async()=>[]} } },
 };
 const source=ts.transpileModule(readFileSync('app/api/platform/trainers/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports',source)((name:string)=>{assert.ok(name in deps);return deps[name];},exports);
 return {GET:exports.GET,queried:()=>queried};
}
test('conteos por workspace separan cupo activo y total sin autoservicio',()=>{
 const rows=[{data:{status:'activo'}},{data:{status:'inactivo'}},{data:{lifecycleStatus:'suspendido',status:'activo'}},{data:{status:'archivado'}},{data:{}},{data:{accountType:'SELF_SERVICE',status:'activo'}}];
 assert.deepEqual(masterStudentCounts(rows),{total:5,active:2,inactive:3});
 assert.deepEqual(masterWorkspaceTotals([{id:'a',students:rows},{id:'a',students:rows},{id:'b',students:[{data:{status:'activo'}}]}]),{total:6,active:3,inactive:3});
});
test('API real consulta de nuevo en cada lectura y refleja altas sin despliegue',async()=>{
 const students=[{data:{status:'activo'}}];
 const trainers=[{id:'trainer',trainerSubscription:null,memberships:[{workspace:{id:'workspace',name:'Test',status:'ACTIVE',students}}]}];
 const route=loadRoute({ok:true,user:{platformRole:'PLATFORM_OWNER'}},trainers);
 const first=await route.GET();assert.equal(first.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal((await first.json()).trainers[0].memberships[0].workspace.capacity.used,1);
 students.push({data:{status:'activo'}});
 const result=await (await route.GET()).json();
 assert.equal(result.trainers[0].memberships[0].workspace.capacity.used,2);
 assert.deepEqual(result.trainers[0].memberships[0].workspace.studentCounts,{total:2,active:2,inactive:0});
 assert.equal(result.trainers[0].memberships[0].workspace.students,undefined);
});
test('API Master deniega antes de consultar datos para actor no autorizado',async()=>{
 for(const status of [401,403]) {
  const route=loadRoute({ok:false,response:Response.json({error:'No autorizado'},{status})},[]);
  assert.equal((await route.GET()).status,status);assert.equal(route.queried(),false);
 }
});
test('un solo CTA de invitación por vista y no hay alta directa escondida',()=>{
 const summary=readFileSync('app/platform/page.tsx','utf8');
 assert.equal((summary.match(/\+ Invitar entrenador/g)||[]).length,1);
 assert.doesNotMatch(summary,/\+ Nuevo entrenador|\+ Nueva invitación/);
 assert.match(summary,/trainers\?view=invitations&new=1/);
 const accounts=readFileSync('componentes/platform-trainers.tsx','utf8');
 assert.match(accounts,/initialInviteOpen/);assert.match(accounts,/\/api\/platform\/trainers\/invitations/);
 assert.doesNotMatch(accounts,/\+ Nuevo entrenador/);
 assert.match(accounts,/window.addEventListener\("focus", refresh\)/);
 assert.match(accounts,/visibilitychange/);assert.match(accounts,/60_000/);
 assert.match(accounts,/version !== requestVersion.current/);
 assert.match(accounts,/\[role=dialog\]/);
});
