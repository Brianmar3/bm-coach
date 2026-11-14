// Isolated visual preview: real Nutrition React components, fictitious responses.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { webpack } = require('next/dist/compiled/webpack/webpack');
const root = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), 'bm-nutrition-adjustments-'));
writeFileSync(path.join(temp, 'loader.cjs'), `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}`);
writeFileSync(path.join(temp, 'css-loader.cjs'), 'module.exports=function(){return "export default new Proxy({}, {get:(_,name)=>String(name)})"}');
writeFileSync(path.join(temp, 'link.jsx'), 'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}');
writeFileSync(path.join(temp, 'image.jsx'), 'import React from "react";export default function Image(props){return <img {...props}/>}');
writeFileSync(path.join(temp, 'navigation.jsx'), 'export const usePathname=()=>"/portal/nutricion"');
writeFileSync(path.join(temp, 'entry.tsx'), `
import React from 'react';import {createRoot} from 'react-dom/client';
import {NutritionWorkspace} from '@/componentes/nutrition-workspace';
import {NutritionAssistantDock} from '@/componentes/nutrition-assistant-dock';
import {PortalHeader,PortalNavigationLink,PORTAL_MOBILE_NAV_CLASS} from '@/componentes/portal-visuals';
import {BmHomeIcon,BmCalendarIcon,BmNutritionIcon,BmEvaluationIcon,BmPlusIcon,BmBellIcon} from '@/componentes/icons';
import {workspaceBrandingVariables,DEFAULT_WORKSPACE_BRANDING} from '@/lib/workspace-branding';
import {applyAppearance} from '@/lib/appearance';
const view=new URLSearchParams(location.search).get('view')||'plan';applyAppearance('dark');
const branding={...DEFAULT_WORKSPACE_BRANDING,accentColor:'#D4A72C'};
createRoot(document.getElementById('root')).render(<div className="workspace-brand" style={workspaceBrandingVariables('#D4A72C')}>
<PortalHeader branding={branding} studentName="Alumno de prueba" actions={<button aria-label="Notificaciones"><BmBellIcon size={24}/></button>}/>
<main className="portal-nav-content mx-auto max-w-6xl p-2.5 pb-[calc(var(--portal-bottom-nav-height)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-clearance)+env(safe-area-inset-bottom))] sm:p-6 md:pb-12"><NutritionAssistantDock><NutritionWorkspace slug={view==='plan'?['plan','plan-1']:view==='compras'?['compras','list-1']:view==='ideas'?['ideas']:['asistente']}/></NutritionAssistantDock></main>
<nav aria-label="Navegación móvil del portal" className={PORTAL_MOBILE_NAV_CLASS} style={{gridTemplateColumns:'repeat(5,minmax(0,1fr))'}}><PortalNavigationLink title="Inicio" href="/portal" Icon={BmHomeIcon} active={false}/><PortalNavigationLink title="Clases" href="/portal/clases" Icon={BmCalendarIcon} active={false}/><button aria-label="Registro rápido"><BmPlusIcon size={24}/></button><PortalNavigationLink title="Nutrición" href="/portal/nutricion" Icon={BmNutritionIcon} active/><PortalNavigationLink title="Evaluación" href="/portal/evaluaciones" Icon={BmEvaluationIcon} active={false}/></nav></div>);
`);
await new Promise((resolve, reject) => webpack({ mode: 'production', entry: path.join(temp, 'entry.tsx'), output: { path: temp, filename: 'bundle.js' }, resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], modules: [path.join(root, 'node_modules')], alias: { '@': root, 'next/link': path.join(temp, 'link.jsx'), 'next/image': path.join(temp, 'image.jsx'), 'next/navigation': path.join(temp, 'navigation.jsx') } }, module: { rules: [{ test: /\.module\.css$/, use: path.join(temp, 'css-loader.cjs') }, { test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(temp, 'loader.cjs') }] }, optimization: { minimize: false } }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
const compiled = path.join(root, '.next/static/chunks');
const css = readdirSync(compiled).filter((name) => name.endsWith('.css')).map((name) => readFileSync(path.join(compiled, name), 'utf8')).join('\n') + readFileSync('app/portal/(student)/nutricion/nutrition.css', 'utf8');
const bundle = readFileSync(path.join(temp, 'bundle.js'));
const fixtures = `
const recipe={id:'recipe-1',title:'Revuelto de zapallito y huevo',description:'Comida simple.',servings:1,preparationMinutes:20,difficulty:'Fácil',ingredients:[{name:'huevo',quantity:2,unit:'unidades',category:'Proteínas'},{name:'zapallito',quantity:1,unit:'unidad',category:'Verduras'}],steps:['Lavá el zapallito.','Cociná con el huevo.'],equipment:[],substitutions:[],rationale:'',warnings:[],tags:[]};
let plan={id:'plan-1',startDate:'2026-11-13',endDate:'2026-11-19',status:'ACTIVE',active:true,configuration:{generatedRecipes:[recipe]},meals:[{id:'m1',dateKey:'2026-11-13',mealType:'Almuerzo',title:recipe.title,suggestedTime:'',relationToTraining:'',status:'PLANNED'},{id:'m2',dateKey:'2026-11-13',mealType:'Cena',title:recipe.title,suggestedTime:'',relationToTraining:'',status:'PLANNED'}]};
let list={id:'list-1',title:'Compras del plan',status:'ACTIVE',items:[{id:'i1',name:'huevo',quantity:4,unit:'unidades',category:'Proteínas',checked:false},{id:'i2',name:'zapallito',quantity:2,unit:'unidades',category:'Verduras',checked:false}],updatedAt:new Date().toISOString()};
const nativeFetch=window.fetch;window.fetch=async (input,init={})=>{const url=String(input),method=init.method||'GET';let body={};if(url.includes('/nutrition/plans')){if(method==='PUT'){plan={...plan,meals:JSON.parse(init.body).meals||plan.meals};body={message:'Plan actualizado.'}}else body={plans:[plan]};}else if(url.includes('/nutrition/shopping')){if(method==='PUT'){list={...list,items:JSON.parse(init.body).items};body={message:'Lista actualizada.'}}else body={lists:[list]};}else if(url.includes('/nutrition/feedback'))body=method==='GET'?{selections:{}}:{message:'Preferencia guardada.'};else if(url.includes('/nutrition/ideas'))body={data:{recipes:[recipe]}};else if(url.includes('/nutrition/assistant'))body={conversations:[],usage:null};return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}})};
`;
const server = createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(bundle); }
  else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.end(css); }
  else if (req.url?.startsWith('/avatars/') || req.url?.startsWith('/bm-training-')) { try { res.end(readFileSync(path.join(root, 'public', decodeURI(req.url)))); } catch { res.writeHead(404).end(); } }
  else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>${fixtures}</script><script src="/bundle.js"></script></body></html>`); }
});
server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}`));
