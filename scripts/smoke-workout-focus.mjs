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
const browser = await chromium.launch({channel:'msedge',headless:true});
let cases = 0;
try {
 for (const width of [320,390,1280]) for (const theme of ['light','dark','system-light','system-dark']) for (const accent of ['#D4A72C','#2563eb']) {
  const snapshot = visualFixture('PERSONALIZED',accent), day = snapshot.data.routine.days[0];
  day.blocks = day.blocks.filter(b => b.type !== 'MOBILITY');
  const exercises = day.blocks.find(b => b.type === 'STRENGTH').exercises;
  exercises[0].sets = 3; exercises[0].order = 1;
  exercises[1].sets = 4; exercises[1].order = 2;
  const third = {...exercises[0],id:'exercise-d',name:'Prensa de piernas',sets:5,order:3,videoUrl:'bm-library://exercise/test-focus'};
  exercises.push(third); day.exercises = exercises; snapshot.data.exerciseMediaEnabled = true;
  const context = await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768,colorScheme:theme.endsWith('light')?'light':'dark',reducedMotion:theme.startsWith('system')?'reduce':'no-preference',serviceWorkers:'allow'});
  await context.addInitScript(theme=>localStorage.setItem('bm-appearance-v1',theme.startsWith('system')?'system':theme),theme);
  let posts = [];
  await context.route('**/api/portal/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/portal/session')return route.fulfill({json:{offlineIdentity:{studentId:'student-a',workspaceId:'workspace-a',sessionId:'session-a'}}});
   if(url.pathname==='/api/portal/offline')return route.fulfill({json:snapshot});
   if(url.pathname==='/api/portal/entrenamientos'){posts.push(route.request().postDataJSON());return route.fulfill({json:{id:'synthetic',status:'en_progreso'}})}
   return route.fulfill({status:401,json:{error:'Synthetic test'}});
  });
  await context.route('**/api/exercise-library/media?**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#444"/><circle cx="160" cy="100" r="60" fill="#aaa"/></svg>'}));
  const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/portal/offline');
  await page.getByLabel('Reps de la serie 3',{exact:true}).waitFor();
  await page.evaluate(()=>document.querySelector('main').classList.add('portal-route-enter'));
  if(cases===0){
   const normalKg=page.getByLabel('Kg de la serie 1',{exact:true});await normalKg.focus();
   await page.getByRole('dialog',{name:'Modo enfoque',exact:true}).waitFor();
   assert.equal(await normalKg.evaluate(e=>e===document.activeElement),true,'Entering while editing preserves keyboard focus');
   await normalKg.fill('51');await normalKg.press('Enter');assert.equal(await normalKg.inputValue(),'51');
   await page.getByRole('button',{name:'Salir del modo enfoque',exact:true}).click();
  }
  await page.getByRole('button',{name:'Entrenar en modo enfoque',exact:true}).click();
  const focus=page.getByRole('dialog',{name:'Modo enfoque',exact:true});await focus.waitFor();
  assert.equal(await page.locator('.portal-mobile-nav').isVisible(),false);
  assert.equal(await focus.locator('.workout-focus-media').count(),0);
  assert.equal(await focus.getByRole('heading',{name:'Sentadillas con barra',exact:true}).isVisible(),true);
  assert.ok((await focus.locator('.workout-focus-mark').innerText()).includes('48 kg × 12 reps'));
  const list=focus.locator('.workout-focus-list');assert.equal(await list.getAttribute('open'),null);
  const kg=focus.getByLabel('Kg de la serie 1',{exact:true});await kg.fill('52');
  await focus.getByLabel('Reps de la serie 1',{exact:true}).fill('9');await focus.getByLabel('RIR de la serie 1',{exact:true}).fill('1.5');
  await focus.getByLabel('Serie 1 completada',{exact:true}).check();
  assert.equal(await focus.getByLabel('Serie 1 completada',{exact:true}).isChecked(),true);
  await focus.getByText('Historial anterior (1)',{exact:true}).click();assert.equal(await focus.locator('.portal-routine-history').first().getAttribute('open'),'');
  await focus.getByRole('button',{name:'Iniciar descanso',exact:true}).click();
  await focus.locator('.workout-focus-rest[data-timer-status="running"]').waitFor();
  assert.ok((await focus.locator('.workout-focus-rest').innerText()).includes('Serie 2'));
  if(width===390 && theme==='dark' && accent==='#D4A72C')await page.screenshot({path:'C:/Users/brian/AppData/Local/Temp/bm-focus-no-media.png'});
  await focus.getByRole('button',{name:'Pausar descanso',exact:true}).click();await focus.locator('.workout-focus-rest[data-timer-status="paused"]').waitFor();
  await focus.getByRole('button',{name:'Continuar descanso',exact:true}).click();
  await focus.getByRole('button',{name:'Siguiente',exact:true}).click();
  await focus.getByRole('heading',{name:'Sentadillas sumo',exact:true}).waitFor();
  assert.equal(await focus.getByLabel('Reps de la serie 4',{exact:true}).isVisible(),true);
  assert.ok((await focus.locator('.workout-focus-rest').innerText()).includes('Sentadillas con barra'),'Rest keeps original owner');
  await focus.getByRole('button',{name:'Anterior',exact:true}).click();assert.equal(await kg.inputValue(),'52');
  assert.equal(await focus.getByLabel('Reps de la serie 1',{exact:true}).inputValue(),'9');assert.equal(await focus.getByLabel('RIR de la serie 1',{exact:true}).inputValue(),'1.5');
  await list.locator('summary').click();assert.equal(await list.getAttribute('open'),'');
  assert.ok((await list.innerText()).includes('En ejecución'));assert.ok((await list.innerText()).includes('Siguiente'));assert.ok((await list.innerText()).includes('Pendiente'));
  await list.getByRole('button',{name:/Prensa de piernas/}).click();
  await focus.getByRole('heading',{name:'Prensa de piernas',exact:true}).waitFor();
  assert.equal(await focus.getByLabel('Reps de la serie 5',{exact:true}).isVisible(),true);
  await focus.locator('.workout-focus-media img').waitFor();await page.waitForFunction(()=>document.querySelector('.workout-focus-media img')?.naturalWidth>0);
  assert.equal(await focus.getByRole('button',{name:'Siguiente',exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const geometry=await focus.evaluate(e=>{const body=e.querySelector('.workout-focus-body').getBoundingClientRect(),controls=e.querySelector('.workout-focus-controls').getBoundingClientRect(),rect=e.getBoundingClientRect();return {bodyBottom:body.bottom,controlsTop:controls.top,dialog:rect.height,top:rect.top,left:rect.left,height:innerHeight,overflow:e.scrollWidth>e.clientWidth}});
  assert.ok(geometry.bodyBottom<=geometry.controlsTop+1,'Timer does not cover series');assert.ok(geometry.dialog<=geometry.height+1);
  assert.equal(geometry.top,0);assert.equal(geometry.left,0);assert.equal(geometry.overflow,false);
  const appearance=await focus.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,input:getComputedStyle(e.querySelector('input[type="number"]')).color,accent:getComputedStyle(e.querySelector('.workout-focus-clock')).backgroundImage}));
  const light=theme==='light'||theme==='system-light';assert.equal(appearance.bg,light?'rgb(245, 244, 240)':'rgb(11, 11, 12)');assert.equal(appearance.input,light?'rgb(30, 32, 37)':'rgb(255, 255, 255)');
  if(accent==='#2563eb')assert.ok(appearance.accent.includes('37, 99, 235'),'Timer uses workspace accent');
  if(cases===0) await page.screenshot({path:'C:/Users/brian/AppData/Local/Temp/bm-focus-debug.png'});
  if(width===390 && theme==='dark' && accent==='#D4A72C') await page.screenshot({path:process.env.TEMP+'/bm-focus-dark.png'});
  if(width===320 && theme==='light' && accent==='#2563eb') await page.screenshot({path:process.env.TEMP+'/bm-focus-light.png'});
  if(cases===0){
   await context.route('**/api/exercise-library/media?**',route=>route.abort());
   await focus.getByRole('button',{name:'Anterior',exact:true}).click();await focus.getByRole('button',{name:'Siguiente',exact:true}).click();
   await focus.locator('.workout-focus-media img').evaluate(img=>{img.src='/api/exercise-library/media?id=missing-focus-fixture&kind=gif'});
   await focus.locator('.workout-focus-media').waitFor({state:'hidden'});
   assert.equal(await focus.getByRole('heading',{name:'Prensa de piernas',exact:true}).isVisible(),true);
  }
  await focus.getByRole('button',{name:'Salir del modo enfoque',exact:true}).click();await focus.waitFor({state:'hidden'});
  assert.equal(await page.locator('.portal-mobile-nav').isVisible(),width<768);
  await page.getByRole('button',{name:'Entrenar en modo enfoque',exact:true}).click();
  await focus.getByRole('button',{name:'Anterior',exact:true}).click();await focus.getByRole('button',{name:'Anterior',exact:true}).click();
  assert.equal(await kg.inputValue(),'52');assert.equal(await focus.locator('.workout-focus-list').getAttribute('open'),null);
  // Mobile keyboard uses the existing shell detector; the focus footer yields space.
  if(width<768){
   await kg.focus();
   await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:500});visualViewport.dispatchEvent(new Event('resize'))});
   await page.waitForTimeout(100);assert.ok((await focus.boundingBox()).height<=500);
   assert.equal(await focus.locator('.workout-focus-controls').isVisible(),false);
   await kg.scrollIntoViewIfNeeded();assert.ok((await kg.boundingBox()).y+(await kg.boundingBox()).height<=500,'Input above overlay keyboard');
   await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'))});
   await page.setViewportSize({width,height:500});await page.waitForTimeout(100);assert.equal(await focus.locator('.workout-focus-controls').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width,height:844});await kg.blur();await page.waitForTimeout(100);
  }
  await focus.getByRole('button',{name:'Salir del modo enfoque',exact:true}).click();
  const interval=page.locator('.portal-routine-block').first();await interval.locator('.portal-routine-block-heading').click();
  const blockTimer=page.getByRole('region',{name:'Cronómetro INTERVAL'});await blockTimer.getByRole('button',{name:'Iniciar',exact:true}).click();
  await blockTimer.getByRole('button',{name:'Pausar',exact:true}).click();assert.equal(await blockTimer.getAttribute('data-timer-status'),'paused');await blockTimer.getByRole('button',{name:'Continuar',exact:true}).click();
  await blockTimer.getByRole('button',{name:'Finalizar bloque',exact:true}).click();
  await page.getByRole('button',{name:'Entrenar en modo enfoque',exact:true}).click();
  await page.waitForTimeout(500);
  // Copy already prepared: no new required requests; data and edits survive offline reload.
  await page.waitForFunction(async()=>!!(await (await caches.open('bm-public-offline-v1')).match('/portal/offline')));
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByText('Modo sin conexión',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Entrenar en modo enfoque',exact:true}).click();
  assert.equal(await kg.inputValue(),'52');assert.equal(await focus.getByLabel('Serie 1 completada',{exact:true}).isChecked(),true);
  await focus.getByLabel('Reps de la serie 1',{exact:true}).fill('11');
  for(let i=0;i<3;i++){
   const checkboxes=focus.locator('.portal-routine-exercise:not([hidden]) input[type="checkbox"]');
   for(let s=0;s<await checkboxes.count();s++)await checkboxes.nth(s).check();
   if(i<2)await focus.getByRole('button',{name:'Siguiente',exact:true}).click();
  }
  await focus.locator('.workout-focus-list summary').click();
  assert.equal(await focus.locator('.workout-focus-list [data-completed="true"]').count(),3);
  await focus.getByRole('button',{name:'Finalizar entrenamiento',exact:true}).click();
  const summary=page.getByRole('dialog',{name:'Finalizar entrenamiento',exact:true});await summary.waitFor();
  assert.equal(await summary.getByText('Todavía quedan ejercicios o series sin completar.',{exact:true}).count(),0);
  await summary.getByRole('combobox').selectOption('Buena');await summary.getByPlaceholder('Ej: 45',{exact:true}).fill('45');
  await summary.getByRole('button',{name:'Confirmar y finalizar',exact:true}).click();await page.getByText('Entrenamiento guardado correctamente',{exact:true}).waitFor();
  assert.equal(await page.locator('.workout-focus').count(),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
  assert.deepEqual(errors,[]);console.log(`${width}px ${theme} ${accent}: strength, history, media, timer, navigation, intervals, offline, resume and finish OK`);cases++;await context.close();
 }
}finally{await browser.close()}
console.log(`${cases} focus scenarios passed`);
