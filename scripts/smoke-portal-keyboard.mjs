// Real React components; viewport/keyboard and password API are isolated fixtures.
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
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
for (const file of ['lib/portal-keyboard.ts', 'lib/student-invitation-password.ts', 'lib/appearance.ts', 'lib/workspace-branding.ts', 'componentes/portal-keyboard-behavior.tsx', 'componentes/password-field.tsx', 'componentes/portal-visuals.tsx']) modules[`@/${file.replace(/\.tsx?$/, '')}`] = compile(readFileSync(file, 'utf8'));
const section = readFileSync('componentes/portal-section.tsx', 'utf8');
modules.card = compile('import {useState,useRef,type FormEvent} from "react";import {PasswordField} from "@/componentes/password-field";import {invitationPasswordRequirements,invitationPasswordValidationError} from "@/lib/student-invitation-password";' + section.slice(section.indexOf('export function ChangePasswordCard('), section.indexOf('function PortalLogoutCard(')));
modules['./icon'] = compile(readFileSync('componentes/icons/bm-premium/icon.tsx', 'utf8'));
modules['@/componentes/icons'] = compile(readFileSync('componentes/icons/bm-premium/support.tsx', 'utf8'));
modules['next/link'] = 'exports.default=({href,children,...props})=>require("react").createElement("a",{href,...props},children);';
modules['@/componentes/workspace-brand-logo'] = 'exports.WorkspaceBrandLogo=()=>require("react").createElement("span",{},"BM");';
modules['@/componentes/student-photo'] = 'exports.StudentPhoto=()=>null;';
modules['@/lib/profile-avatars'] = 'exports.DEFAULT_PROFILE_AVATAR={src:""};';
const registry = Object.entries(modules).map(([id, code]) => `${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const mainClass = readFileSync('componentes/portal-shell.tsx', 'utf8').match(/<main key=\{pathname\} className="([^"]+)"/)[1];
for (const file of ['componentes/portal-shell.tsx', 'componentes/offline-training.tsx', 'componentes/self-service-shell.tsx']) assert.ok(readFileSync(file, 'utf8').includes('portal-nav-content'), file);
const bootstrap = `window.process={env:{NODE_ENV:'development'}};const factories={${registry}},cache={};function require(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;if(!factories[id])throw Error('Missing '+id);factories[id](require,m,m.exports);return m.exports;}
const R=require('react'),h=R.createElement,visuals=require('@/componentes/portal-visuals'),params=new URL(location.href).searchParams;require('@/lib/appearance').applyAppearance(params.get('theme').startsWith('system')?'system':params.get('theme'));window.vv=new EventTarget();Object.assign(window.vv,{height:innerHeight,width:innerWidth,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:window.vv});window.keyboard=height=>{window.vv.height=height;window.vv.dispatchEvent(new Event('resize'));};window.requests=[];window.fetch=async(url,options)=>{window.requests.push({url,body:JSON.parse(options.body)});return new Response('{}');};const branding={displayName:'BM Training',logoMode:'DEFAULT',accentColor:params.get('accent')};window.root=require('react-dom/client').createRoot(document.getElementById('root'));window.root.render(h('div',{className:'workspace-brand',style:require('@/lib/workspace-branding').workspaceBrandingVariables(branding.accentColor)},h(visuals.PortalHeader,{studentName:'Alumno',branding}),h('main',{className:${JSON.stringify(mainClass)}},h(require('card').ChangePasswordCard,{forced:true}),h('textarea',{id:'note','aria-label':'Nota',className:'mt-6 w-full border p-3'}),h('div',{style:{height:600}})),h('nav',{className:visuals.PORTAL_MOBILE_NAV_CLASS,'aria-label':'Navegación móvil del portal'},h('a',{href:'/portal'},'Inicio'))));`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let cases = 0;
try {
  for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark', 'system-light', 'system-dark']) for (const accent of ['#D4A72C', '#2563eb']) {
    const mobile = width < 768;
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile, colorScheme: theme.endsWith('light') ? 'light' : 'dark' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://keyboard.test/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bootstrap.replaceAll('</script', '<\\/script')}</script></body></html>` }));
    await page.goto(`https://keyboard.test/?theme=${theme}&accent=${encodeURIComponent(accent)}`);
    const current = page.getByLabel('Contraseña actual', { exact: true }), next = page.getByLabel('Nueva contraseña', { exact: true }), repeat = page.getByLabel('Repetir contraseña', { exact: true });
    const nav = page.getByRole('navigation', { name: 'Navegación móvil del portal' });
    await current.waitFor(); assert.equal(await nav.isVisible(), mobile);
    const padding = await page.locator('main').evaluate(element => getComputedStyle(element).paddingBottom);
    await current.fill('Temporary123'); assert.equal(await nav.isVisible(), mobile);
    await page.evaluate(() => window.keyboard(500));
    if (mobile) await nav.waitFor({ state: 'hidden' });
    else { await page.waitForTimeout(30); assert.equal(await page.locator('html').getAttribute('data-portal-keyboard'), null); }
    if (mobile) {
      assert.equal(await page.locator('main').evaluate(element => getComputedStyle(element).paddingBottom), '16px');
      await next.focus(); assert.equal(await nav.isVisible(), false);
      await page.getByLabel('Nota', { exact: true }).focus(); assert.equal(await nav.isVisible(), false);
      await page.evaluate(() => scrollTo(0, 200)); assert.ok(await page.evaluate(() => scrollY > 0));
      await page.evaluate(() => window.keyboard(844)); await nav.waitFor({ state: 'visible' });
      assert.equal(await page.locator('main').evaluate(element => getComputedStyle(element).paddingBottom), padding);
      // WebView adjustResize: both layout and visual viewport shrink.
      await next.focus(); await page.setViewportSize({ width, height: 500 }); await page.evaluate(() => window.keyboard(500)); await nav.waitFor({ state: 'hidden' });
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => window.keyboard(844)); await nav.waitFor({ state: 'visible' });
      // Rotation clears stale portrait geometry and can detect a landscape keyboard.
      await page.setViewportSize({ width: 600, height: 390 }); await page.evaluate(() => { Object.defineProperty(screen,'availHeight',{configurable:true,value:390});window.keyboard(390);window.dispatchEvent(new Event('orientationchange')); }); await nav.waitFor({ state: 'visible' });
      await page.evaluate(() => window.keyboard(200)); await nav.waitFor({ state: 'hidden' });
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => {Object.defineProperty(screen,'availHeight',{configurable:true,value:844});window.keyboard(844);}); await nav.waitFor({ state: 'visible' });
    }
    const checklist = page.getByRole('list', { name: 'Requisitos de contraseña' });
    for (const value of ['Aa1short', 'password123', 'PASSWORD123', 'Passwordaaa']) {
      await next.fill(value); await repeat.fill(value); await page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click();
      assert.equal(await page.evaluate(() => window.requests.length), 0); assert.ok(await checklist.locator('li').filter({ hasText: 'Pendiente:' }).count() > 0);
    }
    await next.fill('Password123'); await repeat.fill('Different123'); await page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Las contraseñas nuevas no coinciden.' }).waitFor(); assert.equal(await page.evaluate(() => window.requests.length), 0);
    const rows = await checklist.locator('li').evaluateAll(items => items.map(item => ({ text: item.textContent, y: item.getBoundingClientRect().y })).sort((a,b)=>a.y-b.y));
    assert.ok(rows[0].text.includes('10 caracteres mínimo')); assert.ok(rows[1].text.includes('1 mayúscula')); assert.ok(rows[2].text.includes('1 número')); assert.ok(rows[3].text.includes('1 minúscula'));
    assert.equal(await checklist.locator('li').filter({ hasText: 'Cumplido:' }).count(), 4);
    await repeat.fill('Password123'); await repeat.press('Enter'); await page.getByRole('status').filter({ hasText: 'Contraseña actualizada correctamente.' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.requests), [{url:'/api/portal/change-password',body:{currentPassword:'Temporary123',newPassword:'Password123'}}]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => window.root.unmount()); assert.equal(await page.locator('html').getAttribute('data-portal-keyboard'), null);
    assert.deepEqual(errors, []); await page.close(); cases++;
  }
  console.log(`${cases} cases passed: keyboard focus/resize/close/textarea/scroll/rotation/cleanup, desktop, themes/accents and password checklist/validation/save.`);
} finally { await browser.close(); }
