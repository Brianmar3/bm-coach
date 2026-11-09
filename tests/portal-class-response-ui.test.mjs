import assert from 'node:assert/strict';import {test,afterEach} from 'node:test';import {readFileSync,existsSync} from 'node:fs';import {createRequire} from 'node:module';import path from 'node:path';import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url),ts=require('typescript');
const dom=new JSDOM('<html><body></body></html>',{url:'https://bm.test/portal/clases',pretendToBeVisual:true});for(const key of ['window','document','navigator','HTMLElement','Element','Node','Event'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),h=React.createElement,{render,screen,fireEvent,cleanup,waitFor,act}=require('@testing-library/react');afterEach(cleanup);
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const local=name=>{if(name==='next/link')return{__esModule:true,default:({children,href,...props})=>h('a',{href,...props},children)};if(name==='@/componentes/class-feedback-invitation')return{ClassFeedbackInvitation:()=>null};if(name==='@/componentes/quick-log')return{QuickNoteButton:()=>null};if(!name.startsWith('@/')&&!name.startsWith('.'))return require(name);const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);return load([base+'.ts',base+'.tsx',path.join(base,'index.ts'),base].find(existsSync));};new Function('require','module','exports',code)(local,mod,mod.exports);return mod.exports;}
const {PortalClasses}=load('componentes/portal-classes.tsx');
const occurrence={id:'a',date:'2026-11-04',startTime:'20:00',endTime:'21:00',name:'Funcional',category:'Funcional',status:'SCHEDULED',statusLabel:'Programada',capacity:null,confirmedCount:0,response:null,canRespond:true};
function fixture(classes=[occurrence]){const state={response:null,fail:false,failLoad:false,hold:null,posts:0,reads:0};globalThis.fetch=async(_url,options={})=>{if(options.method==='POST'){state.posts++;if(state.hold)await new Promise(resolve=>state.hold=resolve);if(state.fail)return{ok:false,json:async()=>({error:'No se pudo confirmar'})};state.response=JSON.parse(options.body).response;return{ok:true,json:async()=>({message:'Guardado'})};}state.reads++;return{ok:!state.failLoad,json:async()=>state.failLoad?{error:'Sin conexión'}:{occurrences:classes.map(item=>({...item,response:state.response})),scheduleLabels:[],flexibleSchedule:'',availability:{eligible:true,message:null},focus:{date:occurrence.date,title:'Clases de hoy',occurrenceIds:['a'],refreshAfterMs:null},upcoming:{occurrenceIds:classes.map(item=>item.id)},summary:{mode:'TODAY',total:1,preview:classes.map(item=>({...item,response:state.response}))}}};};return state;}
for(const width of [390,1280])for(const theme of ['light','dark'])test(width+'px '+theme+': pendiente, selección persistente, cambios y recarga desde servidor',async()=>{
 window.innerWidth=width;document.documentElement.dataset.theme=theme;const state=fixture();let view=render(h(PortalClasses));
 const going=await screen.findByRole('button',{name:'Asistiré',exact:true});assert.equal(going.getAttribute('aria-pressed'),'false');assert.equal(screen.getByRole('button',{name:'No asistiré',exact:true}).getAttribute('aria-pressed'),'false');
 fireEvent.click(going);const confirmed=await screen.findByRole('button',{name:'Confirmado',exact:true});assert.equal(confirmed.getAttribute('aria-pressed'),'true');fireEvent.click(confirmed);assert.equal(state.posts,1);
 fireEvent.click(screen.getByRole('button',{name:'No asistiré',exact:true}));await screen.findByRole('button',{name:'No asistiré confirmado',exact:true});assert.equal(state.response,'NOT_GOING');
 view.unmount();view=render(h(PortalClasses));const restored=await screen.findByRole('button',{name:'No asistiré confirmado',exact:true});assert.equal(restored.getAttribute('aria-pressed'),'true');
 fireEvent.click(screen.getByRole('button',{name:'Asistiré',exact:true}));await screen.findByRole('button',{name:'Confirmado',exact:true});assert.equal(state.response,'GOING');
});
test('error conserva última decisión válida; guardado no se anticipa y dos toques no duplican solicitudes',async()=>{
 const state=fixture();state.response='GOING';render(h(PortalClasses));await screen.findByRole('button',{name:'Confirmado',exact:true});state.fail=true;
 fireEvent.click(screen.getByRole('button',{name:'No asistiré',exact:true}));await screen.findByText('No se pudo confirmar');assert.equal(screen.getByRole('button',{name:'Confirmado',exact:true}).getAttribute('aria-pressed'),'true');
 state.fail=false;state.hold=true;fireEvent.click(screen.getByRole('button',{name:'No asistiré',exact:true}));await waitFor(()=>assert.equal(typeof state.hold,'function'));assert.ok(screen.getByRole('button',{name:'Confirmado',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Confirmado',exact:true}));assert.equal(state.posts,2);
 await act(async()=>state.hold());await screen.findByRole('button',{name:'No asistiré confirmado',exact:true});assert.equal(state.posts,2);
});
test('POST confirmado conserva selección aunque falle la recarga posterior',async()=>{const state=fixture();render(h(PortalClasses));const button=await screen.findByRole('button',{name:'Asistiré',exact:true});state.failLoad=true;fireEvent.click(button);await screen.findByRole('button',{name:'Confirmado',exact:true});await screen.findByText(/Tu respuesta se guardó, pero/);});
test('API presenta la confirmación real incluso si la asistencia efectiva pertenece a otra ocurrencia',()=>{
 const source=readFileSync('app/api/portal/clases/route.ts','utf8');const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true);const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='serializeOccurrence');
 const code=ts.transpileModule(fn.getText(ast)+';return serializeOccurrence;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const serialize=new Function('occurrenceHasStarted','occurrenceHasEnded','databaseDateKey','effectiveOccurrenceId','occurrenceClassName','occurrenceStatusLabel',code)(()=>false,()=>false,date=>date.toISOString().slice(0,10),()=> 'other',()=> 'Funcional',()=> 'Programada');
 for(const response of [null,'GOING','NOT_GOING']){const result=serialize({...occurrence,date:new Date('2026-11-04T00:00:00Z'),capacityOverride:null,responses:[{studentId:'student',response}]},'student',new Map());assert.equal(result.response,response);assert.equal(result.confirmedCount,0);assert.equal(result.canRespond,true);}
});

test('cada enlace de Inicio identifica su clase y mantiene la confirmación como acción separada', async () => {
 const other={...occurrence,id:'b:next',date:'2026-11-05',startTime:'08:00',endTime:'09:00'};
 const state=fixture([occurrence,other]);
 render(h(PortalClasses,{compact:true}));
 const first=await screen.findByRole('link',{name:/Funcional,.*20:00 a 21:00/});
 const second=screen.getByRole('link',{name:/Funcional,.*08:00 a 09:00/});
 assert.equal(first.getAttribute('href'),'/portal/clases?clase=a');
 assert.equal(second.getAttribute('href'),'/portal/clases?clase=b%3Anext');
 assert.equal(second.querySelector('button'),null);
 assert.equal(state.posts,0);
});

for(const id of ['a','b','missing']) test('agenda selecciona la ocurrencia exacta o conserva la vista si no existe: '+id,async()=>{
 const other={...occurrence,id:'b',date:'2026-11-05'};
 const sameDay={...other,id:'c',startTime:'22:00',endTime:'23:00'};
 fixture([occurrence,other,sameDay]);
 const scrolls=[];
 const original=HTMLElement.prototype.scrollIntoView;
 HTMLElement.prototype.scrollIntoView=function(){scrolls.push(this);};
 try {
  render(h(PortalClasses,{selectedClassId:id,showQuickLogAction:true}));
  await screen.findByRole('heading',{name:'Tus próximas clases'});
  assert.equal(screen.getByRole('button',{name:'Próximos 7 días'}).getAttribute('aria-pressed'),String(id==='b'));
  if(id==='missing'){
   assert.equal(document.querySelector('article[aria-current]'),null);
   assert.equal(scrolls.length,0);
   return;
  }
  await waitFor(()=>assert.equal(scrolls.length,1));
  const selected=document.querySelector('article[aria-current="true"]');
  assert.equal(document.activeElement,selected);
  assert.equal(scrolls[0],selected);
  assert.match(selected.textContent,/20:00–21:00/);
  if(id==='b') assert.match(selected.closest('section').querySelector('h3').textContent,/5 de noviembre/);
 } finally { HTMLElement.prototype.scrollIntoView=original; }
});

test('Objetivo semanal usa la diana centrada del sistema de íconos',()=>{
 const source=readFileSync('componentes/portal-section.tsx','utf8');
 assert.match(source,/portal-home-objective-icon[^\n]+<BmFocusIcon size=\{22\}/);
});
