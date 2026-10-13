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
const root=process.cwd(), temp=mkdtempSync(path.join(tmpdir(),'bm-exercise-picker-'));
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
const output=path.join(root,'docs','visuals','exercise-picker');require('node:fs').mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
const catalog=JSON.parse(readFileSync(path.join(root,'data','bm-exercise-library.json'),'utf8'));
const facets=Object.fromEntries([['bodyParts','bodyPart','bodyPartLabelEs'],['equipment','equipment','equipmentLabelEs'],['targets','targetMuscle','targetMuscleLabelEs']].map(([key,value,label])=>[key,[...new Map(catalog.map(item=>[item[value],{value:item[value],label:item[label]}])).values()]]));
try {
 for(const width of [320,360,390,430,768,1280,1440])for(const theme of ['dark','light','system-dark','system-light'])for(const accent of ['#D4A72C','#2563eb']) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme.endsWith('light')?'light':'dark',reducedMotion:'reduce',hasTouch:width<=768});
  await context.addInitScript(({theme,accent})=>{window.fixture={theme:theme.startsWith('system')?'system':theme,accent}},{theme,accent});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url());let body=[];
   if(url.pathname==='/api/admin/auth/session')body={authenticated:true,userId:'coach',workspaceId:'workspace'};
   else if(url.pathname==='/api/exercise-library')body={total:catalog.length,items:catalog,facets,mediaEnabled:false};
   else if(url.pathname.startsWith('/api/exercise-library/'))body={exercise:catalog.find(item=>item.id===decodeURIComponent(url.pathname.split('/').pop()))};
   return route.fulfill({json:body});
  });
  await page.goto(origin);
  await page.getByRole('button',{name:'Nueva rutina',exact:true}).first().click();await page.getByRole('button',{name:/Desde cero/}).click();await page.getByLabel('Nombre',{exact:true}).fill('Prueba Biblioteca');await page.getByRole('button',{name:'Crear y empezar a armar',exact:true}).click();
  await page.locator('.routine-block-adder summary').click();await page.getByRole('button',{name:'Fuerza',exact:true}).click();await page.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).click();
  const drawer=page.getByRole('dialog',{name:'Biblioteca de ejercicios BM',exact:true}),rows=drawer.locator('.routine-library-exercise'),search=drawer.getByRole('searchbox',{name:'Buscar ejercicio'});
  await rows.first().waitFor();assert.equal(await rows.count(),60,'preserves pagination');
  const bounds=await drawer.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);
  assert.equal(await drawer.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'no drawer overflow');
  if(width<=768){
   assert.equal(await drawer.getByRole('combobox',{name:'Equipamiento',exact:true}).isVisible(),false);
   assert.ok((await search.boundingBox()).width>=width-30,'full width search');
   assert.equal(await drawer.locator('.routine-library-copy-handle').first().isVisible(),false);
   const heights=await rows.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));assert.ok(Math.max(...heights)<=120,`row height ${Math.max(...heights)}`);
   const visibleRows=await rows.evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}).length);assert.ok(visibleRows>=5,`${visibleRows} fully visible rows`);
  }else{assert.equal(await drawer.getByRole('button',{name:'Filtros',exact:true}).isVisible(),false);assert.ok(bounds.width<=460);assert.equal(await drawer.locator('.routine-library-copy-handle').first().isVisible(),true)}
  if(['dark','light'].includes(theme)&&accent==='#2563eb')await page.screenshot({path:path.join(output,`${width}-${theme}.png`)});
  await search.fill('zzzz-sin-resultados');await drawer.getByText('No encontramos ejercicios con esos filtros.').waitFor();await search.fill('press');await rows.first().waitFor();assert.ok(await rows.count()>0);
  await search.fill('');
  if(width<=768)await drawer.getByRole('button',{name:'Filtros',exact:true}).click();
  if(width===390&&theme==='dark'&&accent==='#2563eb')await page.screenshot({path:path.join(output,'390-filters.png')});
  await drawer.getByRole('combobox',{name:'Equipamiento',exact:true}).selectOption(facets.equipment[0].value);
  await drawer.getByRole('combobox',{name:'Parte corporal',exact:true}).selectOption(facets.bodyParts[0].value);
  if(width<=768){assert.equal(await drawer.getByRole('button',{name:'Filtros · 2',exact:true}).count(),1);await drawer.getByRole('button',{name:'Limpiar filtros',exact:true}).click();await drawer.getByRole('button',{name:'Filtros',exact:true}).click()}
  else{await drawer.getByRole('combobox',{name:'Equipamiento',exact:true}).selectOption('');await drawer.getByRole('combobox',{name:'Parte corporal',exact:true}).selectOption('')}
  await rows.first().waitFor();const first=rows.first(),fav=first.getByRole('button',{name:/Favorito:/});await fav.click();assert.equal(await fav.getAttribute('aria-pressed'),'true');
  await drawer.getByRole('button',{name:'Favoritos',exact:true}).click();assert.equal(await rows.count(),1);await drawer.getByRole('button',{name:'Biblioteca',exact:true}).click();
  await rows.first().getByRole('button',{name:'Agregar',exact:true}).click();await rows.first().getByRole('button',{name:'✓ Agregado',exact:true}).waitFor();assert.equal(await drawer.isVisible(),true);assert.equal(await page.locator('.routine-exercise-row').count(),1);
  await page.waitForTimeout(460);await rows.nth(1).getByRole('button',{name:'Agregar',exact:true}).click();await rows.nth(1).getByRole('button',{name:'✓ Agregado',exact:true}).waitFor();assert.equal(await page.locator('.routine-exercise-row').count(),2);
  await drawer.getByRole('button',{name:'Recientes',exact:true}).click();assert.equal(await rows.count(),2);await drawer.getByRole('button',{name:'Biblioteca',exact:true}).click();
  const list=drawer.locator('.exercise-picker-results');await list.evaluate(el=>el.scrollTop=el.scrollHeight);assert.ok(await list.evaluate(el=>el.scrollTop)>0);await drawer.getByRole('button',{name:'Cargar más',exact:true}).click();assert.equal(await rows.count(),120);await list.evaluate(el=>el.scrollTop=0);
  if(width<=768){
   await page.setViewportSize({width,height:480});await search.focus();await search.fill('banca');await rows.first().waitFor();const r=await search.boundingBox();assert.ok(r.y>=0&&r.y+r.height<480);assert.equal(await drawer.getByRole('button',{name:'Cerrar',exact:true}).isVisible(),true);assert.ok((await rows.first().boundingBox()).y<480);if(width===390&&theme==='dark'&&accent==='#2563eb')await page.screenshot({path:path.join(output,'390-keyboard-simulation.png')});await page.setViewportSize({width,height:900});await search.fill('');
  }else if(theme==='dark'&&accent==='#2563eb'){
   const handle=rows.first().locator('.routine-library-copy-handle');await handle.scrollIntoViewIfNeeded();const source=await handle.boundingBox();await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(source.x-15,source.y+5,{steps:5});const drop=page.locator('[data-library-drop="exercise"][data-enabled]').first();await drop.waitFor({state:'visible'});await drop.scrollIntoViewIfNeeded();const destination=await drop.boundingBox();await page.mouse.move(destination.x+destination.width/2,destination.y+destination.height/2,{steps:12});await page.mouse.up();await page.waitForFunction(()=>document.querySelectorAll('.routine-exercise-row').length===3);
  }
  await drawer.getByRole('button',{name:'Cerrar',exact:true}).click();await drawer.waitFor({state:'detached'});await page.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).click();await drawer.waitFor();await page.keyboard.press('Escape');await drawer.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);results.push({width,theme,accent,passed:true});console.log(`${width} ${theme} ${accent} PASS`);await context.close();
 }
 writeFileSync(path.join(output,'validation.json'),JSON.stringify({scenarios:results.length,results,keyboard:'Reduced viewport simulation; no physical mobile keyboard'},null,2));console.log(`${results.length} picker scenarios passed`);
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
