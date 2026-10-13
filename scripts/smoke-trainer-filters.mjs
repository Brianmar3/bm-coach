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
const root=process.cwd(), temp=mkdtempSync(path.join(tmpdir(),'bm-trainer-filters-'));
writeFileSync(path.join(temp,'loader.cjs'),`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}`);
writeFileSync(path.join(temp,'link.jsx'),`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
writeFileSync(path.join(temp,'image.jsx'),`import React from 'react';export default function Image({priority,unoptimized,fill,...props}){return <img {...props}/>} `);
writeFileSync(path.join(temp,'entry.tsx'),"import React from 'react';import {createRoot} from 'react-dom/client';import Students from '@/app/alumnos/page';import Payments from '@/app/pagos/page';import Evaluations from '@/app/evaluaciones/page';import Monthly from '@/app/resumen-mensual/page';import {workspaceBrandingVariables} from '@/lib/workspace-branding';import {applyAppearance} from '@/lib/appearance';const f=window.fixture;const Page={students:Students,payments:Payments,evaluations:Evaluations,monthly:Monthly}[f.page];window.applyTestAppearance=applyAppearance;window.testBranding=workspaceBrandingVariables;applyAppearance(f.theme);createRoot(document.getElementById('root')).render(<div className=\"workspace-brand admin-panel\" style={workspaceBrandingVariables(f.accent)}><Page/></div>);");
writeFileSync(path.join(temp,'crypto.js'), 'export function createHash(){throw new Error("Server hashing is not part of this UI smoke")}');
await new Promise((resolve,reject)=>webpack({plugins:[new webpack.NormalModuleReplacementPlugin(/^node:crypto$/,path.join(temp,'crypto.js'))],mode:'production',entry:path.join(temp,'entry.tsx'),output:{path:temp,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(root,'node_modules')],alias:{'@':root,'next/link':path.join(temp,'link.jsx'),'next/image':path.join(temp,'image.jsx')}},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(temp,'loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
const css=readdirSync('.next/static/chunks').filter(x=>x.endsWith('.css')).map(x=>readFileSync(path.join('.next/static/chunks',x),'utf8')).join('\n');
const bundle=readFileSync(path.join(temp,'bundle.js'));
console.log(`Visuals: ${temp}`);
const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle)}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css)}else if(req.url.startsWith('/avatars/')||req.url.startsWith('/bm-training-')){try{res.end(readFileSync(path.join(root,'public',decodeURI(req.url))))}catch{res.writeHead(404).end()}}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const output=path.join(root,'docs','visuals','trainer-filters');require('node:fs').mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
const students=['Ana','Bruno'].map((name,i)=>({id:String(i+1),firstName:name,lastName:'Prueba',phone:'3404000000',email:'',birthDate:'1995-01-01',weight:70,height:170,studentType:'Adulto',plan:'Mensual',monthlyFee:30000,status:i?'inactivo':'activo',serviceType:i?'PERSONALIZED':'CLASSES',dueDate:'2026-11-01',scheduleIds:[],scheduleLabels:[],goal:'Fuerza',studentStatus:i?'INACTIVE':'ACTIVE',schedules:[{id:'g1',label:'Lunes 07:00'}]}));
const payments={asOf:'2026-10-13',summary:{collectedThisMonth:30000,overdueCount:1,dueSoonCount:0,currentCount:1,noPaymentCount:0,unconfiguredCount:0,estimatedOutstanding:30000},students:students.map((s,i)=>({studentId:s.id,student:s.firstName+' Prueba',plan:s.plan,monthlyFee:s.monthlyFee,phone:s.phone,paymentCount:1,paidThisMonth:!i,lastPaymentDate:'2026-10-01',lastPaymentAmount:30000,nextDueDate:'2026-11-01',status:i?'VENCIDA':'AL_DIA'}))};
const monthly={metadata:{year:2026,month:10,monthKey:'2026-10',label:'Octubre 2026',timeZone:'America/Argentina/Buenos_Aires',generatedAt:'2026-10-13T12:00:00Z',status:'DRAFT',historicalPartial:false,closedAt:null},summary:{collectedTotal:30000,paymentCount:1,expectedTotal:60000,pendingTotal:30000,collectionPercentage:50,studentsWithActivity:2,enrollments:0,deactivations:0,attendancePercentage:100},finances:{paidObligations:1,partialObligations:0,pendingObligations:1,voidedPaymentCount:0},attendance:{present:2,absent:0,justified:0,totalRecords:2,percentageFormula:'Presentes / total'},activity:{evaluations:0,completedWorkoutSessions:0,registeredWorkoutSessions:0},expenses:{operatingResult:null,message:'Sin gastos'},weeklyCollections:[],reconciliation:null,dataReview:{membershipsWithoutAmount:[],activityWithoutObligation:[],missingObligationCauses:[]},warnings:[],detailRows:students.map((s,i)=>({studentId:s.id,studentName:s.firstName+' Prueba',collectedAmount:i?0:30000,expectedAmount:30000,balance:i?30000:0,paymentStatus:i?'Pendiente':'Pagado',paymentDates:[],paymentMethods:[],attendancePresent:1,attendanceAbsent:0,attendanceJustified:0,planName:'Mensual',serviceType:s.serviceType,frequencyDays:2,joinedAt:'2026-01-01',deactivatedAt:null,warnings:[]}))};
try {
 for(const width of (process.env.BM_FILTER_WIDTHS ? process.env.BM_FILTER_WIDTHS.split(",").map(Number) : [320,360,390,430,768,1280]))for(const theme of ['dark','light','system'])for(const accent of ['#D4A72C','#2563eb'])for(const sectionName of ['students','payments','evaluations','monthly']) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:'dark',reducedMotion:'reduce'});
  await context.addInitScript(f=>window.fixture=f,{theme,accent,page:sectionName});
  const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',error=>{errors.push(error.message);console.log(error.stack)});
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url());requests.push(url.pathname+url.search);let body=[];
   if(url.pathname==='/api/admin/auth/session')body={authenticated:true,userId:'coach',workspaceId:'workspace'};
   else if(url.pathname==='/api/admin/account-deletion')body={requests:[]};
   else if(url.pathname==='/api/alumnos/invitaciones')body={invitations:[]};
   else if(url.pathname==='/api/alumnos')body=students;
   else if(url.pathname==='/api/alumnos/opciones')body={plans:[],schedules:[]};
   else if(url.pathname==='/api/pagos')body=payments;
   else if(url.pathname==='/api/admin/evaluaciones/progreso')body={students,evaluations:[]};
   else if(url.pathname==='/api/resumen-mensual')body={...monthly,metadata:{...monthly.metadata,year:Number(url.searchParams.get('year')),month:Number(url.searchParams.get('month'))}};
   return route.fulfill({json:body});
  });
  await page.goto(origin);const nameLocator=name=>sectionName==='students'?page.locator('#student-results').locator(width>=768?'tbody tr':'article').filter({hasText:name}):sectionName==='monthly'&&width>=768?page.locator('[aria-label="Detalle por alumno"] tbody tr').filter({hasText:name}):page.getByText(name,{exact:true}).filter({visible:true});const filters=page.locator('.trainer-filters');await filters.waitFor();await filters.scrollIntoViewIfNeeded();const search=filters.locator('input').first(),toggle=filters.getByRole('button',{name:/^Filtros/}),panel=filters.locator('.trainer-filter-panel');
  if(width<=768){assert.equal(await panel.isVisible(),false);assert.equal(await toggle.isVisible(),true);assert.ok((await search.boundingBox()).width>=(await filters.locator('.trainer-filter-search').boundingBox()).width-60);assert.ok(Math.abs((await filters.locator('.trainer-filter-search').boundingBox()).width-((await filters.boundingBox()).width-24))<2);await toggle.click();assert.equal(await panel.isVisible(),true);await toggle.click();assert.equal(await panel.isVisible(),false);await toggle.click()}
  else {assert.equal(await toggle.isVisible(),false);assert.equal(await panel.isVisible(),true)}
  const selects=panel.locator('select');await selects.first().selectOption({index:1});if(await selects.count()>1)await selects.nth(1).selectOption({index:1});
  if(width<=768)assert.match(await toggle.innerText(),/Filtros · [1-9]/);
  const excluded=sectionName==='payments'?'Ana Prueba':'Bruno Prueba';const included=sectionName==='payments'?'Bruno Prueba':'Ana Prueba';await nameLocator(included).first().waitFor();await nameLocator(excluded).first().waitFor({state:'hidden'});
  if(theme==='dark'&&accent==='#2563eb'){await page.screenshot({path:path.join(output,`${sectionName}-${width}-open.png`)});}
  await panel.getByRole('button',{name:'Limpiar filtros',exact:true}).click();assert.equal(await panel.getByRole('button',{name:'Limpiar filtros',exact:true}).isDisabled(),true);
  if(width<=768){assert.equal(await toggle.innerText(),'Filtros');await toggle.click()}
  await search.fill('Ana');await nameLocator('Ana Prueba').first().waitFor();
  await search.fill('zzzz-no-match');await nameLocator('Ana Prueba').first().waitFor({state:'hidden'});assert.equal(await nameLocator('Ana Prueba').count(),0);await search.fill('');await nameLocator('Ana Prueba').first().waitFor();
  assert.equal(await filters.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'filter overflow');if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)){console.log(sectionName,await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,16).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,text:el.textContent.slice(0,100)}))));await page.screenshot({path:path.join(output,'overflow.png')});}assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page overflow');
  if(theme==='dark'&&accent==='#2563eb'||width===390&&theme==='light'&&accent==='#D4A72C')await page.screenshot({path:path.join(output,`${sectionName}-${width}-${theme}-closed.png`)});
  if(sectionName==='monthly'){const month=await page.getByRole('combobox',{name:'Mes',exact:true}).inputValue();await Promise.all([page.waitForResponse(response=>response.url().includes('/api/resumen-mensual')),page.getByRole('button',{name:'Mes siguiente →',exact:true}).click()]);await page.waitForFunction(old=>document.querySelector('select[aria-label="Mes"]').value!==old,month);assert.ok(requests.filter(url=>url.startsWith('/api/resumen-mensual')).length>=2);assert.equal(await page.getByText('Exportar',{exact:false}).first().count(),1)}
  assert.deepEqual(errors,[]);results.push({width,theme,accent,sectionName,passed:true});console.log(`${width} ${theme} ${accent} ${sectionName} PASS`);await context.close();
 }
 writeFileSync(path.join(output,'validation.json'),JSON.stringify({scenarios:results.length,results},null,2));console.log(`${results.length} trainer filter scenarios passed`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
