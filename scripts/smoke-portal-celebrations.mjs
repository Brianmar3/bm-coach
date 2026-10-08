// Hydrates the actual provider/dialog/hooks with isolated API fixtures. No live data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript');
const { chromium } = createRequire(path.join(process.env.BM_TEST_NODE_MODULES, 'playwright/package.json'))('playwright');
const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css', 'utf8'), { from: path.resolve('app/globals.css') })).css;
const modules = {};
for (const [id, file] of Object.entries({ react: 'react/cjs/react.development.js', 'react-dom': 'react-dom/cjs/react-dom.development.js', 'react-dom/client': 'react-dom/cjs/react-dom-client.development.js', 'react/jsx-runtime': 'react/cjs/react-jsx-runtime.development.js', scheduler: 'scheduler/cjs/scheduler.development.js' })) modules[id] = readFileSync(path.join('node_modules', file), 'utf8');
const transpile = file => ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
for (const file of ['lib/portal-celebrations.ts', 'lib/workspace-branding.ts', 'lib/appearance.ts', 'componentes/achievement-celebration.tsx', 'componentes/celebration-dialog.tsx']) modules[`@/${file.replace(/\.tsx?$/, '')}`] = transpile(file);
modules['./icon'] = transpile('componentes/icons/bm-premium/icon.tsx');
modules.core = transpile('componentes/icons/bm-premium/core.tsx');
modules.support = transpile('componentes/icons/bm-premium/support.tsx');
modules['@/componentes/icons'] = "Object.assign(exports,require('core'),require('support'));";
modules['@/componentes/workspace-branding-provider'] = 'exports.useWorkspaceBranding=()=>window.fixtureBranding;';
modules['next/navigation'] = 'const router={push:url=>window.lastRoute=url};exports.useRouter=()=>router;';
const registry = Object.entries(modules).map(([id, code]) => `${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const bootstrap = `
window.process={env:{NODE_ENV:'development'}};
const factories={${registry}},cache={};function require(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;if(!factories[id])throw Error('Missing '+id);factories[id](require,m,m.exports);return m.exports;}
const R=require('react'), h=R.createElement, rules=require('@/lib/portal-celebrations');
const {AchievementCelebration,useWeeklyMissionCelebration,announceNewAchievements}=require('@/componentes/achievement-celebration');
window.announce=announceNewAchievements;
window.fixtureBranding={displayName:'BM Training',accentColor:new URL(location.href).searchParams.get('accent'),logoMode:'DEFAULT'};
window.fixtureMission={id:'mission-a',weekStart:'2026-10-05',weekEnd:'2026-10-11',target:2,progress:2,percentage:100,state:'COMPLETED',completionBonus:5,pointsAwardedAt:'2026-10-08T12:00:00.000Z'};
window.receipts=JSON.parse(localStorage.getItem('receipts')||'[]');window.pending=JSON.parse(localStorage.getItem('pending')||'[]');window.patches=[];
window.fetch=async(url,options={})=>{if(options.method==='PATCH'){const body=JSON.parse(options.body);window.patches.push(body);if(window.failNext){window.failNext=false;return new Response('{}',{status:503});}const key=body.key||body.notificationId;window.receipts.push(key);localStorage.setItem('receipts',JSON.stringify(window.receipts));return new Response('{}',{status:200});}return new Response(JSON.stringify({achievement:window.pending.find(a=>!window.receipts.includes(a.notificationId))||null}),{status:200});};
function Home(){const [mission,setMission]=R.useState(()=>({...window.fixtureMission,celebrationConfirmed:window.receipts.includes(rules.weeklyCelebrationKey(window.fixtureMission))}));window.changeMission=value=>{window.fixtureMission=value;setMission(value);};R.useEffect(()=>{const refresh=()=>setMission({...window.fixtureMission,celebrationConfirmed:window.receipts.includes(rules.weeklyCelebrationKey(window.fixtureMission))});window.addEventListener('bm:portal-data-refresh',refresh);return()=>window.removeEventListener('bm:portal-data-refresh',refresh);},[]);const hidden=useWeeklyMissionCelebration(mission);return h('main',{},h('button',{id:'outside'},'Inicio'),!hidden&&h('article',{'data-weekly-card':true},'Objetivo semanal'));}
const params=new URL(location.href).searchParams;const mode=params.get('theme');require('@/lib/appearance').applyAppearance(mode.startsWith('system')?'system':mode);
require('react-dom/client').createRoot(document.getElementById('root')).render(h(AchievementCelebration,{isHome:true},h(Home)));
`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const open = async (theme = 'dark', accent = '#D4A72C', width = 390, reducedMotion = 'no-preference') => {
  const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : 844 }, colorScheme: theme.endsWith('dark') ? 'dark' : 'light', reducedMotion });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://bm.test/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bootstrap.replaceAll('</script', '<\\/script')}</script></body></html>` }));
  await page.goto(`https://bm.test/portal?theme=${theme}&accent=${encodeURIComponent(accent)}`);
  await page.getByRole('dialog').waitFor();
  return page;
};
try {
  let cases = 0;
  for (const theme of ['light', 'dark', 'system-light', 'system-dark']) for (const accent of ['#D4A72C', '#1E3A8A']) for (const width of [320, 390, 1280]) for (const motion of ['reduce', 'no-preference']) {
    const page = await open(theme, accent, width, motion);
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal(await page.getByRole('heading', { name: '¡Objetivo semanal completado!' }).count(), 1);
    const result = await page.locator('dialog').evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, overflow: e.scrollWidth > e.clientWidth, confetti: getComputedStyle(e.querySelector('.bm-celebration-confetti')).display, animation: getComputedStyle(e.querySelector('.bm-celebration-content')).animationName }));
    assert.equal(result.width, width); assert.equal(result.height, width === 320 ? 568 : 844); assert.equal(result.overflow, false);
    if (motion === 'reduce') { assert.equal(result.confetti, 'none'); assert.equal(result.animation, 'none'); }
    else assert.notEqual(result.animation, 'none');
    await page.getByRole('button', { name: 'Continuar', exact: true }).scrollIntoViewIfNeeded();
    const cta = await page.getByRole('button', { name: 'Continuar', exact: true }).boundingBox();
    assert.ok(cta.height >= 44 && cta.y >= 0 && cta.y + cta.height <= (width === 320 ? 568 : 844));
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.closest('dialog') !== null), true);
    const contrast = await page.locator('dialog').evaluate(e => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d');
      const lum = color => { ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0); };
      const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
      const button = getComputedStyle(e.querySelector('.bm-celebration-primary'));
      const text = getComputedStyle(e.querySelector('.bm-celebration-subtitle'));
      return [ratio(button.color, button.backgroundColor), ratio(text.color, getComputedStyle(e).backgroundColor)];
    });
    for (const ratio of contrast) assert.ok(ratio >= 4.5, `${theme}/${accent}: contrast ${ratio}`);
    if (process.env.BM_CELEBRATION_SCREENSHOT && ['dark', 'light'].includes(theme) && accent === '#D4A72C' && width === 390 && motion === 'no-preference') {
      await page.waitForTimeout(650);
      await page.screenshot({ path: process.env.BM_CELEBRATION_SCREENSHOT.replace('.png', `-${theme}.png`) });
    }
    await page.close(); cases++;
  }
  const page = await open();
  await page.waitForTimeout(2200);
  assert.equal(await page.getByRole('dialog').count(), 1, 'must not auto-dismiss');
  assert.equal(await page.evaluate(() => window.patches.length), 0, 'must not auto-acknowledge');
  await page.evaluate(() => window.failNext = true);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('[data-weekly-card]').count(), 1);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-weekly-card]').count(), 0);
  await page.reload(); await page.locator('#outside').waitFor();
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole('dialog').count(), 0); assert.equal(await page.locator('[data-weekly-card]').count(), 0);
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.evaluate(() => window.changeMission({ ...window.fixtureMission, state: 'ACTIVE', progress: 1, pointsAwardedAt: null }));
  await page.locator('[data-weekly-card]').waitFor();
  await page.evaluate(() => window.changeMission({ ...window.fixtureMission, state: 'COMPLETED', progress: 2, pointsAwardedAt: '2026-10-08T14:00:00.000Z', celebrationConfirmed: false }));
  await page.getByRole('dialog').waitFor();
  await page.evaluate(() => window.changeMission({ ...window.fixtureMission, state: 'ACTIVE', progress: 1, pointsAwardedAt: null }));
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-weekly-card]').count(), 1);
  await page.evaluate(() => window.changeMission({ ...window.fixtureMission, state: 'COMPLETED', progress: 2, pointsAwardedAt: '2026-10-08T15:00:00.000Z', celebrationConfirmed: false }));
  await page.getByRole('dialog').waitFor();
  await page.evaluate(() => { const a={notificationId:'n1',id:'logro-1',name:'Primer entrenamiento registrado',description:'Completaste tu primera sesión válida.',points:0};const b={...a,notificationId:'n2',id:'logro-2',name:'Nueva carga máxima',exercise:'Sentadilla',previousValue:'35 kg',newValue:'45 kg'};window.pending=[a,b];localStorage.setItem('pending',JSON.stringify(window.pending));window.announce([a,a,b]); });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByText('Primer entrenamiento registrado', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 1);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByText('Nueva carga máxima', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 1);
  await page.getByRole('button', { name: 'Ver mis logros', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.lastRoute), '/portal/puntos');
  await page.reload(); await page.locator('#outside').waitFor();
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.close();
  assert.deepEqual(errors, []);
  console.log(`${cases} responsive/theme/motion cases passed. Manual acknowledgement, failure/retry, reload, focus, Home hide/reappear, renewed completion and achievement queue passed.`);
} finally { await browser.close(); }
