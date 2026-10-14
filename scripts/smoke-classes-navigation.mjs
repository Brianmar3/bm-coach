// Real Next router + real attendance component; synthetic APIs, no database writes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,rmSync,mkdtempSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=createRequire(path.join(process.env.BM_TEST_NODE_MODULES,'playwright/package.json'))('playwright');
const root=process.cwd();
let server,fixture;
let origin=process.env.BM_CLASSES_SMOKE_ORIGIN;
if(!origin){
 fixture=mkdtempSync(path.join(root,'.classes-navigation-smoke-'));
 for(const route of ['asistencias','clases','dashboard'])mkdirSync(path.join(fixture,'app',route),{recursive:true});
 writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true}));
 writeFileSync(path.join(fixture,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',lib:['dom','esnext'],jsx:'react-jsx',module:'esnext',moduleResolution:'bundler',esModuleInterop:true,skipLibCheck:true,paths:{'@/*':['../*']}},include:['**/*.tsx']}));
 writeFileSync(path.join(fixture,'app/layout.tsx'),`import Link from 'next/link';import {Suspense} from 'react';import {ClassesSecondaryNav} from '@/componentes/classes-secondary-nav';import {trainerCommands} from '@/lib/trainer-commands';import '@/app/globals.css';export default function Layout({children}){return <html><body><nav><Link href='/clases'>Clases general</Link><Link href='/dashboard'>Home</Link><Link href={trainerCommands.find(c=>c.id==='attendance').href}>Tomar asistencia</Link><Link href='/asistencias?view=low-activity'>Poca actividad</Link><Link href='/asistencias?view=attendance&scheduleId=a&date=2026-10-14'>Clase A</Link><Link href='/asistencias?view=attendance&scheduleId=b&date=2026-10-15'>Clase B</Link></nav><Suspense><ClassesSecondaryNav/></Suspense>{children}</body></html>}`);
 writeFileSync(path.join(fixture,'app/asistencias/page.tsx'),`export {default} from '@/app/asistencias/page';`);
 for(const [route,label] of [['clases','Calendario'],['dashboard','Home']])writeFileSync(path.join(fixture,`app/${route}/page.tsx`),`export default function Page(){return <h1>${label}</h1>}`);
 origin='http://localhost:3108';
 server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev',fixture,'--webpack','-p','3108'],{cwd:root,stdio:'pipe'});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Next did not start')),60000);server.stdout.on('data',data=>{if(String(data).includes('Ready')){clearTimeout(timeout);resolve()}});server.on('error',reject);server.on('exit',code=>{clearTimeout(timeout);reject(new Error(`Next exited ${code}`))})});
}
const browser=await chromium.launch({channel:'msedge',headless:true});
let checks=0;
try{
 for(const width of [320,390,768,1280]){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],rosters=[];
 page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',route=>{const url=new URL(route.request().url());let body=[];
 if(url.pathname==='/api/dashboard')body={attentionToday:{lowActivityStudents:[]}};
 if(url.pathname==='/api/asistencias'){rosters.push(url.search);body={students:[]}};
 if(url.pathname.includes('/resumen'))body={today:{present:0,absent:0,justified:0,total:0},monthlyPercentage:0,recentAbsences:[]};
 return route.fulfill({json:body})});
 const low=page.getByRole('heading',{name:'Alumnos con baja actividad'}),attendance=page.getByRole('button',{name:'Marcar todos presentes'});
 const go=async(name,url)=>{await page.getByRole('link',{name,exact:true}).click();await page.waitForURL(origin+url);};
 const checkAttendance=async()=>{await attendance.waitFor();assert.equal(await low.isVisible(),false);checks++};
 await page.goto(origin+'/dashboard');await go('Clases general','/clases');
 await go('Poca actividad','/asistencias?view=low-activity');await low.waitFor();
 assert.equal(await page.getByRole('link',{name:'Asistencias',exact:true}).evaluate(el=>el.className.includes('after:absolute')),false);
 await go('Volver','/clases');await page.getByRole('heading',{name:'Calendario'}).waitFor();assert.equal(await low.isVisible(),false);checks++;
 // replace avoids adding a second low-activity entry to browser history.
 await page.goBack();assert.equal(await low.isVisible(),false);checks++;
 await go('Poca actividad','/asistencias?view=low-activity');await low.waitFor();
 await go('Home','/dashboard');await go('Tomar asistencia','/asistencias?view=attendance');await checkAttendance();
 await go('Poca actividad','/asistencias?view=low-activity');await low.waitFor();
 await go('Clases general','/clases');await page.getByRole('heading',{name:'Calendario'}).waitFor();checks++;
 await go('Tomar asistencia','/asistencias?view=attendance');await checkAttendance();
 await go('Poca actividad','/asistencias?view=low-activity');await low.waitFor();await page.reload();await low.waitFor();checks++;
 await go('Tomar asistencia','/asistencias?view=attendance');await checkAttendance();
 await page.goBack();await low.waitFor();await page.goForward();await checkAttendance();
 await go('Clase A','/asistencias?view=attendance&scheduleId=a&date=2026-10-14');
 await page.locator('input[type=date]').fill('2026-10-20');
 await go('Clase B','/asistencias?view=attendance&scheduleId=b&date=2026-10-15');
 await page.waitForFunction(()=>document.querySelector('input[type=date]')?.value==='2026-10-15');
 await page.waitForFunction(()=>document.body.textContent.includes('No hay alumnos para esta fecha'));
 assert.ok(rosters.some(search=>search.includes('scheduleId=b')&&search.includes('date=2026-10-15')));checks++;
 await page.locator('input[placeholder="Nombre o apellido"]').fill('anterior');
 await go('Poca actividad','/asistencias?view=low-activity');await low.waitFor();await go('Tomar asistencia','/asistencias?view=attendance');await checkAttendance();
 assert.equal(await page.locator('input[placeholder="Nombre o apellido"]').inputValue(),'');checks++;
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log(`${width}px PASS`);await context.close();
 }
 console.log(`${checks} navigation checks PASS; real Next router, synthetic HTTP data.`);
}finally{
 await browser.close();
 if(server){server.kill('SIGINT');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,5000)});}
 if(fixture&&path.dirname(fixture)===root&&path.basename(fixture).startsWith('.classes-navigation-smoke-'))rmSync(fixture,{recursive:true,force:true});
}
