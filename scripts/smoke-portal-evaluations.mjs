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
const root=process.cwd(), temp=mkdtempSync(path.join(tmpdir(),'bm-evaluations-'));
writeFileSync(path.join(temp,'loader.cjs'),`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}`);
writeFileSync(path.join(temp,'link.jsx'),`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
writeFileSync(path.join(temp,'image.jsx'),`import React from 'react';export default function Image({priority,unoptimized,fill,...props}){return <img {...props}/>} `);
writeFileSync(path.join(temp,'entry.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PortalEvaluationsDashboard} from '@/componentes/portal-evaluations-dashboard';
import {PortalHeader,PortalNavigationLink,PORTAL_MOBILE_NAV_CLASS} from '@/componentes/portal-visuals';
import {BmHomeIcon,BmCalendarIcon,BmNutritionIcon,BmEvaluationIcon,BmPlusIcon,BmBellIcon} from '@/componentes/icons';
import {workspaceBrandingVariables,DEFAULT_WORKSPACE_BRANDING} from '@/lib/workspace-branding';
import {applyAppearance} from '@/lib/appearance';
const f=window.fixture;applyAppearance(f.theme.startsWith('system')?'system':f.theme);
const branding={...DEFAULT_WORKSPACE_BRANDING,accentColor:f.accent};
createRoot(document.getElementById('root')).render(<div className="workspace-brand" style={workspaceBrandingVariables(f.accent)}>
<PortalHeader branding={branding} studentName="Brian" actions={<button aria-label="Notificaciones"><BmBellIcon size={24}/></button>}/>
<main className="portal-nav-content mx-auto max-w-6xl p-2.5 pb-[calc(var(--portal-bottom-nav-height)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-clearance)+env(safe-area-inset-bottom))] sm:p-6 md:pb-12"><PortalEvaluationsDashboard evaluations={f.evaluations}/></main>
<nav aria-label="Navegación móvil del portal" className={PORTAL_MOBILE_NAV_CLASS} style={{gridTemplateColumns:'repeat(5,minmax(0,1fr))'}}><PortalNavigationLink title="Inicio" href="/portal" Icon={BmHomeIcon} active={false}/><PortalNavigationLink title="Clases" href="/portal/clases" Icon={BmCalendarIcon} active={false}/><button aria-label="Registro rápido"><BmPlusIcon size={24}/></button><PortalNavigationLink title="Nutrición" href="/portal/nutricion" Icon={BmNutritionIcon} active={false}/><PortalNavigationLink title="Evaluación" href="/portal/evaluaciones" Icon={BmEvaluationIcon} active/></nav></div>);
`);
await new Promise((resolve,reject)=>webpack({mode:'production',entry:path.join(temp,'entry.tsx'),output:{path:temp,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(root,'node_modules')],alias:{'@':root,'next/link':path.join(temp,'link.jsx'),'next/image':path.join(temp,'image.jsx')}},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(temp,'loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
const css=readdirSync('.next/static/chunks').filter(x=>x.endsWith('.css')).map(x=>readFileSync(path.join('.next/static/chunks',x),'utf8')).join('\n');
const bundle=readFileSync(path.join(temp,'bundle.js'));
console.log(`Visuals: ${temp}`);
const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle)}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css)}else if(req.url.startsWith('/avatars/')||req.url.startsWith('/bm-training-')){try{res.end(readFileSync(path.join(root,'public',decodeURI(req.url))))}catch{res.writeHead(404).end()}}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const empty={id:'old',studentId:'student',studentName:'Brian',date:'2026-09-07',version:1,status:'COMPLETED',completionPercentage:63,primaryGoal:'Fuerza',secondaryGoals:[],experienceLevel:'',weeklyAvailability:'',reassessmentDate:'',weight:70.4,bmi:25.5,height:1.66,age:30,bodyFatPercentage:25.5,muscleMass:null,visceralFat:null,waist:80,hip:null,chest:null,rightArm:null,leftArm:null,rightThigh:null,leftThigh:null,rightCalf:null,leftCalf:null,activities:'',bodyIssues:[],testResults:[],createdAt:'',source:'PHYSICAL'};
const test={id:'test',testKey:'FRONT_PLANK',category:'PHYSICAL',status:'GOOD',numericValue:45,unit:'s',rightValue:null,leftValue:null,rightUnit:'',leftUnit:'',pain:false,rightPain:false,leftPain:false,protocol:'',variation:'',observations:'',compensations:'',notPerformedReason:'',rawResult:{}};
const newer={...empty,id:'new',version:2,date:'2026-10-07',weight:68.9,waist:78,bodyFatPercentage:24,testResults:[test],bodyIssues:[{id:'issue',bodyZone:'Rodilla derecha',side:'RIGHT',intensity:3,hasPain:true,status:'ACTIVE',studentDescription:'Molestia al subir escalones',trainerObservation:'',approximateDate:''}]};
const browser=await chromium.launch({channel:'msedge',headless:true});let cases=0;
try{
for(const width of [320,390,1280])for(const theme of ['light','dark','system-light','system-dark'])for(const accent of ['#D4A72C','#2563eb']){
const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<768,isMobile:width<768,colorScheme:theme.endsWith('light')?'light':'dark'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(f=>{window.fixture=f},{theme,accent,evaluations:[empty]});
const load=async evaluations=>{await context.addInitScript(data=>{window.fixture.evaluations=data},evaluations);await page.goto(origin);await page.locator('.portal-evaluation').waitFor();};
const geometry=async()=>assert.ok(await page.evaluate(expected=>document.documentElement.scrollWidth<=expected, width),'No horizontal overflow beyond viewport');
await page.goto(origin);await page.getByText('Tu última evaluación',{exact:true}).waitFor();
assert.equal(await page.locator('select,.evaluation-picker').count(),0);
assert.equal(await page.getByText('63%',{exact:true}).count(),0);
await page.getByText('Sin fecha programada',{exact:true}).waitFor();
assert.equal(await page.locator('.evaluation-area-unavailable').count(),5);
await page.getByRole('button',{name:'Ver evaluación versión 1',exact:true}).click();
await page.getByRole('heading',{name:'Evaluación del 7/9/2026',exact:true}).waitFor();
assert.equal(await page.locator('[data-evaluation-id]').getAttribute('data-evaluation-id'),'old');
await page.getByText('80 cm',{exact:true}).waitFor();assert.equal(await page.locator('.evaluation-area').count(),0);await geometry();
await page.getByRole('button',{name:'Volver al historial',exact:true}).click();await page.getByText('Tu última evaluación',{exact:true}).waitFor();
await load([empty,newer]);await page.getByText('Tu última evaluación',{exact:true}).waitFor();
assert.equal(await page.locator('.evaluation-history time').first().textContent(),'7/10/2026');
await page.locator('.evaluation-picker summary').first().click();await page.getByRole('button',{name:'Cintura',exact:true}).click();
assert.match(await page.locator('.evaluation-before-after').first().textContent(),/80 cm.*78 cm/);
await page.locator('.evaluation-picker summary').first().click();await page.locator('.evaluation-picker summary').first().press('Escape');assert.equal(await page.locator('.evaluation-picker').first().getAttribute('open'),null);
await page.locator('.evaluation-area summary').filter({hasText:'Mapa corporal'}).click();await page.getByText('Molestia al subir escalones',{exact:true}).waitFor();await geometry();
await page.locator('.evaluation-area summary').filter({hasText:'Tests físicos'}).click();await page.getByText('45 s',{exact:true}).waitFor();
assert.equal(await page.locator('.evaluation-area-content article').count(),2);
await page.locator('.evaluation-area summary').filter({hasText:'Resumen de resultados'}).click();assert.match(await page.locator('.evaluation-area-content').last().textContent(),/Correctos: 1/);
await page.getByRole('button',{name:'Ver evaluación versión 1',exact:true}).click();await page.getByRole('heading',{name:'Evaluación del 7/9/2026',exact:true}).waitFor();assert.equal(await page.locator('.evaluation-area').count(),0);await page.getByText('70,4 kg',{exact:true}).waitFor();
await page.getByRole('button',{name:'Volver al historial',exact:true}).click();
await page.getByRole('button',{name:'Ver evaluación versión 2',exact:true}).click();await page.getByRole('heading',{name:'Evaluación del 7/10/2026',exact:true}).waitFor();await page.locator('.evaluation-metrics').getByText('68,9 kg',{exact:true}).waitFor();
await page.locator('.evaluation-area summary').filter({hasText:'Resumen de resultados'}).click();await geometry();
await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));if(width<768){const bottom=await page.locator('.evaluation-area').last().boundingBox(),nav=await page.locator('.portal-mobile-nav').boundingBox();assert.ok(bottom.y+bottom.height<=nav.y+1,'Detail clears bottom navigation');}
if(width===390&&(theme==='light'||theme==='dark')&&accent==='#D4A72C'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(temp,`detail-${theme}.png`),fullPage:true});}
await page.getByRole('button',{name:'Volver al historial',exact:true}).click();
await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));if(width<768){const bottom=await page.locator('.evaluation-history').boundingBox(),nav=await page.locator('.portal-mobile-nav').boundingBox();assert.ok(bottom.y+bottom.height<=nav.y+1,'History clears bottom navigation');}
if(width===390&&(theme==='light'||theme==='dark')&&accent==='#D4A72C'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(temp,`home-${theme}.png`),fullPage:true});}
const appearance=await page.evaluate(()=>{
 const surface=getComputedStyle(document.querySelector('.evaluation-section')).backgroundColor, muted=getComputedStyle(document.querySelector('.evaluation-history small')).color;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=canvas.height=1;
 const lum=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0)};
 const a=lum(surface),b=lum(muted);return {contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),accent:getComputedStyle(document.querySelector('.workspace-brand')).getPropertyValue('--bm-accent').trim()};
});assert.ok(appearance.contrast>=4.5,'Secondary text contrast');assert.equal(appearance.accent.toLowerCase(),accent.toLowerCase());
await load([{...empty,weight:null,bmi:null,waist:null,bodyFatPercentage:null},newer]);assert.equal(await page.locator('.evaluation-picker').count(),0);await geometry();
await load([]);await page.getByRole('heading',{name:'Todavía no registramos una evaluación física'}).waitFor();await geometry();
assert.deepEqual(errors,[]);cases++;console.log(`${width}px ${theme} ${accent}: empty/one/multiple, history, details, selector, areas and navigation OK`);await context.close();
}
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(`${cases} combinations passed. Visuals: ${temp}`);
