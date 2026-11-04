import assert from 'node:assert/strict';
import {test,afterEach} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url),ts=require('typescript');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const local=name=>{if(!name.startsWith('@/')&&!name.startsWith('.'))return require(name);const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);return load([base,base+'.ts',base+'.tsx'].find(existsSync));};new Function('require','module','exports',code)(local,mod,mod.exports);return mod.exports;}
const {workoutDurationError,validateWorkoutSessionInput,WORKOUT_MAX_DURATION_MINUTES}=load('lib/workout-session-validation.ts');
const {WorkoutFinishDuration}=load('componentes/workout-finish-duration.tsx');
const dom=new JSDOM('<html><body></body></html>',{url:'https://bm.test/portal/rutina'});for(const key of ['window','document','navigator','HTMLElement','Element','Node','Event'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),h=React.createElement,{render,screen,fireEvent,cleanup}=require('@testing-library/react');afterEach(cleanup);
function session(minutes=45){return {routineId:'r',dayId:'d',routineName:'Rutina',date:'2026-11-04',startTime:'09:00',durationMinutes:minutes,hasPain:false,painDetails:'',finalComment:'Mi comentario',generalFeeling:'Buena',status:'finalizado',exercises:[{exerciseId:'e',observation:'',sets:[{setNumber:1,weight:72,repetitions:8,effort:2,completed:true,observation:''}]}],blocks:[]};}
for(const value of [1,45,1440,1441,1523,0,-1,1.5,NaN,Infinity])test(`misma validación de duración cliente/servidor: ${value}`,()=>{const error=workoutDurationError(value);assert.equal(validateWorkoutSessionInput(session(value)),error);assert.equal(Boolean(error),!Number.isInteger(value)||value<1||value>WORKOUT_MAX_DURATION_MINUTES);});
for(const width of [390,1280])for(const theme of ['light','dark'])test(`${width}px ${theme}: aviso, edición explícita y conservación de series`,()=>{
 window.innerWidth=width;document.documentElement.dataset.theme=theme;let state=session(1523);
 function View(){const [draft,setDraft]=React.useState(state);return h(WorkoutFinishDuration,{minutes:draft.durationMinutes,disabled:false,onChange:minutes=>setDraft(current=>{state={...current,durationMinutes:minutes};return state;})});}
 render(h(View));assert.ok(screen.getByText('1523 min'));assert.ok(screen.getByRole('alert').textContent.includes('No se puede guardar: superaste el tiempo máximo permitido'));assert.equal(screen.queryByRole('spinbutton'),null);
 fireEvent.click(screen.getByRole('button',{name:'Editar tiempo'}));const input=screen.getByLabelText('Duración (min)');assert.equal(input.max,'1440');fireEvent.change(input,{target:{value:'0'}});assert.equal(input.getAttribute('aria-invalid'),'true');
 fireEvent.change(input,{target:{value:'45'}});assert.ok(screen.getByText('45 min'));assert.equal(screen.queryByRole('alert'),null);assert.deepEqual(state.exercises,session().exercises);
 fireEvent.click(screen.getByRole('button',{name:'Listo'}));assert.equal(screen.queryByRole('spinbutton'),null);
});
const source=readFileSync('componentes/portal-section.tsx','utf8');const saveSource=source.slice(source.indexOf('  async function save(finalize = false)'),source.indexOf('  function openFinalSummary()'));
function saveHarness(draft,fail=false){const calls=[];const bindings={draft:{...draft,status:"en_progreso"},saveLockRef:{current:false},workoutDurationError,sessionFinalizingRef:{current:false},autosaveAbortRef:{current:null},sensation:'Buena',painLocation:'',painIntensity:null,error:'',finishError:'',finalOpen:true,setFinishError:value=>bindings.finishError=value,setSaving:()=>{},setSavingAction:()=>{},setError:value=>bindings.error=value,setMessage:()=>{},requestWorkout:async(_url,options)=>{calls.push(JSON.parse(options.body));if(fail)throw new Error('Servidor: sesión no disponible');return{id:'saved'};},announceNewAchievements:()=>{},storageKey:()=> 'test-workout',autosaveSignature:{current:''},setStarted:()=>{},setFinalOpen:()=>{},setDraft:value=>bindings.draft=value,setCompletionSuccess:()=>{},selfService:false,window:{localStorage:{removeItem:()=>{}},setTimeout:()=>{}}};const code=ts.transpileModule(saveSource+'\nreturn save;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return {bindings,calls,save:new Function('bindings','with(bindings){'+code+'}')(bindings)};}
test('1523 min se rechaza; corregir a 45 permite guardar conservando ejercicios y comentario',async()=>{const harness=saveHarness(session(1523));assert.equal(await harness.save(true),false);assert.equal(harness.calls.length,0);harness.bindings.draft={...harness.bindings.draft,durationMinutes:45};assert.equal(await harness.save(true),true);assert.equal(harness.calls[0].durationMinutes,45);assert.deepEqual(harness.calls[0].exercises,session().exercises);assert.ok(harness.calls[0].finalComment.includes('Mi comentario'));});
test('error servidor mantiene todos los datos y permite reintentar',async()=>{const initial={...session(),status:"en_progreso"};const harness=saveHarness(initial,true);assert.equal(await harness.save(true),false);assert.deepEqual(harness.bindings.draft,initial);assert.equal(harness.bindings.finishError,'Servidor: sesión no disponible');assert.equal(harness.bindings.error,'');assert.equal(harness.bindings.saveLockRef.current,false);assert.equal(harness.bindings.sessionFinalizingRef.current,false);});
test('duración ausente no finaliza y la interfaz conserva el motivo del servidor dentro del diálogo',async()=>{const harness=saveHarness(session(null));assert.equal(await harness.save(true),false);assert.equal(harness.calls.length,0);const summary=source.slice(source.indexOf('<RoutineOverlay open={finalOpen}'),source.indexOf('</RoutineOverlay>',source.indexOf('<RoutineOverlay open={finalOpen}')));assert.match(summary,/\(finishError \|\| error\) && <p role="alert"/);assert.doesNotMatch(summary,/save\(false\); setFinalOpen\(false\)/);});


const overlayModule={exports:{}};
const overlayCode=ts.transpileModule(readFileSync('componentes/routine-overlay.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new Function('require','module','exports',overlayCode)(name=>name==='@/componentes/keyboard-dialog'?{KeyboardDialog:({children,as='section',...props})=>{ delete props.onClose; delete props.priority; return h(as,props,children); }}:require(name),overlayModule,overlayModule.exports);
const {RoutineOverlay}=overlayModule.exports;
for(const width of [390,1280])test(`${width}px finalización sólo dentro del diálogo; Home y rutina sin editor ni errores residuales`,()=>{
 window.innerWidth=width;
 function View(){const [open,setOpen]=React.useState(false);return h('div',null,h('p',null,'Rutina en ejecución'),h('button',{onClick:()=>setOpen(true)},'Finalizar entrenamiento'),h(RoutineOverlay,{open,onClose:()=>setOpen(false),labelledBy:'finish-title'},h('h2',{id:'finish-title'},'Confirmar entrenamiento'),h(WorkoutFinishDuration,{minutes:1523,disabled:false,onChange:()=>{}}),h('p',{role:'alert'},'Servidor: sesión no disponible'),h('button',{onClick:()=>setOpen(false)},'Cerrar finalización')));}
 render(h(View));assert.equal(screen.queryByText('Tiempo trabajado'),null);assert.equal(screen.queryByRole('alert'),null);
 fireEvent.click(screen.getByRole('button',{name:'Finalizar entrenamiento'}));
 const dialog=screen.getByRole('dialog');assert.ok(dialog.contains(screen.getByText('Tiempo trabajado')));assert.ok(dialog.contains(screen.getByRole('button',{name:'Editar tiempo'})));assert.equal(screen.getByText('Rutina en ejecución').parentElement.contains(screen.getByText('Tiempo trabajado')),false);
 fireEvent.click(screen.getByRole('button',{name:'Cerrar finalización'}));assert.equal(screen.queryByRole('dialog'),null);assert.equal(screen.queryByText('Tiempo trabajado'),null);assert.equal(screen.queryByRole('alert'),null);
});
test('el editor existe sólo en el JSX de finalización y el autosave conserva localmente las duraciones inválidas',()=>{
 const before=source.slice(0,source.indexOf('<RoutineOverlay open={finalOpen}'));
 assert.doesNotMatch(before,/<WorkoutFinishDuration/);
 assert.match(source,/if \(workoutDurationError\(draft.durationMinutes\)\) return;/);
 assert.match(source,/error && !finalOpen && error !== workoutDurationError/);
});
const offlineSource=readFileSync('componentes/offline-training.tsx','utf8');const offlineAst=ts.createSourceFile('offline.tsx',offlineSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const bridge=offlineAst.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='OfflineTrainingBridge').getText(offlineAst).replace('export function','function');
const bridgeCode=ts.transpileModule('const {useEffect,useState}=require("react");'+bridge+';return OfflineTrainingBridge;',{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
test('Home y rutina no publican el error de duración de la cola; otros avisos de conexión se conservan',async()=>{
 const pending={snapshot:{scope:'s'},pending:1,error:workoutDurationError(1523)};
 const Bridge=new Function('require','offlineTrainingState','subscribeOfflineTraining','refreshOfflineTraining','forgetOfflineTrainingMemory','hydrateOfflineTraining','WORKOUT_MAX_DURATION_MINUTES','workoutDurationError','const exports={};'+bridgeCode)(require,()=>pending,()=>()=>{},async()=>{},()=>{},async()=>{},WORKOUT_MAX_DURATION_MINUTES,workoutDurationError);
 const view=render(h(Bridge));assert.equal(screen.queryByText('Pendiente de sincronización'),null);assert.equal(screen.queryByText(pending.error),null);view.unmount();
 pending.error='Sin conexión con el servidor';render(h(Bridge));assert.ok(await screen.findByText('Pendiente de sincronización'));assert.ok(screen.getByText(pending.error));
});


for (const sensation of ["", "Buena"]) test(`guardado con sensación ${sensation || "sin seleccionar"}: no inventa valor y mantiene la sesión guardada sin duplicados`,async()=>{
 const harness=saveHarness(session());harness.bindings.sensation=sensation;
 assert.equal(await harness.save(true),true);
 const payload=harness.calls[0];assert.equal(validateWorkoutSessionInput(payload),null);
 assert.equal(payload.generalFeeling,sensation||undefined);
 assert.equal(payload.finalComment.includes('Sensación general:'),Boolean(sensation));
 assert.equal(harness.bindings.draft.status,'finalizado');assert.equal(harness.bindings.draft.id,'saved');assert.deepEqual(harness.bindings.draft.exercises,session().exercises);
 assert.equal(await harness.save(true),false);assert.equal(harness.calls.length,1);assert.equal(harness.bindings.finishError,'');
});
test('sensación ausente se acepta en servidor; valor inválido y duración fuera del límite siguen rechazados',()=>{
 for (const generalFeeling of [undefined,null,''])assert.equal(validateWorkoutSessionInput({...session(),generalFeeling,finalComment:'Comentario libre'}),null);
 assert.ok(validateWorkoutSessionInput({...session(),generalFeeling:'Inventada'}));
 assert.ok(validateWorkoutSessionInput({...session(),generalFeeling:undefined,durationMinutes:1441}));
 assert.match(source,/const dayStateLabel = completionSuccess \? "Finalizado"/);
 const summary=source.slice(source.indexOf('<RoutineOverlay open={finalOpen}'),source.indexOf('</RoutineOverlay>',source.indexOf('<RoutineOverlay open={finalOpen}')));
 assert.match(summary,/Sensación general \(opcional\)/);assert.doesNotMatch(summary,/!sensation/);
});
