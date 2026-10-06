// Real shared WorkoutView through the production offline shell; synthetic APIs, no database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
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

function visualFixture(serviceType, accent) {
 const snapshot=fixture(serviceType); snapshot.branding.accentColor=accent;
 const day=snapshot.data.routine.days[0], exercise=day.exercises[0]; exercise.name='Sentadillas con barra'; exercise.sets=4; exercise.restSeconds=120; exercise.repetitions='6–8';
 const second={...exercise,id:'exercise-c',name:'Sentadillas sumo',order:2};
 day.exercises.push(second); day.blocks[0].exercises.push(second);
 day.blocks.unshift({...day.blocks[0],id:'interval-a',name:'Intervalos',type:'INTERVAL',order:0,rounds:3,workSeconds:30,restSeconds:10,exercises:[{...exercise,id:'interval-ex',name:'Plancha frontal',sets:0,targetType:'TIME',targetSeconds:30,blockId:'interval-a'}]});
 day.blocks.push({...day.blocks[0],id:'mobility-a',name:'Movilidad',type:'MOBILITY',order:3});
 day.name='Pierna 1'; day.objective='Pierna 1'; day.estimatedMinutes=75;
 snapshot.data.routine.days[1]={...day,id:'day-b',dayNumber:2,name:'Pierna 2',objective:'Pierna 2',blocks:day.blocks.map(b=>({...b,id:b.id+'-b'}))};
 snapshot.data.workoutSessions=[{id:'history-a',routineId:'routine-a',dayId:'old-day',status:'finalizado',date:'2026-09-01',exercises:[{exerciseId:exercise.id,sets:[{setNumber:1,weight:48,repetitions:12,effort:2,completed:true}]}],blocks:[]}];
 return snapshot;
}
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const theme of ['light','dark']) for(const accent of ['#D4A72C','#22C55E']) for(const width of [320,390,1280]) {
  const serviceType=accent==='#D4A72C'?'PERSONALIZED':'MIXED';
  const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'allow'});
  await context.addInitScript(theme=>localStorage.setItem('bm-appearance-v1',theme),theme);
  const snapshot=visualFixture(serviceType,accent);
  await context.route('**/api/portal/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/api/portal/session')return route.fulfill({json:{offlineIdentity:{studentId:'student-a',workspaceId:'workspace-a',sessionId:'session-a'}}});
   if(pathname==='/api/portal/offline')return route.fulfill({json:snapshot});
   if(pathname==='/api/portal/entrenamientos')return route.fulfill({json:{id:'synthetic',status:'en_progreso'}});
   return route.fulfill({status:401,json:{error:'Synthetic visual test'}});
  });
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/portal/offline');
  await page.getByLabel('Reps de la serie 4',{exact:true}).waitFor();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow');
  assert.equal(await page.locator('.portal-routine-step').count(),0);
  assert.equal(await page.locator('.portal-routine-day[aria-pressed="true"]').count(),1);
  const block=await page.locator('.portal-routine-block').first().boundingBox(), hero=await page.locator('.portal-routine-hero').boundingBox(); assert.ok(Math.abs(block.x-hero.x)<1,'Block alignment');
  assert.ok(hero.height<280,'Compact hero');
  const warmup=page.getByRole('button',{name:/Entrada en calor Prepará/});
  const bg=await warmup.evaluate(e=>getComputedStyle(e).backgroundColor); assert.equal(bg,theme==='light'?'rgb(255, 254, 250)':'rgb(16, 16, 18)');
  const appearance=await page.evaluate(()=>({
   icon:(()=>{const c=document.createElement('canvas').getContext('2d');c.fillStyle=getComputedStyle(document.querySelector('.portal-routine-warmup svg')).color;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3)})(),
   heading:(()=>{const c=document.createElement('canvas').getContext('2d');c.fillStyle=getComputedStyle(document.querySelector('.portal-routine-warmup strong')).color;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3)})(),
   track:getComputedStyle(document.querySelector('.portal-routine-hero > div:last-child')).backgroundColor,
   surface:getComputedStyle(document.querySelector('.portal-routine-hero')).backgroundColor
  }));
  assert.ok(appearance.heading.every(v=>theme==='light'?v<40:v>230),'Warmup title contrast');
  assert.notEqual(appearance.track,appearance.surface,'Progress track remains visible');
  if(accent==='#22C55E')assert.ok(appearance.icon[1]>appearance.icon[0] && appearance.icon[1]>appearance.icon[2],'Custom accent must replace gold');
  await warmup.click(); await page.getByRole('dialog',{name:'Entrada en calor'}).waitFor(); await page.getByRole('button',{name:'Cerrar entrada en calor'}).click();
  await page.locator('.portal-routine-block-heading').click(); await page.getByRole('heading',{name:'Plancha frontal',exact:true}).waitFor(); await page.locator('.portal-routine-block-heading').click();
  assert.equal(await page.locator('[data-exercise-rest-timer]').count(),1);
  await page.getByRole('button',{name:/Iniciar descanso/}).click(); assert.equal(await page.locator('[data-exercise-rest-timer]').getAttribute('data-timer-status'),'running');
  await page.getByRole('button',{name:'Reiniciar descanso'}).click();
  const rows=page.locator('.portal-routine-sets > div'); assert.equal(await rows.count(),5); assert.ok((await rows.nth(1).boundingBox()).height<=46);
  await page.getByLabel('Kg de la serie 1',{exact:true}).fill('50'); await page.getByLabel('Serie 1 completada',{exact:true}).check(); await page.locator('.portal-routine-set-complete').waitFor();
  assert.equal(await page.getByLabel('Kg de la serie 1',{exact:true}).isEnabled(),true);
  const history=page.getByText('Historial anterior (1)',{exact:true}); await history.click(); assert.equal(await page.locator('.portal-routine-history').getAttribute('open'),''); await history.click();
  await page.locator('.portal-routine-exercise-heading').nth(1).click(); await page.getByLabel('Reps de la serie 4',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Día 2 Pierna 2',exact:true}).click(); await page.getByRole('button',{name:'Día 1 Pierna 1',exact:true}).click();
  await context.setOffline(true); await page.reload(); await page.getByText('Modo sin conexión',{exact:true}).waitFor(); await page.getByLabel('Reps de la serie 4',{exact:true}).waitFor();
  await page.getByLabel('Reps de la serie 1',{exact:true}).fill('9'); await page.waitForTimeout(400);
  if(width<768){
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
   const last=await page.getByRole('link',{name:'Ver mi progreso',exact:true}).boundingBox(); const nav=await page.locator('nav').last().boundingBox(); assert.ok(last.y+last.height<nav.y,'Final content above navigation');
  }
  if(width===390 && accent==='#D4A72C'){await page.evaluate(()=>scrollTo(0,0)); await page.screenshot({path:'.routine-'+theme+'.png',fullPage:true});}
  assert.deepEqual(errors,[]); console.log(theme+', '+accent+', '+width+'px, '+serviceType+': days, blocks, warmup, table, history, timer, offline and clearance OK'); await context.close();
 }
} finally {await browser.close();}
