// Render the production SVG family and actual navigation/profile presentation.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { chromium } = createRequire(path.join(process.env.BM_TEST_NODE_MODULES, 'playwright/package.json'))('playwright');
function compile(source, resolve = require) {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require','module','exports',code)(resolve,compiledModule,compiledModule.exports);
  return compiledModule.exports;
}
const base = compile(readFileSync('componentes/icons/bm-premium/icon.tsx','utf8'));
const core = compile(readFileSync('componentes/icons/bm-premium/core.tsx','utf8'), n => n === './icon' ? base : require(n));
const support = compile(readFileSync('componentes/icons/bm-premium/support.tsx','utf8'), n => n === './icon' ? base : require(n));
const icons = {...core,...support};
const branding = compile(readFileSync('lib/workspace-branding.ts','utf8'));
const hooks = {...React,useState: initial => [typeof initial === 'function' ? initial() : initial,()=>{}],useEffect(){},useRef:()=>({current:null})};
function FixtureLink({children,...props}) { delete props.onClick; return React.createElement('a',props,children); }
function Logo() { return React.createElement(icons.BmRoutineIcon,{size:32}); }
const visuals = compile(readFileSync('componentes/portal-visuals.tsx','utf8'), n => {
  if(n==='next/link')return FixtureLink;
  if(n.endsWith('/icons'))return icons;
  if(n.endsWith('student-photo'))return {StudentPhoto:()=>null};
  if(n.endsWith('profile-avatars'))return {DEFAULT_PROFILE_AVATAR:{src:''}};
  if(n.endsWith('workspace-brand-logo'))return {WorkspaceBrandLogo:Logo};
  if(n.endsWith('workspace-branding'))return branding;
  return require(n);
});
const {Sidebar} = compile(readFileSync('componentes/sidebar.tsx','utf8'), n => {
  if(n==='react')return hooks;
  if(n==='next/link')return FixtureLink;
  if(n==='next/navigation')return {usePathname:()=>'/alumnos',useRouter:()=>({})};
  if(n.endsWith('/icons'))return icons;
  if(n.endsWith('use-trainer-keyboard-interactions'))return {useEscapeLayer(){}};
  if(n.endsWith('workspace-brand-logo'))return {WorkspaceBrandLogo:Logo};
  if(n.endsWith('workspace-branding-provider'))return {useWorkspaceBranding:()=>branding.DEFAULT_WORKSPACE_BRANDING};
  return require(n);
});
function extract(file, names) {
 const source=readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 return ast.statements.filter(n=>(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.includes(d.name.getText(ast))))).map(n=>n.getText(ast)).join('\n');
}
const {InfoRow} = compile(`import React from 'react'; ${extract('componentes/student-profile-view.tsx',['InfoRow'])} export { InfoRow };`);
const {Detail} = compile(`import {${Object.keys(icons).join(',')}} from '@/componentes/icons'; ${extract('app/alumnos/page.tsx',['Detail','detailIcons'])} export {Detail};`,n=>n==='@/componentes/icons'?icons:require(n));
const definitions = [['Inicio','BmHomeIcon'],['Rutina','BmRoutineIcon'],['Clases','BmClassesIcon'],['Nutrición','BmNutritionIcon'],['Evaluación','BmEvaluationIcon'],['Alumnos','BmStudentsIcon'],['Objetivo','BmTargetIcon'],['Progreso','BmProgressIcon'],['Molestias','BmDiscomfortIcon'],['Calendario','BmCalendarIcon'],['Timer','BmTimerIcon'],['Ranking','BmRankingIcon']];
for (const [,name] of definitions) {
 const a=render(React.createElement(icons[name],{size:16,title:name,strokeWidth:2,color:'var(--brand-text)',active:true}));
 assert.match(a,/width="16"/);assert.match(a,/role="img"/);assert.match(a,/<title>/);assert.match(a,/stroke-width="2"/);assert.match(a,/data-active="true"/);
 const decorative=render(React.createElement(icons[name])); assert.match(decorative,/aria-hidden="true"/);assert.doesNotMatch(decorative,/role="img"/);
}
assert.equal(new Set(definitions.map(([,n])=>render(React.createElement(icons[n])).replace(/data-bm-icon="[^"]+"/g,''))).size,12);
const gallery = definitions.map(([label,name])=>`<article class="icon-sample"><div class="hero-icon">${render(React.createElement(icons[name],{size:52,active:true,title:label}))}</div><strong>${label}</strong><div class="sizes">${[16,20,24].map(size=>render(React.createElement(icons[name],{size}))).join('')}</div></article>`).join('');
const nav=render(React.createElement('nav',{className:visuals.PORTAL_MOBILE_NAV_CLASS+' grid-cols-5','aria-label':'Navegación del alumno'}, definitions.slice(0,5).map(([title,name],i)=>React.createElement(visuals.PortalNavigationLink,{key:title,title,href:['/portal','/portal/rutina','/portal/clases','/portal/nutricion','/portal/evaluaciones'][i],Icon:icons[name],active:i===0}))));
const profile=[['Altura / peso','178 cm · 74 kg','BmMeasurementsIcon'],['Objetivo','Ganar fuerza','BmTargetIcon'],['Entrena actualmente','Sí','BmRoutineIcon'],['Nivel y experiencia','Intermedio · Más de 3 años','BmLevelIcon'],['Molestias','No informadas','BmDiscomfortIcon']].map(([title,value,name])=>render(React.createElement(InfoRow,{title,value,Icon:icons[name]}))).join('');
const trainerProfile=render(React.createElement('dl',{className:'grid gap-4 sm:grid-cols-2'}, [['Tipo de alumno','Adulto'],['Servicio','Mixto'],['Objetivo','Ganar fuerza'],['Vencimiento','31/10/2026']].map(([label,value])=>React.createElement(Detail,{key:label,label,value}))));
const sidebar=render(React.createElement(Sidebar));
const css = readdirSync('.next/static/chunks').filter(f=>f.endsWith('.css')).map(f=>readFileSync(path.join('.next/static/chunks',f),'utf8')).join('\n');
const previewCss=`body{margin:0;font-family:Arial,sans-serif;background:var(--background);color:var(--foreground)}.preview-header{position:relative;z-index:40;height:72px;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-soft);background:var(--surface)}.preview-main{padding:32px 24px 140px;max-width:1200px;margin:auto}.preview-main h1{font-size:28px;font-weight:700;margin:0 0 8px}.preview-main h2{font-size:20px;margin:32px 0 16px}.icon-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.icon-sample{display:grid;justify-items:center;gap:14px;padding:24px 12px;border:1px solid var(--border-soft);border-radius:20px;background:var(--surface)}.hero-icon{height:64px;display:grid;place-items:center}.sizes{display:flex;gap:16px;align-items:center;color:var(--foreground-muted)}.profile-preview{border:1px solid var(--border-soft);border-radius:20px;background:var(--surface);overflow:hidden}.preview-header button{border:1px solid var(--border);border-radius:8px;padding:6px 10px;background:var(--surface);color:var(--foreground)}@media(min-width:1024px){.preview-main{margin-left:256px}}@media(max-width:600px){.icon-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.icon-sample{padding:16px 4px;font-size:12px}.hero-icon svg{width:40px;height:40px}.sizes{gap:6px}.preview-main{padding:24px 12px 140px}.profile-preview>div{gap:8px;padding-left:12px;padding-right:12px}.preview-header{padding:12px 12px 12px 64px;gap:12px;font-size:12px}}`;
const variables=Object.entries(branding.workspaceBrandingVariables('#D4A72C')).map(([k,v])=>`${k}:${v}`).join(';');
const content=`<header class="preview-header"><strong>BM Training · Sistema premium</strong><button onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light'">Claro / Oscuro</button></header>${sidebar}<main class="preview-main"><h1>Geometría que se reconoce.</h1><p>SVG propios · 24 unidades · trazo 1,7 · color semántico del workspace</p><h2>Familia principal</h2><section class="icon-grid">${gallery}</section><h2>Ficha del alumno · Portal</h2><section class="profile-preview">${profile}</section><h2>Ficha del alumno · Entrenador</h2><section class="profile-preview p-4">${trainerProfile}</section><h2>Rutina y descanso</h2><section class="profile-preview flex items-center gap-3 p-4">${render(React.createElement(icons.BmRoutineIcon,{size:24,active:true}))}<strong>Entrenamiento</strong>${render(React.createElement(icons.BmTimerIcon,{size:18,active:true}))}<span>2:00</span></section></main>${nav}`;
const html=`<!doctype html><html lang="es" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BM Training · Premium Icons</title><style>${css}\n${previewCss}</style></head><body class="workspace-brand admin-panel" style="${variables}">${content}</body></html>`;
mkdirSync('docs/visuals',{recursive:true});writeFileSync('docs/visuals/bm-premium-icons.html',html);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const theme of ['light','dark']) for(const accent of ['#D4A72C','#22C55E']) for(const width of [320,390,1280]) {
  const page=await browser.newPage({viewport:{width,height:1000}});await page.setContent(html);
  const vars=branding.workspaceBrandingVariables(accent);
  await page.evaluate(({theme,vars})=>{document.documentElement.dataset.theme=theme;for(const[k,v]of Object.entries(vars))document.body.style.setProperty(k,v);},{theme,vars});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${theme}/${width}: overflow`);
  assert.equal(await page.locator('.icon-grid svg').count(),48);
  const bounds = await page.locator('.icon-grid svg').evaluateAll(nodes => nodes.map(e => { const box=e.getBBox(); return box.x>=1 && box.y>=1 && box.x+box.width<=23 && box.y+box.height<=23; }));
  assert.ok(bounds.every(Boolean), 'SVG geometry must leave room for the stroke');
  assert.equal(await page.locator('[aria-label="Navegación del alumno"] a').count(),5);
  assert.equal(await page.locator('[aria-label="Navegación principal del entrenador"] a').count(),8);
  assert.equal(await page.locator('[aria-current="page"]').count(),2);
  const colors=await page.locator('.icon-grid svg[data-active="true"]').evaluateAll(nodes=>nodes.map(e=>getComputedStyle(e).color));assert.equal(new Set(colors).size,1);
  const contrast = await page.locator('.icon-sample').first().evaluate(card => {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
    const lum=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);};
    const background=lum(getComputedStyle(card).backgroundColor);
    return [...card.querySelectorAll('svg')].map(e=>{const foreground=lum(getComputedStyle(e).color);return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);});
  });
  assert.ok(contrast.every(value=>value>=3), 'Active and inactive icons must meet 3:1 contrast');
  const distinct=await page.locator('.profile-preview').first().locator('svg').evaluateAll(nodes=>nodes.map(e=>e.dataset.bmIcon));assert.equal(new Set(distinct).size,5);
  if(accent==='#D4A72C'&&[390,1280].includes(width))await page.screenshot({path:`docs/visuals/bm-premium-${theme}-${width}.png`,fullPage:true});
  console.log(`${theme}/${accent}/${width}: family, sizes, bottom nav, sidebar, profile semantics and overflow OK`);
  await page.close();
 }
} finally {await browser.close();}
