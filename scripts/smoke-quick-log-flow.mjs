// Real React components; viewport/keyboard and quick-log API are isolated fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript');
const { chromium } = createRequire(path.join(process.env.BM_TEST_NODE_MODULES, 'playwright/package.json'))('playwright');
const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css', 'utf8'), { from: path.resolve('app/globals.css') })).css;
const modules = {};
for (const [id, file] of Object.entries({ react: 'react/cjs/react.development.js', 'react-dom': 'react-dom/cjs/react-dom.development.js', 'react-dom/client': 'react-dom/cjs/react-dom-client.development.js', 'react/jsx-runtime': 'react/cjs/react-jsx-runtime.development.js', scheduler: 'scheduler/cjs/scheduler.development.js' })) modules[id] = readFileSync(path.join('node_modules', file), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
for (const file of ['lib/portal-keyboard.ts', 'lib/appearance.ts', 'lib/workspace-branding.ts', 'componentes/portal-keyboard-behavior.tsx', 'componentes/quick-log.tsx', 'lib/quick-log-flow.ts', 'lib/exercise-name.ts', 'componentes/portal-visuals.tsx']) modules[`@/${file.replace(/\.tsx?$/, '')}`] = compile(readFileSync(file, 'utf8'));

modules['./icon'] = compile(readFileSync('componentes/icons/bm-premium/icon.tsx','utf8'));
modules['@/componentes/icons'] = compile(readFileSync('componentes/icons/bm-premium/core.tsx','utf8') + '\n' + readFileSync('componentes/icons/bm-premium/support.tsx','utf8').replace(/^import[^;]+;/gm,''));
modules['next/link'] = 'exports.default=({href,children,...props})=>require("react").createElement("a",{href,...props},children);';
modules['@/componentes/workspace-brand-logo'] = 'exports.WorkspaceBrandLogo=()=>require("react").createElement("span",{},"BM");';
modules['@/componentes/student-photo'] = 'exports.StudentPhoto=()=>null;';
modules['@/lib/profile-avatars'] = 'exports.DEFAULT_PROFILE_AVATAR={src:""};';
modules['@/componentes/achievement-celebration'] = 'exports.announceNewAchievements=()=>{};';
const registry = Object.entries(modules).map(([id, code]) => `${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const mainClass = readFileSync('componentes/portal-shell.tsx', 'utf8').match(/<main key=\{pathname\} className="([^"]+)"/)[1];
const bootstrap = `window.process={env:{NODE_ENV:'development'}};const factories={${registry}},cache={};function require(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;if(!factories[id])throw Error('Missing '+id);factories[id](require,m,m.exports);return m.exports;}
const R=require('react'),h=R.createElement,visuals=require('@/componentes/portal-visuals'),quick=require('@/componentes/quick-log'),params=new URL(location.href).searchParams;require('@/lib/appearance').applyAppearance(params.get('theme').startsWith('system')?'system':params.get('theme'));window.vv=new EventTarget();Object.assign(window.vv,{height:innerHeight,width:innerWidth,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:window.vv});window.keyboard=height=>{window.vv.height=height;window.vv.dispatchEvent(new Event('resize'));};window.requests=[];
const initial={id:'existing',type:'PROGRESS',title:'Bíceps',exerciseName:'Bíceps',exerciseKey:'biceps',metricType:'carga',sets:4,repetitions:8,currentValue:25,previousValue:null,unit:'kg',date:'2026-10-09',createdAt:'2026-10-09T12:00:00.000Z',content:'',category:'',durationMinutes:null,mood:'',hasPain:false,painDetails:'',achievements:[],photos:[]};window.logs=[initial];
window.fetch=async(url,options={})=>{const method=options.method||'GET';if(method==='GET'&&url.includes('/exercises'))return Response.json({options:[...window.logs.filter(x=>x.metricType==='carga').map(x=>({name:x.exerciseName,recent:true,lastUsedAt:x.createdAt,reference:{load:x.currentValue,unit:x.unit,sets:x.sets,repetitions:x.repetitions}})),...['Press banca','Sentadilla','Remo','Dominadas','Press militar'].map(name=>({name,recent:true,reference:null})),{name:'Rutina sin registro',recent:false}].filter((x,i,items)=>items.findIndex(item=>item.name===x.name)===i)});if(method==='GET')return Response.json({logs:window.logs});let body=options.body instanceof FormData?Object.fromEntries(options.body):JSON.parse(options.body);window.requests.push({url,method,body});if(method==='POST'){const log={...initial,...body,id:'new-'+window.requests.length,createdAt:new Date().toISOString(),photos:[]};for(const key of ['sets','repetitions','currentValue','previousValue','durationMinutes'])log[key]=body[key]?Number(body[key]):null;window.logs.unshift(log);return Response.json({});}if(method==='PATCH'){Object.assign(window.logs.find(x=>url.endsWith(x.id)),body);return Response.json({});}if(method==='DELETE'){window.logs=window.logs.filter(x=>!url.endsWith(x.id));return Response.json({});}throw Error('Unexpected request');};
const branding={displayName:'BM Training',logoMode:'DEFAULT',accentColor:params.get('accent')};window.root=require('react-dom/client').createRoot(document.getElementById('root'));window.root.render(h('div',{className:'workspace-brand',style:require('@/lib/workspace-branding').workspaceBrandingVariables(branding.accentColor)},h(visuals.PortalHeader,{studentName:'Alumno',branding}),h('main',{className:${JSON.stringify(mainClass)}},h('div',{className:'hidden md:block'},h(quick.QuickNoteButton,{placement:'inline'})),h(quick.QuickLogHistory,{startCreating:params.get('new')==='1'})),h('nav',{className:visuals.PORTAL_MOBILE_NAV_CLASS,'aria-label':'Navegación móvil del portal'},h('a',{href:'/portal'},'Inicio'),h(quick.QuickNoteButton,{placement:'navigation'}))));`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let cases = 0;
try {
  for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark', 'system-light', 'system-dark']) for (const accent of ['#D4A72C', '#2563eb']) {
    if(process.env.BM_SMOKE_LIMIT && cases >= Number(process.env.BM_SMOKE_LIMIT)) continue;
    const mobile = width < 768;
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile, colorScheme: theme.endsWith('light') ? 'light' : 'dark' });
    const page=await context.newPage();const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.route('https://quick.test/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bootstrap.replaceAll('</script', '<\\/script')}</script></body></html>` }));
    const origin=`https://quick.test/portal/registro?theme=${theme}&accent=${encodeURIComponent(accent)}`;
    await page.goto(origin);
    // The real + link carries creation intent; same-route clicks open without an intermediate screen.
    const plus=page.getByRole('link',{name:'Abrir registro rápido'});
    assert.equal(await plus.getAttribute('href'),'/portal/registro?new=1');
    await plus.click();
    await page.getByRole('heading',{name:'Ejercicio de fuerza',exact:true}).waitFor();
    const form=()=>page.locator('main form').first();
    const field=(name)=>form().getByLabel(name,{exact:true});
    const button=(name)=>form().getByRole('button',{name,exact:true});
    const geometry=async()=>assert.ok(await page.evaluate(expected=>document.documentElement.scrollWidth<=expected,width),`overflow ${width}/${theme}/${accent}`);
    await page.getByText('Recientes',{exact:true}).waitFor();
    if(process.env.BM_SMOKE_SCREENSHOT && cases===0) await page.screenshot({path:process.env.BM_SMOKE_SCREENSHOT,fullPage:true});
    assert.equal(await button('Rutina sin registro').count(),0);assert.equal(await button('Press militar').count(),0);
    assert.equal(await form().getByText('Esfuerzo',{exact:true}).count(),0);
    await button('Bíceps').click();assert.equal(await field('¿Qué ejercicio hiciste?').inputValue(),'Bíceps');
    await form().getByText('Última: 25 kg · 4 × 8',{exact:true}).waitFor();
    await field('Peso (kg)').fill('30');await field('Repeticiones').fill('10');await field('Series').fill('3');
    await button('Agregar más detalles').click();await form().getByLabel('Observación',{exact:true}).fill('Buena técnica');await button('Ocultar detalles').click();
    await geometry();
    const contrasts=await form().evaluate(element=>{
      const rgb=value=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
      const luminance=color=>rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      return [element.querySelector('input'),element.querySelector('button[type="submit"]')].map(e=>{const style=getComputedStyle(e),a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
    });
    assert.ok(contrasts.every(value=>value>=4.5),'input and primary button contrast');
    const nav=page.getByRole('navigation',{name:'Navegación móvil del portal'});
    if(mobile){
      const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
      await field('Peso (kg)').focus();await page.evaluate(()=>window.keyboard(480));await nav.waitFor({state:'hidden'});
      await page.setViewportSize({width,height:480});await button('Guardar').scrollIntoViewIfNeeded();
      assert.ok(await button('Guardar').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),'save reachable with keyboard');
      await page.setViewportSize({width,height:844});await page.evaluate(()=>window.keyboard(844));await field('Peso (kg)').blur();await nav.waitFor({state:'visible'});await cdp.detach();
    }
    await button('Guardar y agregar otro').click();
    await page.waitForFunction(()=>window.requests.filter(x=>x.method==='POST').length===1);
    await page.waitForFunction(()=>document.querySelector('main input[placeholder="Empezá a escribir"]')?.value==='');
    await button('Bíceps').click();await form().getByText('Última: 30 kg · 3 × 10',{exact:true}).waitFor();
    await field('¿Qué ejercicio hiciste?').fill('Flexiones nuevas');await field('Repeticiones').fill('8');await field('Series').fill('4');
    await button('Guardar').click();await page.getByRole('tab',{name:'Cronológico'}).waitFor();
    let requests=await page.evaluate(()=>window.requests);assert.equal(requests.length,2);assert.equal(requests[0].body.currentValue,'30');assert.equal(requests[1].body.currentValue,'');assert.notEqual(requests[0].body.idempotencyKey,requests[1].body.idempotencyKey);
    const open=async()=>{await page.getByRole('button',{name:'Nuevo registro',exact:true}).click();await page.getByRole('heading',{name:'Ejercicio de fuerza',exact:true}).waitFor();};
    const change=async name=>{await button('Otro tipo de registro').click();await button(name).click();assert.equal(await page.locator('main form').count(),1);};
    const save=async metric=>{await geometry();await button('Guardar').click();await page.getByRole('tab',{name:'Cronológico'}).waitFor();assert.equal(await page.evaluate(()=>window.requests.at(-1).body.metricType),metric);};
    await open();await change('Circuito / desafío');await field('Nombre del circuito o desafío').fill('Circuito tiempo');await field('Tiempo final').fill('12:45');await save('for_time');
    await open();await change('Circuito / desafío');await button('Vueltas').click();await field('Nombre del circuito').fill('Circuito vueltas');await field('Vueltas completadas').fill('5');await save('rounds');
    await open();await change('Circuito / desafío');await button('AMRAP / EMOM').click();await field('Nombre del circuito').fill('AMRAP');await field('Duración').fill('12');await field('Vueltas').fill('5');await save('amrap');
    await open();await change('Circuito / desafío');await button('AMRAP / EMOM').click();await button('EMOM').click();await field('Nombre del circuito').fill('EMOM');await field('Duración total (min)').fill('10');await field('Minutos completados').fill('10');await save('emom');
    await open();await change('Cardio');await field('Actividad').fill('Caminata');await field('Duración (min)').fill('35');await field('Distancia opcional (km)').fill('3.8');await save('cardio');
    await open();await change('Intervalos');await field('Actividad').fill('Bicicleta');await field('Rondas').fill('8');await field('Trabajo (s)').fill('30');await field('Descanso (s)').fill('30');await save('intervals');
    await open();await field('¿Qué ejercicio hiciste?').fill('Borrador conservado');await change('Nota libre');assert.equal(await form().locator('textarea').count(),1);assert.equal(await form().locator('input').count(),0);await change('Ejercicio de fuerza');assert.equal(await field('¿Qué ejercicio hiciste?').inputValue(),'Borrador conservado');await change('Nota libre');await field('¿Qué querés anotar?').fill('Hoy con energía');await save('free_note');
    assert.equal(await page.evaluate(()=>window.requests.filter(x=>x.method==='POST').length),9);
    await page.getByRole('tab',{name:'Por ejercicio'}).click();await page.getByRole('button',{name:'Ver historial'}).first().click();await page.getByRole('button',{name:'Editar',exact:true}).first().waitFor();await page.getByRole('tab',{name:'Cronológico'}).click();
    await page.locator('#registro-existing').getByRole('button',{name:'Editar',exact:true}).click();await page.getByLabel('Comentario',{exact:true}).fill('Registro editado');await page.getByRole('button',{name:'Guardar registro',exact:true}).click();await page.getByRole('status').filter({hasText:'Registro actualizado'}).waitFor();assert.equal(await page.evaluate(()=>window.requests.at(-1).method),'PATCH');
    page.once('dialog',d=>d.accept());await page.locator('#registro-existing').getByRole('button',{name:'Eliminar',exact:true}).click();await page.getByRole('status').filter({hasText:'Registro eliminado'}).waitFor();assert.equal(await page.evaluate(()=>window.requests.at(-1).method),'DELETE');
    await page.goto(origin+'&new=1');await page.getByRole('heading',{name:'Ejercicio de fuerza',exact:true}).waitFor();
    if(mobile){await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));assert.ok(await page.evaluate(()=>document.querySelector('main form footer').getBoundingClientRect().bottom<=document.querySelector('nav').getBoundingClientRect().top),'form footer clears bottom nav');}
    await geometry();assert.deepEqual(errors,[]);await context.close();cases++;console.log(`PASS ${width} ${theme} ${accent}`);
  }
  console.log(`${cases} combinations passed: direct strength, recent/reference, new/bodyweight/details, saves, circuit formats, cardio, intervals, note, edit/delete, keyboard, geometry, themes and accents. API fixtures; points covered separately by quick-log-points tests.`);
} finally { await browser.close(); }
