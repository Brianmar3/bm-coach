import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const require=createRequire(import.meta.url), ts=require('typescript');
const page=readFileSync('app/dashboard/page.tsx','utf8');
const ast=ts.createSourceFile('page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['PaymentsPanel','AttendancePanel','Panel','SectionLink','money','showDate'];
const functions=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)).map(node=>node.getText(ast)).join('\n');
const code=ts.transpileModule('const {useState,useRef}=require("react"); const Link=({href,children,...props})=> <a href={href} {...props}>{children}</a>;'+functions+'\nmodule.exports={PaymentsPanel,AttendancePanel};',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('require','module','exports',code)(require,mod,mod.exports);
const {PaymentsPanel,AttendancePanel}=mod.exports;
const dom=new JSDOM('<html><body></body></html>',{url:'https://bm.test/dashboard'});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','Event'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),h=React.createElement;
const {render,screen,fireEvent,cleanup}=require('@testing-library/react');afterEach(cleanup);
const income=[{date:'2026-11-01',label:'1',amount:30000,payments:[{id:'p',studentName:'Ana Pérez',amount:30000,paidDate:'2026-11-01',billingPeriod:'2026-10'}]},{date:'2026-11-02',label:'2',amount:0,payments:[]}];
for(const width of [390,1280])for(const theme of ['light','dark'])test(`${width}px ${theme}: Cobros compacto, detalle cerrado y selección de día con cuota de otro mes`,()=>{
 window.innerWidth=width;document.documentElement.dataset.theme=theme;
 const {container}=render(h(PaymentsPanel,{data:income,metrics:{monthIncome:30000,monthPaymentCount:1}}));
 assert.equal(container.querySelector('details').open,false);
 assert.ok(screen.getByText('1 pagos registrados'));
 fireEvent.click(screen.getByRole('button',{name:/01.?nov.*30\.000/}));
 assert.equal(container.querySelector('details').open,true);
 assert.ok(screen.getByText('Ana Pérez'));assert.ok(screen.getByText(/Cobro:.*01.?nov.*Cuota: octubre de 2026/));
 fireEvent.change(screen.getByLabelText('Día de cobro'),{target:{value:'2026-11-02'}});
 assert.ok(screen.getByText('Sin cobros en este día.'));
 assert.equal(screen.queryByText('Ana Pérez'),null);
});
for(const width of [390,1280])test(`${width}px Actividad semanal conserva datos y métricas reales`,()=>{
 window.innerWidth=width;
 render(h(AttendancePanel,{data:[{date:'2026-11-02',label:'Lun',present:18},{date:'2026-11-03',label:'Mar',present:4}],summary:{weeklyAverage:88,bestDay:'Lun',totalAttendance:22}}));
 assert.ok(screen.getByText('22 asistencias'));assert.ok(screen.getByText('88% sobre registros · Mejor día: Lun'));assert.ok(screen.getByRole('img',{name:'Asistencias de la semana: Lun 18, Mar 4'}));
});
test('API mantiene ámbito workspace y separa mes efectivo de período de cuota sin consultas por alumno',()=>{
 const route=readFileSync('app/api/dashboard/route.ts','utf8');
 assert.match(route,/student: \{ workspaceId \}, status: "PAGADO", paidDate: \{ gte: argentinaDateTimeBoundary\(previousMonthStart\), lt: argentinaDateTimeBoundary\(nextMonthStart\)/);
 const a=route.indexOf('    const currentPayments ='),b=route.indexOf('    const todayPaymentSummary',a);
 const c=route.indexOf('    const incomeByDate ='),d=route.indexOf('    const attendanceTodayBySchedule',c);
 const snippet=ts.transpileModule(route.slice(a,b)+route.slice(c,d)+'\nreturn {income,monthIncome,currentPayments};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const argentinaDateKey=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 const databaseDateKey=date=>date.toISOString().slice(0,10);
 const build=new Function('paymentRecords','monthStart','today','namesByStudent','argentinaDateKey','databaseDateKey','addDays',snippet);
 const records=[{id:'a',studentId:'s',amount:30000,paidDate:new Date('2026-11-01T01:00:00Z'),billingPeriod:new Date('2026-11-01T12:00:00Z')},{id:'b',studentId:'s',amount:40000,paidDate:new Date('2026-11-01T03:01:00Z'),billingPeriod:new Date('2026-10-01T12:00:00Z')}];
 const result=build(records,'2026-11-01','2026-11-03',new Map([['s','Ana']]),argentinaDateKey,databaseDateKey,(key,n)=>{const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return databaseDateKey(date);});
 assert.equal(result.monthIncome,40000);assert.equal(result.currentPayments.length,1);assert.equal(result.income[0].amount,40000);assert.equal(result.income[0].payments[0].billingPeriod,'2026-10');assert.equal(result.income[1].amount,0);assert.deepEqual(result.income[1].payments,[]);
});


for(const width of [390,1280])for(const count of [2,20])test(`${width}px detalle con ${count} pagos: lista acotada, todos los pagos disponibles y cierre conservado`,()=>{
 window.innerWidth=width;
 const payments=Array.from({length:count},(_,i)=>({id:String(i),studentName:'Alumno '+i,amount:30000,paidDate:'2026-11-01',billingPeriod:'2026-11'}));
 const {container}=render(h(PaymentsPanel,{data:[{date:'2026-11-01',label:'1',amount:count*30000,payments}],metrics:{monthIncome:count*30000,monthPaymentCount:count}}));
 assert.equal(container.querySelector('details').open,false);
 fireEvent.click(screen.getByRole('button',{name:/01.?nov/}));
 const list=screen.getByRole('list',{name:'Pagos del día seleccionado'});
 assert.equal(list.children.length,count);
 assert.ok(list.classList.contains('max-h-48'));assert.ok(list.classList.contains('overflow-y-auto'));assert.ok(list.classList.contains('overflow-x-hidden'));
 assert.equal(list.tabIndex,0);assert.ok(screen.getByText('Alumno '+(count-1)));
 fireEvent.click(container.querySelector('summary'));assert.equal(container.querySelector('details').open,false);
});
