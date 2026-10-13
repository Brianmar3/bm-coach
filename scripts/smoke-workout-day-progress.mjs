// Real shared WorkoutView through the production offline shell; synthetic APIs, no database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium}=createRequire(path.join(process.env.BM_TEST_NODE_MODULES,'playwright/package.json'))('playwright');
const origin=process.env.BM_TEST_ORIGIN || 'http://localhost:3101';
function fixture(serviceType) {
  const now = new Date(); const savedAt = now.toISOString();
  const exercise = { id: "exercise-a", name: "Sentadilla offline", muscleGroup: "Piernas", sets: 1, repetitions: "10", weight: 20, effortType: "RIR", effortValue: 2, restSeconds: 60, observations: "Controlá el descenso", videoUrl: "", tempo: "", alternativeExercise: "", equipment: "", optional: false, blockId: "block-a", targetType: "REPS", targetSeconds: null, targetRepetitions: "10", targetDistance: "", targetSide: "", order: 1 };
  const block = { id: "block-a", name: "Fuerza", type: "STRENGTH", order: 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: "", exercises: [exercise] };
  const day = { id: "day-a", dayNumber: 1, name: "Piernas", objective: "Fuerza", warmup: "Movilidad suave", observations: "", estimatedMinutes: 30, blocks: [block], exercises: [exercise] };
  const routine = { id: "routine-a", name: "Programa original", objective: "Fuerza", level: "intermedio", status: "activa", kind: "assigned", description: "", location: "Gimnasio", equipment: [], tags: [], startDate: savedAt.slice(0, 10), durationWeeks: null, priorityMuscles: [], createdAt: savedAt, updatedAt: savedAt, archivedAt: "", studentIds: [], students: [], historicalStudents: [], days: [day, { ...day, id: "day-b", dayNumber: 2, name: "Segundo día", blocks: [{ ...block, id: "block-b" }] }] };
  return { version: 1, scope: JSON.stringify(["workspace-a", "student-a", "session-a"]), studentId: "student-a", workspaceId: "workspace-a", sessionId: "session-a", savedAt, expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(), proof: "synthetic-proof", branding: { accentColor: "#22C55E", logoMode: "DEFAULT", customLogoUrl: "", displayName: "Workspace prueba", isPremium: true, platformFallbackName: "BM Training" }, data: { profile: { id: "student-a", serviceType }, routine, workoutSessions: [], exerciseMediaEnabled: false } };
}


const output=path.join(process.cwd(),'docs','visuals','workout-day-progress');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
async function setup(width,theme,accent) {
 const snapshot=fixture('PERSONALIZED');snapshot.branding.accentColor=accent;
 const day=snapshot.data.routine.days[0],first=day.exercises[0];
 day.exercises=[4,3,3,3,3,4].map((sets,i)=>({...first,id:'exercise-'+i,name:['Press de banca con barra','Press inclinado con barra','Cruce de poleas','Fondos asistidos','Aperturas','Extensiones'][i],sets,order:i+1}));day.blocks[0].exercises=day.exercises;
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,colorScheme:theme.endsWith('light')?'light':'dark',serviceWorkers:'allow'});
 await context.addInitScript(theme=>localStorage.setItem('bm-appearance-v1',theme.startsWith('system')?'system':theme),theme);
 let down=false;const posts=[],errors=[];
 await context.route('**/api/portal/**',route=>{
  if(down)return route.abort('internetdisconnected');
  const pathname=new URL(route.request().url()).pathname;
  if(pathname==='/api/portal/session')return route.fulfill({json:{offlineIdentity:{studentId:'student-a',workspaceId:'workspace-a',sessionId:'session-a'}}});
  if(pathname==='/api/portal/offline')return route.fulfill({json:snapshot});
  if(pathname==='/api/portal/entrenamientos'){posts.push(route.request().postDataJSON());return route.fulfill({json:{id:'synthetic',status:'en_progreso'}})}
  return route.fulfill({status:401,json:{error:'Synthetic test'}});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/portal/offline');
 await page.getByRole('button',{name:'Entrenar Press de banca con barra',exact:true}).waitFor();
 return {page,context,posts,errors,setOffline:async value=>{down=value;await context.setOffline(value)}};
}
async function normalPercent(page,value) {
 const bar=page.getByRole('progressbar',{name:'Progreso del día',exact:true});
 await page.waitForFunction(expected=>Math.abs(Number(document.querySelector('[role=progressbar][aria-label="Progreso del día"]')?.getAttribute('aria-valuenow'))-expected)<1e-8,value);
 assert.ok(Math.abs(Number(await bar.getAttribute('aria-valuenow'))-value)<1e-8);
 assert.ok(Math.abs(await bar.locator('div').evaluate(el=>parseFloat(el.style.width))-value)<1e-8);
}
async function focusPercent(page,value) {
 const bar=page.getByRole('progressbar',{name:'Progreso del entrenamiento',exact:true});
 assert.ok(Math.abs(Number(await bar.getAttribute('aria-valuenow'))/Number(await bar.getAttribute('aria-valuemax'))*100-value)<1e-8);
}
try {
 for(const width of [320,390,430])for(const theme of ['dark','light','system-dark','system-light'])for(const accent of ['#D4A72C','#2563eb']) {
  const {page,context,errors}=await setup(width,theme,accent);
  await normalPercent(page,0);
  for(let i=0;i<3;i++) {
   const card=page.locator('.portal-routine-exercise').nth(i);await card.getByRole('button',{name:'Ver detalle',exact:true}).click();
   const boxes=card.locator('input[type=checkbox]');
   for(let set=0;set<await boxes.count();set++) {
    await boxes.nth(set).check();
    if(i===0&&set===0){await normalPercent(page,5);await boxes.nth(set).uncheck();await normalPercent(page,0);await boxes.nth(set).check()}
   }
   await card.getByRole('button',{name:'Ocultar detalle',exact:true}).click();
  }
  await normalPercent(page,50);
  assert.ok((await page.locator('.portal-routine-progress-ring').innerText()).includes('3/6'));
  assert.ok((await page.locator('.portal-routine-progress-ring').innerText()).includes('ejercicios'));
  await page.locator('.portal-routine-hero').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(accent==='#2563eb'&&theme==='dark')await page.screenshot({path:path.join(output,width+'-ten-of-twenty.png')});
  if(width===390&&theme==='light'&&accent==='#D4A72C')await page.screenshot({path:path.join(output,'390-light.png')});
  await page.getByRole('button',{name:'Entrenar Fondos asistidos',exact:true}).click();
  await focusPercent(page,50);
  await page.getByRole('button',{name:'Confirmar serie 1',exact:true}).click();await focusPercent(page,55);
  await page.getByRole('button',{name:'Salir del modo enfoque',exact:true}).click();await normalPercent(page,55);
  assert.deepEqual(errors,[]);results.push({width,theme,accent,status:'PASS'});console.log(width,theme,accent,'PASS');await context.close();
 }
 {
  const {page,context,posts,errors,setOffline}=await setup(390,'dark','#2563eb');
  const card=page.locator('.portal-routine-exercise').first();await card.getByRole('button',{name:'Ver detalle',exact:true}).click();
  await card.getByLabel('Serie 1 completada',{exact:true}).check();await normalPercent(page,5);
  await page.waitForFunction(async()=>!!(await (await caches.open('bm-public-offline-v1')).match('/portal/offline')));
  await setOffline(true);await card.getByLabel('Serie 2 completada',{exact:true}).check();await normalPercent(page,10);
  await page.waitForTimeout(500);await page.reload({waitUntil:'domcontentloaded'});await page.getByText('Modo sin conexión',{exact:true}).waitFor();await normalPercent(page,10);
  await setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  let records=[];for(let attempt=0;attempt<100;attempt++) {
   records=await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('bm-training-offline-v1',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('records').objectStore('records').getAll();get.onsuccess=()=>{resolve(get.result.map(r=>({pending:r.pending,sets:r.payload.exercises.flatMap(e=>e.sets).filter(s=>s.completed).length})));db.close()}}}));
   if(records.length===1&&!records[0].pending)break;await page.waitForTimeout(100);
  }
  assert.deepEqual(records,[{pending:false,sets:2}]);await normalPercent(page,10);
  assert.ok(posts.some(post=>post.exercises.flatMap(e=>e.sets).filter(set=>set.completed).length===2));
  assert.deepEqual(errors,[]);results.push({scenario:'offline, reload, sync preserve 10%',status:'PASS'});await context.close();
 }
 await writeFile(path.join(output,'validation.json'),JSON.stringify({results},null,2));
}finally{await browser.close()}
console.log(results.length+' day progress scenarios passed');
