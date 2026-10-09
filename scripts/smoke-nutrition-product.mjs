// Real React components and compiled app CSS, synthetic HTTP responses only.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {webpack}=require('next/dist/compiled/webpack/webpack');
const {chromium}=createRequire(path.join(process.env.BM_TEST_NODE_MODULES,'playwright/package.json'))('playwright');
const root=process.cwd(), temp=mkdtempSync(path.join(tmpdir(),'bm-nutrition-'));
writeFileSync(path.join(temp,'loader.cjs'),`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}`);
writeFileSync(path.join(temp,'link.jsx'),`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
writeFileSync(path.join(temp,'image.jsx'),`import React from 'react';export default function Image({priority,unoptimized,fill,...props}){return <img {...props}/>} `);
writeFileSync(path.join(temp,'entry.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {StudentNutrition} from '@/componentes/student-nutrition';import {NutritionWorkspace} from '@/componentes/nutrition-workspace';
import {PortalHeader,PortalNavigationLink,PORTAL_MOBILE_NAV_CLASS} from '@/componentes/portal-visuals';
import {BmHomeIcon,BmCalendarIcon,BmNutritionIcon,BmEvaluationIcon,BmPlusIcon,BmBellIcon} from '@/componentes/icons';
import {workspaceBrandingVariables,DEFAULT_WORKSPACE_BRANDING} from '@/lib/workspace-branding';
import {applyAppearance} from '@/lib/appearance';
const f=window.fixture;applyAppearance(f.theme.startsWith('system')?'system':f.theme);
const branding={...DEFAULT_WORKSPACE_BRANDING,accentColor:f.accent};
createRoot(document.getElementById('root')).render(<div className="workspace-brand" style={workspaceBrandingVariables(f.accent)}>
<PortalHeader branding={branding} studentName="Brian" actions={<button aria-label="Notificaciones"><BmBellIcon size={24}/></button>}/>
<main className="portal-nav-content mx-auto max-w-6xl p-2.5 pb-[calc(var(--portal-bottom-nav-height)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-clearance)+env(safe-area-inset-bottom))] sm:p-6 md:pb-12">{f.view==='preferences'?<NutritionWorkspace slug={['preferencias']}/>:<StudentNutrition/>}</main>
<nav aria-label="Navegación móvil del portal" className={PORTAL_MOBILE_NAV_CLASS} style={{gridTemplateColumns:'repeat(5,minmax(0,1fr))'}}><PortalNavigationLink title="Inicio" href="/portal" Icon={BmHomeIcon} active={false}/><PortalNavigationLink title="Clases" href="/portal/clases" Icon={BmCalendarIcon} active={false}/><button aria-label="Registro rápido"><BmPlusIcon size={24}/></button><PortalNavigationLink title="Nutrición" href="/portal/nutricion" Icon={BmNutritionIcon} active/><PortalNavigationLink title="Evaluación" href="/portal/evaluaciones" Icon={BmEvaluationIcon} active={false}/></nav></div>);
`);
await new Promise((resolve,reject)=>webpack({mode:'production',entry:path.join(temp,'entry.tsx'),output:{path:temp,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(root,'node_modules')],alias:{'@':root,'next/link':path.join(temp,'link.jsx'),'next/image':path.join(temp,'image.jsx')}},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(temp,'loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
const css=readdirSync('.next/static/chunks').filter(x=>x.endsWith('.css')).map(x=>readFileSync(path.join('.next/static/chunks',x),'utf8')).join('\n');
const bundle=readFileSync(path.join(temp,'bundle.js'));
console.log(`Visuals: ${temp}`);
const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle)}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css)}else if(req.url.startsWith('/avatars/')||req.url.startsWith('/bm-training-')){try{res.end(readFileSync(path.join(root,'public',decodeURI(req.url))))}catch{res.writeHead(404).end()}}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const profile={dietaryType:'Omnívora',allergies:['maní'],intolerances:[],restrictions:[],preferredFoods:['arroz'],dislikedFoods:['cebolla'],budgetPreference:'Económico',cookingTimeMinutes:30,cookingLevel:'Inicial',equipment:['horno'],servings:1,usualMealTimes:{},repetitionPreference:'Moderada',varietyPreference:'Equilibrada',locale:'es-AR',consentAt:'2026-10-01',personalizationEnabled:true,notificationPreferences:{habitReminder:true,weeklyPlanning:true,activeList:true,newEvaluation:true},updatedAt:'2026-10-01'};
const keys=['hydration','protein','fruitsVegetables','mealOrganization','energy'];
const browser=await chromium.launch({channel:'msedge',headless:true});let cases=0;
try{
for(const width of [320,390,1280])for(const theme of ['light','dark','system-light','system-dark'])for(const accent of ['#D4A72C','#2563eb']){
const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<768,isMobile:width<768,colorScheme:theme.endsWith('light')?'light':'dark'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let state=0,checkin=null,savedProfile=structuredClone(profile),calls=[];
await context.addInitScript(f=>{window.fixture={...f,view:location.pathname.includes('preferencias')?'preferences':'home'}},{theme,accent});
await context.route('**/api/portal/nutrition**',async route=>{
const req=route.request(),url=new URL(req.url()),method=req.method(),body=req.postDataJSON();calls.push({path:url.pathname,method,body});
if(url.pathname.endsWith('/consent')){savedProfile.personalizationEnabled=method==='PUT';return route.fulfill({json:{message:'OK'}})}
if(url.pathname.endsWith('/profile')){if(method==='PUT')savedProfile=body;return route.fulfill({json:{profile:savedProfile}})}
if(url.pathname.endsWith('/context'))return route.fulfill({json:{context:{student:{objective:'Mejorar hábitos'},evaluation:state?{date:'2026-10-02'}:null,training:{routineName:null,scheduledClasses:[],recentAttendances:0},habits:{daysRegistered:state?3:0}}}});
if(method==='PUT'){checkin={...body};return route.fulfill({json:{message:'Hábitos guardados.'}})}
return route.fulfill({json:{studentName:'Brian',objective:'Mejorar hábitos',contextStatus:state?'FULL':'LIMITED',profile:savedProfile,evaluation:state?{date:'2026-10-02'}:null,evaluationUpdated:true,recommendation:{title:'Una decisión simple para hoy',message:'Dejá resuelta una opción sencilla para cerrar el día y facilitar la organización de mañana.',href:'/portal/nutricion/plan',action:'Organizar comida'},todayCheckin:checkin,summary:{daysRegistered:state?3:0,compliancePercentage:state===2?100:40,strongestHabit:null,habitToImprove:'Energía durante el día'},trainerNote:state?{text:'Organizá tus comidas según lo que trabajamos en la última sesión. Revisá tus preferencias antes de armar la lista.'}:null,recentRecipes:state?[{id:'recipe-a',title:'Ensalada de arroz con verduras y pollo para llevar al trabajo',preparationMinutes:20}]:[]}});
});
const geometry=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');assert.equal(await page.locator('.nutrition-home .truncate').count(),0);};
for(state=0;state<3;state++){
checkin=state?Object.fromEntries(keys.map((k,i)=>[k,state===2||i<2])):null;savedProfile.personalizationEnabled=state>0;
await page.goto(origin);await page.getByRole('heading',{name:'Hábitos de hoy',exact:true}).waitFor();await geometry();
assert.equal(await page.locator('.nutrition-habit input:checked').count(),state===2?5:state?2:0);
assert.deepEqual(await page.locator('.nutrition-tools a').evaluateAll(items=>items.map(x=>x.getAttribute('href'))),['/portal/nutricion/compras','/portal/nutricion/despensa','/portal/nutricion/recetas','/portal/nutricion/aprender']);
const appearance=await page.evaluate(()=>{
 const surface=getComputedStyle(document.querySelector('.nutrition-habits')).backgroundColor,muted=getComputedStyle(document.querySelector('.nutrition-habit-summary')).color,button=getComputedStyle(document.querySelector('.nutrition-primary-action'));
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=canvas.height=1;
 const luminance=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0)};
 const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 return {surface,mutedContrast:contrast(muted,surface),buttonContrast:contrast(button.color,button.backgroundColor),accent:button.backgroundColor,theme:document.documentElement.dataset.theme};
});
assert.equal(appearance.theme,theme.endsWith('light')?'light':'dark');assert.equal(appearance.surface,theme.endsWith('light')?'rgb(255, 254, 250)':'rgb(21, 21, 23)');assert.ok(appearance.mutedContrast>=4.5,JSON.stringify(appearance));assert.ok(appearance.buttonContrast>=4.5,JSON.stringify(appearance));assert.equal(appearance.accent,accent==='#2563eb'?'rgb(37, 99, 235)':'rgb(212, 167, 44)');
for(const habit of await page.locator('.nutrition-habit').all())assert.ok((await habit.boundingBox()).height>=44);
if(state===1){await page.locator('.nutrition-habit').filter({hasText:'Hidratación'}).click();assert.equal(await page.getByLabel('Hidratación',{exact:true}).isChecked(),false);await page.getByText('Agregar comentario opcional',{exact:true}).click();await page.getByLabel('Comentario opcional',{exact:true}).fill('Registro de prueba');await page.getByRole('button',{name:'Actualizar hábitos',exact:true}).click();await page.getByRole('status').waitFor();const put=calls.filter(x=>x.path==='/api/portal/nutrition'&&x.method==='PUT').at(-1);assert.equal(put.body.hydration,false);assert.equal(put.body.comment,'Registro de prueba');}
if(state===0){await page.getByRole('button',{name:'Aceptar y activar',exact:true}).click();await page.getByRole('status').waitFor();assert.equal(calls.filter(x=>x.path.endsWith('/consent')).at(-1).method,'PUT');}
if(state===2&&theme==='dark'&&accent==='#D4A72C')await page.screenshot({path:path.join(temp,`home-${width}.png`),fullPage:true});
}
await page.goto(origin+'/portal/nutricion/preferencias');await page.getByRole('heading',{name:'Preferencias alimentarias'}).waitFor();await geometry();
await page.getByText('Gustos y preferencias',{exact:true}).click();assert.equal(await page.getByLabel('Alimentos preferidos',{exact:true}).inputValue(),'arroz');
await page.getByRole('combobox',{name:'Tipo de alimentación',exact:true}).selectOption('Vegetariana');await page.getByLabel('Porciones habituales',{exact:true}).fill('2');await page.getByLabel('Hábito del día',{exact:true}).uncheck();
const save=page.getByRole('button',{name:'Guardar preferencias',exact:true});await save.scrollIntoViewIfNeeded();
if(width<768){const box=await save.boundingBox(),nav=await page.locator('.portal-mobile-nav').boundingBox();assert.ok(box.y+box.height<=nav.y,'Save above navigation');}
await save.click();await page.getByText('Preferencias actualizadas.',{exact:true}).waitFor();assert.equal(savedProfile.dietaryType,'Vegetariana');assert.equal(savedProfile.servings,2);assert.equal(savedProfile.notificationPreferences.habitReminder,false);assert.deepEqual(savedProfile.allergies,['maní']);assert.deepEqual(savedProfile.preferredFoods,['arroz']);
await page.getByRole('button',{name:'Revocar consentimiento',exact:true}).click();await page.getByText('Personalización desactivada.',{exact:true}).waitFor();assert.equal(calls.filter(x=>x.path.endsWith('/consent')).at(-1).method,'DELETE');
await page.getByRole('button',{name:'Aceptar y activar IA personalizada',exact:true}).click();await page.getByText('Personalización activada.',{exact:true}).waitFor();assert.equal(calls.filter(x=>x.path.endsWith('/consent')).at(-1).method,'PUT');
if(width<768){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await page.getByLabel('Equipamiento disponible',{exact:true}).focus();await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:480});visualViewport.dispatchEvent(new Event('resize'))});await page.waitForFunction(()=>document.documentElement.dataset.portalKeyboard==='open');assert.equal(await page.locator('.portal-mobile-nav').isVisible(),false);await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));document.activeElement.blur()});await page.waitForFunction(()=>!document.documentElement.dataset.portalKeyboard);await cdp.detach();}
await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));const end=page.locator('.nutrition-data > p');if(width<768){const box=await end.boundingBox(),nav=await page.locator('.portal-mobile-nav').boundingBox();assert.ok(box.y+box.height<=nav.y,'Last content above navigation');}
if((theme==='light'||theme==='dark')&&accent==='#D4A72C')await page.screenshot({path:path.join(temp,`preferences-${theme}-${width}.png`),fullPage:true});
savedProfile={...profile,dietaryType:'',budgetPreference:'',cookingTimeMinutes:null,cookingLevel:'',allergies:[],intolerances:[],restrictions:[],preferredFoods:[],dislikedFoods:[],equipment:[],repetitionPreference:'',varietyPreference:'',updatedAt:null,personalizationEnabled:false};
await page.goto(origin+'/portal/nutricion/preferencias');await page.getByRole('heading',{name:'Preferencias alimentarias'}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Tipo de alimentación',exact:true}).inputValue(),'');assert.equal(await page.getByRole('button',{name:'Eliminar preferencias',exact:true}).count(),0);await geometry();
assert.deepEqual(errors,[]);console.log(`${width}px ${theme} ${accent}: 3 home states, habits, preferences, consent, keyboard and clearance OK`);cases++;await context.close();
}
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(`${cases} combinations passed. Visuals: ${temp}`);
