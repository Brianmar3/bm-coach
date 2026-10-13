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

const output = path.join(process.cwd(), 'docs', 'visuals', 'workout-focus');
await mkdir(output,{recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const results=[];
async function setup(width,theme,accent,{offlineCase=false,brokenMedia=false,mixed=false}={}) {
 const snapshot=fixture('PERSONALIZED');snapshot.branding.accentColor=accent;
 const day=snapshot.data.routine.days[0],first=day.exercises[0];
 first.name='Press de banca con barra';first.sets=2;first.repetitions='12';first.restSeconds=offlineCase?60:1;first.equipment='Barra';
 const second={...first,id:'exercise-c',name:'Remo con mancuerna',order:2,videoUrl:'bm-library://exercise/dataset%3Atest-focus'};
 day.blocks[0].exercises=[first,second];day.exercises=[first,second];
 if(mixed)day.blocks.push({...day.blocks[0],id:'pending-free',name:'Vuelta a la calma',type:'FREE',exercises:[]});
 snapshot.data.exerciseMediaEnabled=true;
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768,colorScheme:theme.endsWith('light')?'light':'dark',reducedMotion:'reduce',serviceWorkers:'allow'});
 await context.addInitScript(theme=>localStorage.setItem('bm-appearance-v1',theme.startsWith('system')?'system':theme),theme);
 const posts=[],errors=[];let networkDown=false;
 await context.route('**/api/portal/**',route=>{
  if(networkDown)return route.abort('internetdisconnected');
  const url=new URL(route.request().url());
  if(url.pathname==='/api/portal/session')return route.fulfill({json:{offlineIdentity:{studentId:'student-a',workspaceId:'workspace-a',sessionId:'session-a'}}});
  if(url.pathname==='/api/portal/offline')return route.fulfill({json:snapshot});
  if(url.pathname==='/api/portal/entrenamientos'){posts.push(route.request().postDataJSON());return route.fulfill({json:{id:'synthetic',status:'en_progreso'}})}
  return route.fulfill({status:401,json:{error:'Synthetic test'}});
 });
 await context.route('**/api/exercise-library/**',route=>{
  if(networkDown)return route.abort('internetdisconnected');
  if(route.request().url().includes('/media?'))return brokenMedia?route.fulfill({status:404}):route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200"><rect width="360" height="200" fill="#eee"/><path d="M90 150L150 70L210 150M70 70H250" stroke="#555" stroke-width="12" fill="none"/></svg>'});
  return route.fulfill({json:{exercise:{id:'dataset:test-focus',name:second.name,displayNameEs:second.name,aliases:[],targetMuscleLabelEs:'Dorsales',equipmentLabelEs:'Mancuerna',instructionStepsEs:['Mantené el torso estable y acercá el codo al cuerpo.','Bajá con control.'],gifPath:'videos/demo.gif',thumbnailPath:'images/demo.jpg'}}});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/portal/offline');
 await page.getByRole('button',{name:'Entrenar Press de banca con barra',exact:true}).waitFor();
 return {context,page,posts,errors,setOffline:async value=>{networkDown=value;await context.setOffline(value)}};
}
async function layout(page,focus) {
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page overflow');
 assert.equal(await focus.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'focus overflow');
 assert.equal(await focus.locator('.workout-focus-body').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'body overflow');
 const tooSmall=await focus.locator('button:visible, input[type=number]:visible, summary:visible').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().height<43.5).map(node=>node.textContent||node.getAttribute('aria-label')));
 assert.deepEqual(tooSmall,[],'touch targets');
}
async function enter(page,name='Press de banca con barra') {
 await page.getByRole('button',{name:new RegExp('^(Entrenar|Continuar) '+name+'$')}).click();
 return page.getByRole('dialog',{name:'Modo enfoque',exact:true});
}
try {
 for(const width of (process.env.BM_FOCUS_ONLY_OFFLINE ? [] : [320,390,430,768,1280]))for(const theme of ['dark','light','system-dark','system-light'])for(const accent of ['#D4A72C','#2563eb']) {
  const {page,context,posts,errors}=await setup(width,theme,accent);
  const focus=await enter(page);
  await focus.getByRole('button',{name:'Iniciar entrenamiento',exact:true}).waitFor();
  assert.equal(posts.length,0,'opening focus does not start session');
  assert.equal(await focus.locator('[data-current=true]').count(),0);
  assert.equal(await focus.locator('.workout-focus-media').count(),0);
  assert.equal(await page.locator('.portal-mobile-nav').isVisible(),false);
  const capture=width===390&&theme==='dark'&&accent==='#2563eb';
  if(capture)await page.screenshot({path:path.join(output,'390-ready.png')});
  await focus.getByRole('button',{name:'Iniciar entrenamiento',exact:true}).click();
  await focus.getByRole('button',{name:'Completar serie 1',exact:true}).waitFor();
  assert.equal(await focus.locator('[data-current=true]').count(),1);
  assert.match(await focus.locator('.workout-focus-overview').innerText(),/En curso · 0:0[0-3]/,'session starts at zero');
  await focus.getByLabel('Kg de la serie 1',{exact:true}).fill('45');
  await focus.getByLabel('Reps de la serie 1',{exact:true}).fill('12');
  await focus.getByLabel('RIR de la serie 1',{exact:true}).fill('2');
  await layout(page,focus);
  if(width===390&&theme==='dark'&&accent==='#2563eb') {
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
   const kg=focus.getByLabel('Kg de la serie 1',{exact:true});await kg.focus();
   await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:500});visualViewport.dispatchEvent(new Event('resize'))});
   await page.waitForTimeout(150);
   assert.ok((await focus.boundingBox()).height<=500,'keyboard viewport respected');
   assert.equal(await focus.locator('.workout-focus-controls').isVisible(),false);
   await kg.scrollIntoViewIfNeeded();assert.ok((await kg.boundingBox()).y+(await kg.boundingBox()).height<=500);
   await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'))});await kg.blur();await cdp.detach();
  }
  if(theme==='dark'&&accent==='#D4A72C')await page.screenshot({path:path.join(output,width+'-active.png')});
  await focus.getByRole('button',{name:'Completar serie 1',exact:true}).click();
  await focus.getByRole('button',{name:'Pausar',exact:true}).click();
  const paused=await focus.locator('.workout-focus-clock strong').innerText();
  await page.waitForTimeout(1100);assert.equal(await focus.locator('.workout-focus-clock strong').innerText(),paused);
  if(capture)await page.screenshot({path:path.join(output,'390-rest-paused.png')});
  await focus.getByRole('button',{name:'Reanudar',exact:true}).click();
  await focus.getByRole('button',{name:'Reiniciar',exact:true}).click();
  await focus.getByRole('button',{name:'Saltar descanso',exact:true}).click();
  await focus.getByRole('button',{name:'Siguiente',exact:true}).click();
  await focus.getByRole('heading',{name:'Remo con mancuerna',exact:true}).waitFor();
  await focus.locator('.workout-focus-media img').waitFor();
  await focus.getByText('Mantené el torso estable y acercá el codo al cuerpo.',{exact:true}).first().waitFor();
  await focus.getByText('Ver técnica',{exact:true}).click();
  await layout(page,focus);
  if(capture)await page.screenshot({path:path.join(output,'390-media.png')});
  if(theme==='light'&&width===390&&accent==='#D4A72C')await page.screenshot({path:path.join(output,'390-light-media.png')});
  await focus.getByRole('button',{name:'Anterior',exact:true}).click();
  assert.equal(await focus.getByLabel('Kg de la serie 1',{exact:true}).inputValue(),'45');
  await focus.getByRole('button',{name:'Completar serie 2',exact:true}).click();
  await focus.getByRole('heading',{name:'Remo con mancuerna',exact:true}).waitFor(); // automatic after programmed rest
  assert.equal(await focus.getByLabel('Serie 1 completada',{exact:true}).isChecked(),false,'no duplicate advance/completion');
  await focus.getByRole('button',{name:'Completar serie 1',exact:true}).click();
  await focus.getByRole('button',{name:'Saltar descanso',exact:true}).click();
  await focus.getByRole('button',{name:'Completar serie 2',exact:true}).click();
  const summary=page.getByRole('dialog',{name:'Finalizar entrenamiento',exact:true});await summary.waitFor();
  assert.equal(await summary.getByPlaceholder('Ej: 45',{exact:true}).inputValue()!=='',true);
  await summary.getByRole('combobox').selectOption('Buena');
  await summary.getByRole('button',{name:'Confirmar y finalizar',exact:true}).click();
  await page.getByText('Entrenamiento guardado correctamente',{exact:true}).waitFor();
  assert.equal(posts.filter(post=>post.status==='finalizado').length,1,'one final write');
  assert.deepEqual(errors,[]);
  results.push({width,theme,accent,status:'PASS'});console.log(width,theme,accent,'PASS');await context.close();
 }
 // Offline reload, paused rest recovery, automatic movement and reconnection use real IndexedDB/sync.
 {
  const {page,context,posts,errors,setOffline}=await setup(390,'dark','#2563eb',{offlineCase:true});
  let focus=await enter(page);await focus.getByRole('button',{name:'Iniciar entrenamiento',exact:true}).click();
  await page.waitForFunction(async()=>!!(await (await caches.open('bm-public-offline-v1')).match('/portal/offline')));
  await setOffline(true);
  await focus.getByLabel('Kg de la serie 1',{exact:true}).fill('47');
  await focus.getByRole('button',{name:'Completar serie 1',exact:true}).click();
  await focus.getByRole('button',{name:'Pausar',exact:true}).click();
  await page.waitForTimeout(700);await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('Modo sin conexión',{exact:true}).waitFor();
  focus=await enter(page);
  assert.equal(await focus.getByLabel('Kg de la serie 1',{exact:true}).inputValue(),'47');
  assert.equal(await focus.getByLabel('Serie 1 completada',{exact:true}).isChecked(),true);
  await focus.getByRole('button',{name:'Reanudar',exact:true}).waitFor();
  await focus.getByRole('button',{name:'Saltar descanso',exact:true}).click();
  await focus.getByRole('button',{name:'Completar serie 2',exact:true}).click();
  await focus.getByRole('button',{name:'Saltar descanso',exact:true}).click();
  await focus.getByRole('heading',{name:'Remo con mancuerna',exact:true}).waitFor();
  await focus.getByRole('button',{name:'Completar serie 1',exact:true}).click();
  await focus.getByRole('button',{name:'Saltar descanso',exact:true}).click();
  await focus.getByRole('button',{name:'Completar serie 2',exact:true}).click();
  const summary=page.getByRole('dialog',{name:'Finalizar entrenamiento',exact:true});await summary.waitFor();
  await summary.getByRole('combobox').selectOption('Buena');await summary.getByRole('button',{name:'Confirmar y finalizar',exact:true}).click();
  await page.getByText('Entrenamiento guardado correctamente',{exact:true}).waitFor();
  await setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  let records=[];
  for(let attempt=0;attempt<100;attempt++) {
    records=await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('bm-training-offline-v1',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('records').objectStore('records').getAll();get.onsuccess=()=>{resolve(get.result.map(r=>({pending:r.pending,status:r.payload.status,error:r.error})));db.close()}}}));
    if(records.length===1&&!records[0].pending)break;
    await page.waitForTimeout(100);
  }
  assert.deepEqual(records,[{pending:false,status:'finalizado',error:undefined}],'offline queue synchronized');
  assert.equal(posts.filter(post=>post.status==='finalizado').length,1,'offline final sync once');
  assert.deepEqual(errors,[]);results.push({scenario:'offline reload paused, finish, reconnect',status:'PASS'});await context.close();
 }
 {
  const {page,context}=await setup(320,'light','#2563eb',{brokenMedia:true,mixed:true});const focus=await enter(page);
  await focus.getByRole('button',{name:'Iniciar entrenamiento',exact:true}).click();
  for(let exercise=0;exercise<2;exercise++)for(let set=1;set<=2;set++){
   await focus.getByRole('button',{name:'Completar serie '+set,exact:true}).click();
   if(exercise===0||set===1)await focus.getByRole('button',{name:'Saltar descanso',exact:true}).click();
   if(exercise===0&&set===2)await focus.getByRole('heading',{name:'Remo con mancuerna',exact:true}).waitFor();
  }
  await page.waitForTimeout(800);
  assert.equal(await page.getByRole('dialog',{name:'Finalizar entrenamiento',exact:true}).count(),0,'pending mixed block is not finalized');
  assert.equal(await focus.locator('.workout-focus-media').count(),0,'broken media collapses');
  await layout(page,focus);results.push({scenario:'mixed pending block and broken media',status:'PASS'});await context.close();
 }
 await writeFile(path.join(output,'validation.json'),JSON.stringify({results},null,2));
} finally {await browser.close()}
console.log(results.length+' focus scenarios passed');
