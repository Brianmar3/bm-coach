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
const root=process.cwd(), temp=mkdtempSync(path.join(tmpdir(),'bm-routine-review-'));
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
const output=path.join(root,'docs','visuals','routine-review');require('node:fs').mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try {
 for(const width of [320,390,768,1280,1440])for(const theme of ['dark','light','system-dark','system-light'])for(const accent of ['#D4A72C','#2563eb']) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme.endsWith('light')?'light':'dark',reducedMotion:'reduce'});
  await context.addInitScript(({theme,accent})=>{window.fixture={theme:theme.startsWith('system')?'system':theme,accent}},{theme,accent});
  const page=await context.newPage(),errors=[],saves=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url()),method=route.request().method();let body=[];
   if(url.pathname==='/api/admin/auth/session')body={authenticated:true,userId:'coach',workspaceId:'workspace'};
   else if(url.pathname==='/api/rutinas'&&method==='GET')body=[];
   else if(url.pathname.startsWith('/api/rutinas')&&(method==='POST'||method==='PUT')) {
    const input=route.request().postDataJSON();saves.push(input);await new Promise(resolve=>setTimeout(resolve,150));body={...input,id:'routine',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),students:[],historicalStudents:[],days:input.days.map((day,i)=>({...day,id:'day-'+i,exercises:[]}))};
   }
   else if(url.pathname==='/api/training-library/blocks')body=[];
   else if(url.pathname==='/api/exercise-library')body={total:0,items:[],facets:{bodyParts:[],equipment:[],targets:[]},mediaEnabled:false};
   return route.fulfill({json:body});
  });
  await page.goto(origin);
  await page.getByRole('button',{name:'Nueva rutina',exact:true}).first().click();await page.getByRole('button',{name:/Desde cero/}).click();await page.getByLabel('Nombre',{exact:true}).fill('Rutina 3 días');await page.getByLabel('Cantidad de días').selectOption('3');await page.getByRole('button',{name:'Crear y empezar a armar',exact:true}).click();
  await page.locator('.routine-block-adder summary').click();await page.getByRole('button',{name:'Fuerza',exact:true}).click();
  await page.getByRole('button',{name:'Ejercicio propio',exact:true}).click();await page.getByRole('button',{name:'Ejercicio propio',exact:true}).click();
  await page.locator('.routine-exercise-quick').nth(0).getByLabel('Ejercicio',{exact:true}).fill('Press de banca');await page.locator('.routine-exercise-quick').nth(1).getByLabel('Ejercicio',{exact:true}).fill('Press inclinado');
  await page.locator('.routine-workspace-days button').filter({hasText:/Día 2/}).click();
  await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();
  let modal=page.getByRole('dialog',{name:'Revisión de la rutina',exact:true});await modal.waitFor();
  assert.equal(await modal.getByRole('button',{name:'Activar rutina',exact:true}).isDisabled(),true);
  assert.equal(await modal.locator('[data-severity=error]').count(),2);assert.equal(await modal.locator('[data-severity=warning]').count(),2);
  assert.ok((await modal.innerText()).includes('2 errores por corregir'));
  const box=await modal.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=900);
  assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  if(theme==='dark'&&accent==='#2563eb')await page.screenshot({path:path.join(output,width+'-errors.png')});
  if(width===390&&theme==='light'&&accent==='#D4A72C')await page.screenshot({path:path.join(output,'390-light-errors.png')});
  if(width===320&&theme==='dark'&&accent==='#2563eb') {
   await page.keyboard.press('Escape');await page.locator('.routine-workspace-days button').filter({hasText:/Día 1/}).click();
   for(let i=0;i<10;i++)await page.getByRole('button',{name:'Ejercicio propio',exact:true}).click();
   await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();modal=page.getByRole('dialog',{name:'Revisión de la rutina',exact:true});
   assert.ok(await modal.locator('.routine-review-list').evaluate(el=>el.scrollHeight>el.clientHeight),'many errors scroll internally');
   const box=await modal.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=900);await page.screenshot({path:path.join(output,'320-many-errors.png')});
   await page.keyboard.press('Escape');
   for(let i=0;i<10;i++){const row=page.locator('.routine-exercise-row').last();await row.locator('.routine-exercise-actions summary').click();await row.locator('.routine-exercise-actions').getByRole('button',{name:/Eliminar ejercicio/}).click()}
   await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();modal=page.getByRole('dialog',{name:'Revisión de la rutina',exact:true});
  }
  await modal.locator('[data-severity=error]').first().press('Enter');await modal.waitFor({state:'detached'});
  const target=page.locator('[data-validation-key="day.1.block.1.exercise.1.muscleGroup"]');await target.waitFor({state:'visible'});
  assert.equal(await target.evaluate(el=>el===document.activeElement),true,'error selects day, expands exercise and focuses muscle group');
  assert.equal(await target.evaluate(el=>el.classList.contains('routine-validation-flash')),true);
  await target.fill('Pectorales');
  await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();modal=page.getByRole('dialog',{name:'Revisión de la rutina',exact:true});
  assert.equal(await modal.locator('[data-severity=error]').count(),1);
  await modal.locator('[data-severity=error]').first().click();await page.locator('[data-validation-key="day.1.block.1.exercise.2.muscleGroup"]').fill('Pectorales');
  await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();modal=page.getByRole('dialog',{name:'Revisión de la rutina',exact:true});
  assert.equal(await modal.locator('[data-severity=error]').count(),0);assert.equal(await modal.getByRole('button',{name:'Activar rutina',exact:true}).isEnabled(),true);
  if(width===390&&theme==='dark'&&accent==='#2563eb')await page.screenshot({path:path.join(output,'390-warnings.png')});
  if(width===390&&theme==='dark'&&accent==='#2563eb') {
   await modal.getByRole('button',{name:'Seguir editando',exact:true}).click();
   for(let i=0;i<2;i++){await page.locator('.routine-workspace-days button').filter({hasText:/Día 2/}).click();if(!await page.locator('.routine-day-actions').evaluate(el=>el.open))await page.getByText('Acciones del día',{exact:true}).click();await page.getByRole('button',{name:'Eliminar día',exact:true}).click()}
   await page.getByRole('button',{name:'Revisar y activar',exact:true}).click();modal=page.getByRole('dialog',{name:'Revisión de la rutina',exact:true});
   assert.ok((await modal.innerText()).includes('Rutina lista para activar'));await page.screenshot({path:path.join(output,'390-ready.png')});
  }
  await modal.getByRole('button',{name:'Activar rutina',exact:true}).evaluate(button=>{button.click();button.click()});await page.locator('.routine-editor-workspace').waitFor({state:'detached'});
  assert.equal(saves.filter(save=>save.status==='activa').length,1,'activation is single and unchanged');
  assert.deepEqual(errors,[]);results.push({width,theme,accent,status:'PASS'});console.log(width,theme,accent,'PASS');await context.close();
 }
 writeFileSync(path.join(output,'validation.json'),JSON.stringify({results},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(results.length+' routine review scenarios passed');
