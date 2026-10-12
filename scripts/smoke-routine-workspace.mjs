// Real React components and compiled app CSS, synthetic HTTP responses only.
import assert from 'node:assert/strict';
import { checkLibraryInteractions } from './routine-library-interaction-checks.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {webpack}=require('next/dist/compiled/webpack/webpack');
const {chromium}=createRequire(path.join(process.env.BM_TEST_NODE_MODULES,'playwright/package.json'))('playwright');
const root=process.cwd(), temp=mkdtempSync(path.join(tmpdir(),'bm-routine-workspace-'));
writeFileSync(path.join(temp,'loader.cjs'),`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}`);
writeFileSync(path.join(temp,'link.jsx'),`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
writeFileSync(path.join(temp,'image.jsx'),`import React from 'react';export default function Image({priority,unoptimized,fill,...props}){return <img {...props}/>} `);
writeFileSync(path.join(temp,'entry.tsx'),"import React from 'react';import {createRoot} from 'react-dom/client';import RoutinesPage from '@/app/rutinas/page';import {workspaceBrandingVariables} from '@/lib/workspace-branding';import {applyAppearance} from '@/lib/appearance';const f=window.fixture;window.applyTestAppearance=applyAppearance;window.testBranding=workspaceBrandingVariables;applyAppearance(f.theme);createRoot(document.getElementById('root')).render(<div className=\"workspace-brand admin-panel\" style={workspaceBrandingVariables(f.accent)}><RoutinesPage/></div>);");
writeFileSync(path.join(temp,'crypto.js'), 'export function createHash(){throw new Error("Server hashing is not part of this UI smoke")}');
await new Promise((resolve,reject)=>webpack({plugins:[new webpack.NormalModuleReplacementPlugin(/^node:crypto$/,path.join(temp,'crypto.js'))],mode:'production',entry:path.join(temp,'entry.tsx'),output:{path:temp,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(root,'node_modules')],alias:{'@':root,'next/link':path.join(temp,'link.jsx'),'next/image':path.join(temp,'image.jsx')}},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(temp,'loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
const css=readdirSync('.next/static/chunks').filter(x=>x.endsWith('.css')).map(x=>readFileSync(path.join('.next/static/chunks',x),'utf8')).join('\n');
const bundle=readFileSync(path.join(temp,'bundle.js'));
console.log(`Visuals: ${temp}`);
const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle)}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css)}else if(req.url.startsWith('/avatars/')||req.url.startsWith('/bm-training-')){try{res.end(readFileSync(path.join(root,'public',decodeURI(req.url))))}catch{res.writeHead(404).end()}}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const exercise={id:'squat',sourceId:'squat',name:'barbell squat',displayName:'Squat',displayNameEs:'Sentadilla con barra',aliases:[],translationStatus:'EXCEPTION',translationPass:2,bodyPart:'legs',bodyPartLabelEs:'Piernas',equipment:'barbell',equipmentLabelEs:'Barra',targetMuscle:'quads',targetMuscleLabelEs:'Cuádriceps',muscleGroup:'Cuádriceps',muscleGroupLabelEs:'Cuádriceps',secondaryMuscles:[],secondaryMusclesEs:[],instructionsEs:'Controlar',instructionStepsEs:['Controlar'],source:'EXERCISES_DATASET',searchableText:'sentadilla barra piernas cuádriceps'};
const prescription={name:'Sentadilla con barra',muscleGroup:'Cuádriceps',sets:3,repetitions:'8-12',weight:null,effortType:'RIR',effortValue:2,restSeconds:90,observations:'',videoUrl:'',tempo:'',alternativeExercise:'',equipment:'',optional:false,targetType:'REPS',targetSeconds:null,targetRepetitions:'',targetDistance:'',targetSide:'',order:1};
const savedBlock={id:'library',name:'Piernas base',type:'STRENGTH',status:'active',isFavorite:true,lastUsedAt:'2026-10-09T12:00:00Z',tags:['Piernas'],folder:null,folderId:null,content:{type:'STRENGTH',name:'Piernas base',order:1,rounds:null,durationSeconds:null,workSeconds:null,restSeconds:null,restBetweenRoundsSeconds:null,targetRounds:null,instructions:'',exercises:[prescription]}};
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
let routines=[],saves=[],slow=0,conflict=false;
await page.addInitScript(()=>{window.fixture={theme:'dark',accent:'#D4A72C'}});
await page.route('**/api/**',async route=>{
const url=new URL(route.request().url()),method=route.request().method();let body=[];
if(url.pathname==='/api/admin/auth/session')body={authenticated:true,userId:'coach',workspaceId:'workspace'};
else if(url.pathname==='/api/alumnos')body=[{id:'student',firstName:'Alumno',lastName:'Prueba',phone:'',serviceType:'CLASSES',status:'activo'}];
else if(url.pathname==='/api/rutinas'&&method==='GET')body=routines;
else if(url.pathname.startsWith('/api/rutinas')&&(method==='POST'||method==='PUT')){
const input=route.request().postDataJSON();saves.push(input);if(slow)await new Promise(resolve=>setTimeout(resolve,slow));
if(conflict)return route.fulfill({status:409,json:{error:'La rutina cambió en otra sesión. Tu copia local se conserva.'}});
body={...input,id:'routine',updatedAt:new Date().toISOString(),createdAt:'2026-10-10T12:00:00Z',students:[],assignedStudents:[],historicalStudents:[],days:input.days.map((day,di)=>({...day,id:day.id||`day-${di}`,blocks:day.blocks.map((block,bi)=>({...block,id:block.id||`block-${di}-${bi}`,exercises:block.exercises.map((ex,ei)=>({...ex,id:ex.id||`ex-${di}-${bi}-${ei}`}))})),exercises:[]}))};routines=[body];}
else if(url.pathname==='/api/training-library/blocks')body=[savedBlock];
else if(url.pathname.startsWith('/api/training-library/blocks/'))body={...savedBlock,lastUsedAt:new Date().toISOString()};
else if(url.pathname==='/api/exercise-library')body={total:1,items:[exercise],facets:{bodyParts:[],equipment:[],targets:[]},mediaEnabled:false};
else if(url.pathname==='/api/exercise-library/squat')body={exercise};
await route.fulfill({json:body});
});
async function create(days=3){await page.getByRole('button',{name:'Nueva rutina',exact:true}).first().click();await page.getByRole('button',{name:/Desde cero/}).click();await page.getByLabel('Nombre',{exact:true}).fill('Hipertrofia Piernas');await page.getByLabel('Cantidad de días').selectOption(String(days));await page.getByRole('button',{name:'Crear y empezar a armar',exact:true}).click();await page.locator('.routine-editor-workspace').waitFor();}
async function geometry(){const overflow=await page.evaluate(()=>[...document.querySelectorAll('.routine-editor-workspace input,.routine-editor-workspace button,.routine-editor-workspace select,.routine-editor-workspace textarea')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('.routine-workspace-days')).map(el=>({r:el.getBoundingClientRect(),name:el.getAttribute('aria-label')||el.textContent||el.tagName})).filter(x=>x.r.right>innerWidth+2||x.r.left < -2).map(x=>x.name));assert.deepEqual(overflow,[],'No horizontal overflow');}
try{
if(process.env.BM_LIBRARY_ONLY) { await checkLibraryInteractions({page,origin,create,geometry,temp,getSaves:()=>saves}); } else {
await page.goto(origin);await create();
await page.getByLabel('Nombre del día',{exact:true}).fill('Cuádriceps dominante');
await page.getByLabel('Objetivo del día',{exact:true}).fill('Fuerza y control de rodilla');
await page.locator('.routine-block-adder summary').click();await page.getByRole('button',{name:'Fuerza',exact:true}).click();
await page.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).click();
await page.getByLabel('Buscar ejercicio',{exact:true}).fill('sentadilla');
await page.locator('.routine-library-drawer').getByRole('button',{name:'Agregar',exact:true}).click();
await page.getByText('Sentadilla con barra agregado',{exact:true}).waitFor();
for(let i=0;i<3;i++){await page.locator('.routine-library-drawer').getByRole('button',{name:'Agregar',exact:true}).click();await page.waitForTimeout(80);}
await page.getByRole('button',{name:'Favorito: Sentadilla con barra'}).click();await page.getByRole('button',{name:'Favoritos',exact:true}).click();assert.equal(await page.locator('.routine-library-drawer').getByRole('button',{name:'Agregar',exact:true}).count(),1);
await page.getByRole('button',{name:'Recientes',exact:true}).click();assert.equal(await page.locator('.routine-library-drawer').getByRole('button',{name:'Agregar',exact:true}).count(),1);
await page.locator('.routine-library-drawer').getByRole('button',{name:'Cerrar',exact:true}).click();
assert.equal(await page.locator('.routine-exercise-quick').count(),4);
for(const [i,name] of ['Sentadilla con barra','Prensa','Zancadas','Extensión de cuádriceps'].entries())await page.locator('.routine-exercise-quick').nth(i).getByLabel('Ejercicio',{exact:true}).fill(name);
await page.locator('.routine-exercise-quick').first().getByLabel('Series',{exact:true}).fill('4');await page.locator('.routine-exercise-quick').first().getByLabel('Reps',{exact:true}).fill('6-8');
await page.locator('.routine-bulk-editor summary').click();await page.getByLabel('Seleccionar todos',{exact:true}).check();await page.locator('.routine-bulk-fields').getByLabel('Series',{exact:true}).fill('4');await page.locator('.routine-bulk-fields').getByLabel('Descanso (s)',{exact:true}).fill('120');await page.getByRole('button',{name:'Aplicar a 4',exact:true}).click();
await page.getByRole('button',{name:'Deshacer',exact:true}).click();assert.equal(await page.locator('.routine-exercise-quick').last().getByLabel('Series',{exact:true}).inputValue(),'3');await page.getByRole('button',{name:'Rehacer',exact:true}).click();assert.equal(await page.locator('.routine-exercise-quick').last().getByLabel('Series',{exact:true}).inputValue(),'4');
await page.locator('.routine-bulk-editor summary').click();
await page.locator('.routine-day-actions summary').click();await page.getByRole('button',{name:'Duplicar día',exact:true}).click();await page.getByLabel('Nombre del día',{exact:true}).fill('Posterior y glúteos');await page.getByRole('button',{name:'Duplicar día',exact:true}).click();await page.getByLabel('Nombre del día',{exact:true}).fill('Mixto');
for(const [i,name] of ['Sentadilla goblet','Peso muerto sumo','Step up','Gemelos'].entries())await page.locator('.routine-exercise-quick').nth(i).getByLabel('Ejercicio',{exact:true}).fill(name);
// Remove the two originally empty days, retaining a realistic 3-day / 12-exercise week.
for(let i=0;i<2;i++){await page.locator('.routine-workspace-day').last().locator('button').last().click();await page.getByRole('button',{name:'Eliminar día',exact:true}).click();}
assert.equal(await page.locator('.routine-workspace-day').count(),3);
await page.locator('.routine-workspace-day').nth(1).locator('button').last().click();
for(const [i,name] of ['Peso muerto rumano','Hip thrust','Curl femoral','Abducción'].entries())await page.locator('.routine-exercise-quick').nth(i).getByLabel('Ejercicio',{exact:true}).fill(name);
await page.locator('.routine-workspace-day').first().locator('button').last().click();
await page.locator('.routine-exercise-actions summary').first().click();
await page.locator('.routine-exercise-toolbar select').first().selectOption({label:'2. Posterior y glúteos · Bloque de fuerza'});
assert.equal(await page.locator('.routine-exercise-quick').count(),3);await page.keyboard.press('Control+z');assert.equal(await page.locator('.routine-exercise-quick').count(),4);await page.keyboard.press('Control+Shift+z');assert.equal(await page.locator('.routine-exercise-quick').count(),3);
await page.getByRole('button',{name:'Buscar en Biblioteca',exact:true}).click();await page.getByLabel('Buscar bloque',{exact:true}).fill('Piernas');await page.locator('.routine-library-drawer').getByRole('button',{name:'Agregar',exact:true}).click();await page.waitForTimeout(150);assert.equal(await page.locator('.routine-library-drawer').count(),1);await page.getByLabel('Cerrar selector de Biblioteca').click();
await page.getByRole('button',{name:'Intervalos',exact:true}).click();
await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();await page.getByText(/está vacío/).first().waitFor();await page.getByRole('button',{name:'Seguir editando',exact:true}).click();
await page.waitForTimeout(800);assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('bm:routine-draft:workspace:coach:'))));
slow=700;await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Guardando…',{exact:true}).waitFor();assert.ok(await page.locator('.routine-workspace-day').first().locator('button').last().isDisabled());await page.getByText('Guardado en el servidor',{exact:true}).waitFor();slow=0;
assert.equal(saves.length,1);assert.equal(saves[0].days.length,3);assert.equal(saves[0].studentIds.length,0);assert.ok(saves[0].days.flatMap(day=>day.blocks).flatMap(block=>block.exercises).length>=12);
await page.getByLabel('Nombre del día',{exact:true}).fill('Cambio rápido');await page.getByRole('button',{name:'← Rutinas',exact:true}).click();await page.getByRole('button',{name:'Seguir editando',exact:true}).click();
await page.waitForTimeout(750);await page.reload();
async function reopen(){await page.getByRole('button',{name:/Borradores/}).click();await page.getByRole('button',{name:'Continuar editando',exact:true}).first().click();}
await reopen();await page.getByRole('button',{name:'Recuperar',exact:true}).click();assert.equal(await page.getByLabel('Nombre del día',{exact:true}).inputValue(),'Cambio rápido');
conflict=true;await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('alert').filter({hasText:'La rutina cambió'}).waitFor();assert.equal(await page.getByLabel('Nombre del día',{exact:true}).inputValue(),'Cambio rápido');conflict=false;
await page.keyboard.press('Control+s');await page.getByText('Guardado en el servidor',{exact:true}).waitFor();
await page.getByRole('button',{name:'← Rutinas',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'Cambios sin guardar en el servidor'}).count(),0);await reopen();
// Actual controls at every requested viewport and appearance combination.
for(const width of [320,390,768,1280,1440,1920])for(const theme of ['light','dark','system'])for(const accent of ['#D4A72C','#2563eb']){
await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:width===390?'light':'dark',reducedMotion:'reduce'});await page.evaluate(({theme,accent})=>{window.applyTestAppearance(theme);const el=document.querySelector('.workspace-brand');Object.entries(window.testBranding(accent)).forEach(([key,value])=>el.style.setProperty(key,value));},{theme,accent});
await geometry();
const adder = page.locator('.routine-block-adder');
if(!await adder.evaluate(el=>el.open))await adder.locator('summary').click();
await geometry();
assert.equal(await adder.locator('.routine-block-type-list button').count(),8);
assert.equal(await adder.locator('.routine-block-type-list .routine-library-open').count(),0);
assert.equal(await adder.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Block adder has no overflow');
for(const button of await adder.locator('button').all()) { const box=await button.boundingBox();assert.ok(box&&box.height>=44,'Block and Library touch targets'); }
if([320,390,768,1280].includes(width)&&theme==='dark'&&accent==='#D4A72C')await adder.screenshot({path:path.join(temp,`block-adder-${width}.png`)});
await page.locator('.routine-exercise-quick').first().getByLabel('Reps',{exact:true}).fill('8-10');await page.locator('.routine-exercise-quick').first().getByLabel('Series',{exact:true}).fill('4');
await page.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).first().click();await page.getByLabel('Buscar ejercicio',{exact:true}).fill('sentadilla');await geometry();await page.locator('.routine-library-drawer').getByRole('button',{name:'Cerrar',exact:true}).click();
await page.locator('.routine-editor-workspace').evaluate(el=>el.scrollTop=0);if((width===390||width===1440)&&theme!=='system'&&accent==='#2563eb')await page.screenshot({path:path.join(temp,`workspace-${width}-${theme}.png`)});
console.log(width,theme,accent,'controls and geometry OK');}
await page.setViewportSize({width:1440,height:1000});
await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();await page.getByRole('button',{name:'Activar rutina',exact:true}).click();await page.locator('.routine-editor-workspace').waitFor({state:'detached'});assert.equal(saves.at(-1).status,'activa');
console.log('Recovery, conflict, save-and-stay, clean exit, 36 visual combinations and activation OK');
console.log('Main workflow OK; saves=',saves.length);
// Create every existing block type through the real editor and preserve its own fields.
await create(1);await page.locator('.routine-block-adder summary').click();
const types=['Fuerza','Circuito','Intervalos','EMOM','AMRAP','For time','Bloque libre','Movilidad'];
for(const type of types){
  await page.locator('.routine-block-adder').getByRole('button',{name:type,exact:true}).click();
  const block=page.locator('.routine-workspace-canvas .routine-sortable-block > article').last();
  await block.getByLabel('Nombre del bloque').fill(type+' prueba');
  await block.getByText('Configuración del bloque',{exact:true}).click();
  await block.getByLabel('Instrucciones',{exact:true}).fill('Conservar configuración '+type);
  await block.getByRole('button',{name:'Ocultar ejercicios',exact:true}).click();
  await block.getByRole('button',{name:/Ver ejercicios/}).click();
  await block.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).click();
  await page.getByLabel('Buscar ejercicio',{exact:true}).fill('sentadilla');
  await page.locator('.routine-library-drawer').getByRole('button',{name:'Agregar',exact:true}).click();
  await page.getByText('Sentadilla con barra agregado',{exact:true}).waitFor();
  await page.locator('.routine-library-drawer').getByRole('button',{name:'Cerrar',exact:true}).click();
  const blockCount=await page.getByLabel('Nombre del bloque').count();
  await block.getByLabel('Acciones del bloque').click();await page.locator('.routine-floating-actions').getByRole('button',{name:'Duplicar',exact:true}).click();
  assert.equal(await page.getByLabel('Nombre del bloque').count(),blockCount+1);
  await page.keyboard.press('Control+z');assert.equal(await page.getByLabel('Nombre del bloque').count(),blockCount);
  await page.keyboard.press('Control+Shift+z');assert.equal(await page.getByLabel('Nombre del bloque').count(),blockCount+1);
  const duplicate=page.locator('.routine-workspace-canvas .routine-sortable-block > article').last();
  await duplicate.getByLabel('Acciones del bloque').click();await page.locator('.routine-floating-actions').getByRole('button',{name:'Eliminar',exact:true}).click();
  assert.equal(await page.getByLabel('Nombre del bloque').count(),blockCount);await page.keyboard.press('Control+z');await page.keyboard.press('Control+z');
}
await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Guardado en el servidor',{exact:true}).waitFor();
assert.deepEqual(saves.at(-1).days[0].blocks.map(block=>block.type),['STRENGTH','ROUNDS','INTERVAL','EMOM','AMRAP','FOR_TIME','FREE','MOBILITY']);
assert.ok(saves.at(-1).days[0].blocks.every(block=>block.exercises.length===1&&block.instructions.startsWith('Conservar')));
await page.getByLabel('Nombre del día',{exact:true}).fill('Temporal');await page.waitForTimeout(800);await page.keyboard.press('Control+z');await page.waitForTimeout(800);
assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('bm:routine-draft:')).length),0,'Undo to saved version removes stale backup');
await page.getByRole('button',{name:'← Rutinas',exact:true}).click();
console.log('All eight block types: create, edit, collapse, expand, insert and save OK');
// Same mounted production components, large synthetic routines; no production data.
for(const [days,total] of [[1,5],[3,20],[5,40],[7,77]]){
  routines=[{...routines[0],status:'borrador',days:Array.from({length:days},(_,di)=>({id:`perf-day-${di}`,dayNumber:di+1,name:`Día ${di+1}`,objective:'',warmup:'',observations:'',estimatedMinutes:null,exercises:[],blocks:[{...savedBlock.content,id:`perf-block-${di}`,exercises:Array.from({length:Math.floor(total/days)+(di<total%days?1:0)},(_,ei)=>({...prescription,id:`perf-${di}-${ei}`,name:`Ejercicio ${di+1}.${ei+1}`,order:ei+1}))}]}))}];
  await page.reload();await reopen();
  const started=performance.now();
  await page.locator('.routine-exercise-quick').first().getByLabel('Reps',{exact:true}).pressSequentially('1234567890',{delay:0});
  const typing=Math.round(performance.now()-started);
  const switching=performance.now();for(let i=0;i<days;i++)await page.locator('.routine-workspace-day').nth(i).locator('button').last().click();
  const switchMs=Math.round((performance.now()-switching)/days);
  const handle=page.getByRole('button',{name:/Reordenar ejercicio/}).first();await handle.focus();await page.keyboard.press('End');await page.keyboard.press('Control+z');
  await page.locator('.routine-bulk-editor summary').click();await page.getByLabel('Seleccionar todos',{exact:true}).check();await page.getByLabel('Seleccionar todos',{exact:true}).uncheck();await page.locator('.routine-bulk-editor summary').click();
  await page.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).click();await page.getByLabel('Buscar ejercicio',{exact:true}).fill('sentadilla');await page.keyboard.press('Escape');
  assert.ok(await page.locator('.routine-exercise-quick').count()<=Math.ceil(total/days),'Only active day exercises mounted');
  console.log(`Performance ${days} days / ${total} exercises: 10 keys ${typing} ms; day switch avg ${switchMs} ms`);
  await page.getByRole('button',{name:'← Rutinas',exact:true}).click();
  if(await page.getByRole('dialog',{name:'Cambios sin guardar en el servidor'}).count())await page.getByRole('button',{name:'Descartar y salir',exact:true}).click();
}
// Mobile operations, including a reduced visual viewport to represent an open keyboard.
for(const width of [320,390,768]){
  await page.setViewportSize({width,height:850});await page.reload();await reopen();
  const before=await page.locator('.routine-workspace-day').count();await page.getByRole('button',{name:'+ Día',exact:true}).click();assert.equal(await page.locator('.routine-workspace-day').count(),before+1);
  await page.getByLabel('Nombre del día',{exact:true}).fill('Día móvil');
  await page.locator('.routine-block-adder summary').click();await page.locator('.routine-block-adder').getByRole('button',{name:'Fuerza',exact:true}).click();
  await page.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).click();await page.setViewportSize({width,height:450});
  await page.getByLabel('Buscar ejercicio',{exact:true}).fill('sentadilla');await page.locator('.routine-library-drawer').getByRole('button',{name:'Agregar',exact:true}).click();await page.getByText('Sentadilla con barra agregado',{exact:true}).waitFor();
  await geometry();await page.locator('.routine-library-drawer').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.locator('.routine-exercise-quick').getByLabel('Series',{exact:true}).fill('5');await page.locator('.routine-exercise-quick').getByLabel('Reps',{exact:true}).fill('8-10');
  await page.locator('.routine-exercise-actions summary').click();await page.getByRole('button',{name:'Duplicar ejercicio Sentadilla con barra',exact:true}).click();
  await page.locator('.routine-bulk-editor summary').click();await page.getByLabel('Seleccionar todos',{exact:true}).check();
  await page.locator('.routine-bulk-fields').getByLabel('Series',{exact:true}).fill('4');await page.locator('.routine-bulk-fields').getByLabel('Reps',{exact:true}).fill('10-12');await page.locator('.routine-bulk-fields').getByLabel('Descanso (s)',{exact:true}).fill('90');await page.getByRole('button',{name:'Aplicar a 2',exact:true}).click();
  assert.equal(await page.locator('.routine-exercise-quick').last().getByLabel('Reps',{exact:true}).inputValue(),'10-12');
  await page.locator('.routine-bulk-editor summary').click();await page.locator('.routine-exercise-toolbar select').first().selectOption({index:1});assert.equal(await page.locator('.routine-exercise-quick').count(),1);await page.keyboard.press('Control+z');assert.equal(await page.locator('.routine-exercise-quick').count(),2);
  await page.getByLabel('Acciones del bloque').click();await page.getByLabel('Copiar bloque a día').selectOption({index:1});await page.keyboard.press('Control+z');
  await page.getByLabel('Acciones del bloque').click();await page.getByLabel('Mover bloque a día').selectOption({index:1});assert.equal(await page.locator('.routine-exercise-quick').count(),0);await page.keyboard.press('Control+z');assert.equal(await page.locator('.routine-exercise-quick').count(),2);
  await geometry();
  await page.setViewportSize({width,height:850});await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Guardado en el servidor',{exact:true}).waitFor();
  if(width===768){await page.locator('.routine-workspace-settings > summary').click();await page.getByRole('button',{name:'Asignar alumnos',exact:true}).click();await page.getByLabel(/Alumno Prueba/).check();}
  await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();await page.getByRole('button',{name:'Activar rutina',exact:true}).click();await page.locator('.routine-editor-workspace').waitFor({state:'detached'});
  if(width===768)assert.deepEqual(saves.at(-1).studentIds,['student']);
  routines[0].status='borrador';console.log(`Mobile ${width}: add day/block/exercise, shortened viewport, prescription, save and activation OK`);
}
await page.setViewportSize({width:390,height:850});await page.reload();await reopen();
await page.locator('.routine-exercise-quick').first().getByLabel('Ejercicio',{exact:true}).fill('');
await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Activar rutina',exact:true}).isDisabled());await page.getByRole('button',{name:'Seguir editando',exact:true}).click();await page.keyboard.press('Control+z');
await page.getByLabel('Nombre del día',{exact:true}).fill('Guardado al salir');await page.getByRole('button',{name:'← Rutinas',exact:true}).click();await page.getByRole('button',{name:'Guardar y salir',exact:true}).click();await page.locator('.routine-editor-workspace').waitFor({state:'detached'});assert.equal(saves.at(-1).days[0].name,'Guardado al salir');
await create(1);await page.getByLabel('Nombre del día',{exact:true}).fill('Borrador local nuevo');await page.waitForTimeout(800);await page.reload();await create(1);await page.getByRole('button',{name:'Recuperar',exact:true}).click();assert.equal(await page.getByLabel('Nombre del día',{exact:true}).inputValue(),'Borrador local nuevo');
await page.getByRole('button',{name:'← Rutinas',exact:true}).click();await page.getByRole('button',{name:'Descartar y salir',exact:true}).click();
console.log('Incomplete exercise blocks activation; save-and-exit and unsaved new-draft recovery OK');
await page.screenshot({path:path.join(temp,'workspace-initial.png'),fullPage:true});
}
assert.deepEqual(errors,[]);
}catch(error){console.log('UI errors:',errors);await page.screenshot({path:path.join(temp,'failure.png')});console.log((await page.locator('body').innerText()).slice(-1800));throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(`Visuals: ${temp}`);
