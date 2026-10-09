import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as invitations from '../lib/student-invitations.ts';
import * as policy from '../lib/student-invitation-password.ts';
import * as onboarding from '../lib/student-onboarding.ts';
const require=createRequire(import.meta.url), ts=require('typescript');
const registration={firstName:'Ana',lastName:'Paz',phone:'3415551234',username:'Ana.Paz',password:'Password123',confirmPassword:'Password123'};

function fixture(serviceType='CLASSES') {
  const students=[],credentials=[],sessions=[],cookieValues=new Map();
  const invitation={id:'invite-a',workspaceId:'workspace-a',inviterId:'coach-a',serviceType,status:'PENDING',usedAt:null,expiresAt:new Date(Date.now()+86400000)};
  const prisma={
    $executeRaw:async()=>{}, $transaction:async callback=>callback(prisma),
    studentInvitation:{updateMany:async()=>{if(invitation.status!=='PENDING')return {count:0};invitation.status='USED';return {count:1};}},
    studentRecord:{
      create:async({data})=>{const {portalCredential,...record}=data;students.push(record);credentials.push({studentId:record.id,student:record,failedLoginAttempts:0,lockedUntil:null,...portalCredential.create});return record;},
      findUnique:async({where})=>students.find(s=>s.id===where.id),
      update:async({where,data})=>{const record=students.find(s=>s.id===where.id);Object.assign(record,data);return record;},
    },
    studentPortalCredential:{findUnique:async({where})=>credentials.find(c=>c.username===where.username)||null,update:async({where,data})=>Object.assign(credentials.find(c=>c.studentId===where.studentId),data)},
    studentPortalSession:{create:async({data})=>sessions.push(data),deleteMany:async()=>{},findUnique:async({where})=>{const session=sessions.find(s=>s.tokenHash===where.tokenHash);return session?{...session,credential:credentials.find(c=>c.studentId===session.studentId)}:null;}},
  };
  const dependencies={
    'server-only':{},'node:crypto':require('node:crypto'),'@prisma/client':require('@prisma/client'),
    'next/headers':{cookies:async()=>({set:(key,value)=>cookieValues.set(key,value),get:key=>cookieValues.has(key)?{value:cookieValues.get(key)}:undefined})},'next/navigation':{},
    '@/lib/prisma':{prisma},'@/lib/self-service':{isSelfService:()=>false},
    '@/lib/session-persistence':{authSessionExpiresAt:()=>new Date(Date.now()+86400000),persistentAuthCookieOptions:()=>({}),clearAuthCookieOptions:()=>({})},
    '@/lib/portal-student-identity':{resolvePortalStudentIdentity:session=>session.studentId===session.credential.student.id?{studentId:session.studentId,workspaceId:session.credential.student.workspaceId}:null},
    '@/lib/student-invitations':invitations,'@/lib/student-invitation-password':policy,
    '@/lib/student-invitations-server':{activeStudentInvitation:async()=>invitation,invitationUnavailableMessage:value=>value.status==='PENDING'?null:'Invitación utilizada',studentInvitationWorkspaceAccess:async()=>true},
    '@/lib/student-enrollment':{normalizePhone:phone=>phone.replace(/\D/g,''),duplicatePhone:async()=>false,studentJsonData:input=>({...input})},
    '@/lib/student-history':{recordInitialStudentHistory:async()=>{}},
    '@/lib/trainer-plan-limits-server':{assertTrainerCanAddStudent:async()=>{},TrainerStudentLimitError:class extends Error{}},
    '@/lib/student-onboarding':onboarding,'@/lib/portal-experience':{LAST_PORTAL_COOKIE:'experience',portalExperienceCookieOptions:()=>({})},
  };
  const load=file=>{const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const compiled={exports:{}};new Function('require','module','exports',code)(id=>{assert.ok(id in dependencies,`Unexpected dependency: ${id}`);return dependencies[id];},compiled,compiled.exports);return compiled.exports;};
  const auth=load('../lib/portal-auth.ts');dependencies['@/lib/portal-auth']=auth;
  return {students,credentials,invitation,auth,accept:load('../app/api/student-invitations/[token]/route.ts').POST,login:load('../app/api/portal/login/route.ts').POST,saveOnboarding:load('../app/api/portal/onboarding/route.ts').PATCH};
}
const request=(path,body,method='POST')=>new Request('https://bm.test'+path,{method,headers:{origin:'https://bm.test','content-type':'application/json'},body:JSON.stringify(body)});
const context={params:Promise.resolve({token:'a'.repeat(43)})};

for(const service of ['CLASSES','PERSONALIZED','MIXED']) test(`${service}: alta sin birthDate → login real → onboarding guarda fecha y conserva workspace/servicio`,async()=>{
  const f=fixture(service);
  const response=await f.accept(request('/api/student-invitations/token',registration),context);assert.equal(response.status,201);
  assert.equal(f.students[0].data.birthDate,'');assert.equal(f.students[0].data.onboardingCompleted,false);
  assert.equal(f.students[0].workspaceId,'workspace-a');assert.equal(f.students[0].serviceType,service);
  assert.notEqual(f.credentials[0].passwordHash,registration.password);
  const logged=await f.login(request('/api/portal/login',{username:registration.username,password:registration.password}));assert.equal(logged.status,200);
  assert.equal((await logged.json()).offlineIdentity.workspaceId,'workspace-a');assert.ok(await f.auth.getPortalSession());
  const other={id:'student-b',workspaceId:'workspace-b',data:{birthDate:'1990-01-01'}};f.students.push(other);
  const saved=await f.saveOnboarding(request('/api/portal/onboarding',{step:4,complete:true,data:{birthDate:'2000-01-02',height:170,weight:70,goal:'Mejorar salud',experienceLevel:'Principiante',trainingExperience:'Nunca entrené',trainingCurrently:false,hasLimitations:false}},'PATCH'));
  assert.equal(saved.status,200);assert.equal(f.students[0].data.birthDate,'2000-01-02');assert.equal(f.students[0].data.onboardingCompleted,true);
  assert.equal(f.students[0].serviceType,service);assert.equal(other.data.birthDate,'1990-01-01');
});
for(const [name,password] of [['corta','Aa1short'],['sin mayúscula','password123'],['sin minúscula','PASSWORD123'],['sin número','Passwordaaa'],['demasiado larga','Aa1'+ 'x'.repeat(126)]]) test(`política compartida y backend rechazan ${name}`,async()=>{
  assert.ok(policy.invitationPasswordValidationError(password));
  const f=fixture();const response=await f.accept(request('/api/student-invitations/token',{...registration,password,confirmPassword:password}),context);assert.equal(response.status,400);assert.equal(f.students.length,0);assert.equal(f.invitation.status,'PENDING');
});
test('confirmación diferente, username inválido y workspace inyectado no crean cuenta',async()=>{
  for(const changes of [{confirmPassword:'OtherPass123!'},{username:'a'},{workspaceId:'workspace-b'},{serviceType:'MIXED'}]){const f=fixture();const response=await f.accept(request('/api/student-invitations/token',{...registration,...changes}),context);assert.equal(response.status,400);assert.equal(f.students.length,0);}
});
test('contraseña válida cumple todo; login general conserva su política anterior',()=>{
  assert.equal(policy.invitationPasswordValidationError(registration.password),null);assert.ok(policy.invitationPasswordRequirements(registration.password).every(item=>item.met));
  assert.equal(fixture().auth.passwordValidationError('Password123'),null);
  assert.equal(policy.invitationPasswordRequirements(registration.password).length,4);
  assert.equal(policy.INVITATION_PASSWORD_HELP,'Mínimo 10 caracteres, con una mayúscula, una minúscula y un número.');
  assert.deepEqual(policy.invitationPasswordRequirements('').map(item=>item.label),['10 caracteres mínimo','1 mayúscula','1 minúscula','1 número']);
});
test('formulario común tiene seis campos, ayuda vinculada, checklist y birthDate sólo en onboarding',()=>{
  const form=readFileSync(new URL('../componentes/student-invitation-form.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(form,/birthDate|Fecha de nacimiento/);
  assert.deepEqual([...form.matchAll(/<input name="([^"]+)"/g)].map(match=>match[1]),['firstName','lastName','phone','username','password','confirmPassword']);
  assert.match(form,/invitationPasswordValidationError\(body.password\)/);assert.match(form,/body.password !== body.confirmPassword/);
  assert.match(form,/INVITATION_PASSWORD_HELP/);assert.match(form,/invitationPasswordRequirements\(password\)/);assert.match(form,/aria-describedby="invitation-password-help invitation-password-checklist"/);
  assert.match(form,/Mostrar contraseña/);assert.match(form,/var\(--success\)/);
  assert.match(readFileSync(new URL('../componentes/student-onboarding.tsx',import.meta.url),'utf8'),/label="Fecha de nacimiento"/);
  assert.match(readFileSync(new URL('../lib/student-enrollment.ts',import.meta.url),'utf8'),/birthDate: stored.birthDate/);
});
