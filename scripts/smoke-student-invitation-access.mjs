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
const root=process.cwd(), temp=mkdtempSync(path.join(tmpdir(),'bm-student-access-'));
writeFileSync(path.join(temp,'loader.cjs'),`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}`);
writeFileSync(path.join(temp,'link.jsx'),`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
writeFileSync(path.join(temp,'image.jsx'),`import React from 'react';export default function Image({priority,unoptimized,fill,...props}){return <img {...props}/>} `);
writeFileSync(path.join(temp,'entry.tsx'),"import React from 'react';import {createRoot} from 'react-dom/client';import {StudentInvitationForm} from '@/componentes/student-invitation-form';import {StudentInvitationOutcome} from '@/componentes/student-invitation-outcome';import {PortalLoginForm} from '@/componentes/portal-login-form';const f=window.fixture;const branding={accentColor:f.accent,logoMode:'DEFAULT',displayName:'Super fitness'};createRoot(document.getElementById('root')).render(location.pathname.startsWith('/portal/login')?<PortalLoginForm/>:f.state.startsWith('register')?<StudentInvitationForm token={'a'.repeat(43)} branding={branding}/>:<StudentInvitationOutcome status={f.state} branding={f.state==='USED'?branding:undefined}/>);");
writeFileSync(path.join(temp,'navigation.js'), 'export function useRouter(){return {replace:path=>location.assign(path),refresh:()=>{}}}');
writeFileSync(path.join(temp,'offline.js'), 'export async function finishOfflineLogout(){};export async function reconcileOfflineLogin(identity){window.testOfflineIdentity=identity}');
writeFileSync(path.join(temp,'crypto.js'), 'export function createHash(){throw new Error("Server hashing is not part of this UI smoke")}');
await new Promise((resolve,reject)=>webpack({plugins:[new webpack.NormalModuleReplacementPlugin(/^@\/lib\/offline-training-client$/,path.join(temp,'offline.js')),new webpack.NormalModuleReplacementPlugin(/^node:crypto$/,path.join(temp,'crypto.js'))],mode:'production',entry:path.join(temp,'entry.tsx'),output:{path:temp,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(root,'node_modules')],alias:{'@':root,'next/navigation':path.join(temp,'navigation.js'),'next/link':path.join(temp,'link.jsx'),'next/image':path.join(temp,'image.jsx')}},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(temp,'loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
const css=readdirSync('.next/static/chunks').filter(x=>x.endsWith('.css')).map(x=>readFileSync(path.join('.next/static/chunks',x),'utf8')).join('\n');
const bundle=readFileSync(path.join(temp,'bundle.js'));
console.log(`Visuals: ${temp}`);
const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle)}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css)}else if(req.url.startsWith('/avatars/')||req.url.startsWith('/bm-training-')){try{res.end(readFileSync(path.join(root,'public',decodeURI(req.url))))}catch{res.writeHead(404).end()}}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const output=path.join(root,'docs','visuals','student-invitation-access');require('node:fs').mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try {
 for(const width of [320,390,430,1280])for(const accent of ['#D4A72C','#2563eb'])for(const state of ['register-success','register-fallback','USED','EXPIRED','REVOKED','INVALID']) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});await context.addInitScript(f=>window.fixture=f,{accent,state});const page=await context.newPage(),errors=[],posts=[];page.on('pageerror',error=>errors.push(error.message));let loginCount=0;
  await page.route('**/api/**',async route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/student-invitations/')){posts.push(route.request().postDataJSON());return route.fulfill({status:201,json:{message:'Tu cuenta fue creada.',loginUrl:'/portal/login?mode=student'}})}if(url.pathname==='/api/portal/login'){loginCount++;if(state==='register-fallback'&&loginCount===1)return route.fulfill({status:503,json:{error:'Temporal'}});return route.fulfill({headers:{'set-cookie':'bm-test-session=ok; Path=/; HttpOnly; SameSite=Lax'},json:{ok:true,offlineIdentity:{studentId:'student-a',workspaceId:'workspace-a'}}})}return route.fulfill({json:{}})});
  await page.route(origin+'/portal',route=>route.fulfill({contentType:'text/html',body:'<h1>Portal del alumno</h1>'}));await page.goto(origin);
  if(state.startsWith('register')){
   for(const [name,value] of Object.entries({firstName:'Ana',lastName:'Prueba',phone:'3415551234',username:'ana.prueba',password:'Password123',confirmPassword:'Password123'}))await page.locator(`[name="${name}"]`).fill(value);
   await page.getByRole('button',{name:'Crear mi cuenta',exact:true}).click();await page.getByRole('heading',{name:'Tu cuenta está lista',exact:true}).waitFor();assert.equal(posts.length,1);assert.equal(loginCount,1);assert.equal(await page.locator('form').count(),0);assert.ok(await page.getByRole('link',{name:'/portal/login?mode=student',exact:true}).count());const enter=page.getByRole('link',{name:'Entrar a BM Training',exact:true});assert.equal(await enter.getAttribute('href'),state==='register-success'?'/portal':'/portal/login?mode=student');
   if(state==='register-success')assert.deepEqual(await page.evaluate(()=>window.testOfflineIdentity),{studentId:'student-a',workspaceId:'workspace-a'});
   if(width===390)await page.screenshot({path:path.join(output,`${state}-${accent.slice(1)}.png`)});
   await enter.click();if(state==='register-success'){await page.getByRole('heading',{name:'Portal del alumno',exact:true}).waitFor();await context.clearCookies();await page.goto(origin+'/portal/login?mode=student')}
   await page.locator('#portal-username').fill('ana.prueba');await page.locator('#portal-password').fill('Password123');await page.locator('form button[type=submit]').click();await page.getByRole('heading',{name:'Portal del alumno',exact:true}).waitFor();assert.equal(posts.length,1);assert.ok((await context.cookies()).some(cookie=>cookie.name==='bm-test-session'));
  }else{
   assert.equal(await page.locator('form').count(),0);if(state==='USED'){await page.getByRole('heading',{name:'Esta invitación ya fue utilizada.',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Ingresar',exact:true}).getAttribute('href'),'/portal/login?mode=student');assert.ok((await page.locator('body').innerText()).toLowerCase().includes('super fitness'))}else{assert.equal(await page.getByRole('link',{name:'Ingresar',exact:true}).count(),0);assert.ok((await page.locator('body').innerText()).includes(state==='EXPIRED'?'venció':state==='REVOKED'?'revocada':'no válida'))}if(width===390)await page.screenshot({path:path.join(output,`${state}-${accent.slice(1)}.png`)});
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);results.push({width,accent,state,passed:true});console.log(`${width} ${accent} ${state} PASS`);await context.close();
 }
 writeFileSync(path.join(output,'validation.json'),JSON.stringify({scenarios:results.length,results,note:'Real UI and compiled CSS; auth responses mocked in browser. Real auth handlers tested separately with simulated database.'},null,2));console.log(`${results.length} invitation scenarios passed`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
