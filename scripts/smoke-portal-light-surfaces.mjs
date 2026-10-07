// Actual JSX with synthetic read-only state; no login, API or database writes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = createRequire(path.join(process.env.BM_TEST_NODE_MODULES, 'playwright/package.json'))('playwright');
function compile(file, resolve = require, source = readFileSync(file, 'utf8')) {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolve, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
let states = [], stateIndex = 0;
const hooks = { ...React, useState: initial => [states[stateIndex++] ?? initial, () => {}], useEffect() {}, useCallback: fn => fn, useMemo: fn => fn() };
const icons = compile('componentes/icons/index.ts', name => compile(`componentes/icons/${name.replace('./', '')}.tsx`));
function resolve(name) {
  if (name === 'react') return hooks;
  if (name === 'next/link') return function FixtureLink({ children, ...props }) { return React.createElement('a', props, children); };
  if (name === '@/componentes/icons') return icons;
  if (name === '@/componentes/student-photo') return { StudentPhoto: props => React.createElement('img', props) };
  if (name === '@/componentes/achievement-celebration') return { announceNewAchievements() {} };
  if (name.startsWith('@/lib/')) return compile(name.replace('@/', '') + '.ts', resolve);
  return require(name);
}
const { PortalAttendanceView } = compile('componentes/portal-attendance.tsx', resolve);
const { QuickLogHistory } = compile('componentes/quick-log.tsx', resolve);
const branding = compile('lib/workspace-branding.ts');
const appearanceCode = ts.transpileModule(readFileSync('lib/appearance.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
// Extract the real warning JSX; never reproduce its markup in the fixture.
const workoutSource = readFileSync('componentes/portal-section.tsx', 'utf8');
const ast = ts.createSourceFile('workout.tsx', workoutSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let warning;
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.getText(ast).includes('portal-finish-warning')) warning = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast); assert.ok(warning);
const { Warning } = compile('componentes/portal-section.tsx', resolve, `export function Warning() { const setFinalOpen=()=>{}, save=()=>{}, setAllowIncomplete=()=>{}; return ${warning}; }`);
const log = { id: 'visual', type: 'PROGRESS', metricType: 'carga', exerciseName: 'Bíceps', exerciseKey: 'biceps', date: '2026-08-27', createdAt: '2026-08-27T22:09:00Z', currentValue: 25, previousValue: null, sets: 4, repetitions: 8, unit: 'kg', photos: [], achievements: [{ id: 'first', type: 'FIRST_MARK' }] };
function render(Component, values) { states = values; stateIndex = 0; return renderToStaticMarkup(React.createElement(Component)); }
const chunks = '.next/static/chunks';
const css = readdirSync(chunks).filter(file => file.endsWith('.css')).map(file => readFileSync(path.join(chunks, file), 'utf8')).join('\n');
const newStyles = readFileSync('app/globals.css', 'utf8').split('/* Scoped light surfaces:')[1];
assert.ok(newStyles && !newStyles.includes('html[data-theme="dark"]'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const theme of ['light', 'dark']) for (const accent of ['#D4A72C', '#22C55E']) for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const variables = Object.entries(branding.workspaceBrandingVariables(accent)).map(([key, value]) => `${key}:${value}`).join(';');
    for (const [period, label] of [['current-month', 'Este mes'], ['previous-month', 'Mes anterior'], ['last-30-days', 'Últimos 30 días']]) for (const expanded of [false, true]) {
      const data = { period: { label }, percentage: 40, total: 5, completedDays: 2, present: 2, absent: 2, justified: 1, records: [] };
      const attendance = render(PortalAttendanceView, [period, data, false, '']);
      const records = render(QuickLogHistory, [[log], false, '', '', '', '', '', '', false, null, 'exercises', expanded ? 'biceps' : '']);
      assert.ok(records.includes('portal-record-group'), records);
      const content = attendance + records + render(Warning, []);
      await page.setContent(`<html data-theme="${theme}"><head><style>${css}</style></head><body><div class="workspace-brand" style="${variables}"><main class="mx-auto max-w-6xl p-2.5 pb-[calc(var(--portal-bottom-nav-height)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-clearance)+env(safe-area-inset-bottom))] sm:p-6 md:pb-12">${content}</main><nav class="portal-mobile-nav fixed bottom-[calc(env(safe-area-inset-bottom)+var(--portal-bottom-nav-offset))] left-5 right-5 h-[var(--portal-bottom-nav-height)] md:hidden">Inicio · Rutina · Clases</nav></div></body></html>`);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // System resolves through the production helper to exactly these same tokens.
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate(code => { const exports = {}; new Function('exports', code)(exports); exports.applyAppearance('system'); }, appearanceCode);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        const rgb = color => { context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(); context.fillRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const luminance = color => rgb(color).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const style = selector => { const element = document.querySelector(selector); if (!element) throw new Error(`Missing fixture element: ${selector}`); return getComputedStyle(element); };
        const contrast = (fg, bg) => { const a = luminance(fg), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
        const sample = document.createElement('span'); sample.style.color = bg; document.body.append(sample);
        const surface = getComputedStyle(sample).color; sample.remove();
        return { overflow: document.documentElement.scrollWidth > innerWidth, group: style('.portal-record-group').backgroundImage, summary: style('.portal-attendance-summary').backgroundImage, metric: style('.portal-attendance-metric').backgroundImage, titleContrast: contrast(style('.portal-record-group h2').color, surface), mutedContrast: contrast(style('.portal-record-group p').color, surface), warningContrast: contrast(style('.portal-finish-warning > p').color, style('.portal-finish-warning').backgroundColor), justified: style('.portal-attendance-metric:nth-child(3) p:last-child').color, historyColor: style('.portal-record-group button').color, dateColor: style('.portal-record-filters input[type=date]').color, ring: style('.portal-attendance-ring').borderColor };
      });
      assert.equal(result.overflow, false, `${theme}/${width}: overflow`);
      assert.equal(await page.locator('.portal-record-group article').count(), expanded ? 1 : 0);
      assert.equal(await page.locator('input[type=date]').count(), 2);
      assert.equal(await page.locator('input[type=date]').first().inputValue(), '');
      assert.ok((await page.locator('.portal-attendance-summary').innerText()).includes(label));
      if (theme === 'light') {
        for (const key of ['group', 'summary', 'metric']) assert.ok(result[key].includes('255, 255, 255'), key);
        assert.ok(result.titleContrast >= 4.5 && result.mutedContrast >= 4.5, JSON.stringify(result));
        assert.ok(result.warningContrast >= 4.5, JSON.stringify(result));
        assert.equal(result.justified, 'rgb(150, 96, 0)');
      } else {
        assert.ok(result.group.includes('11, 11, 11') && result.summary.includes('10, 10, 10'));
        assert.equal(result.warningContrast > 4.5, true);
      }
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      if (width < 768) {
        const warningBox = await page.locator('.portal-finish-warning').boundingBox(), navBox = await page.locator('nav').boundingBox();
        assert.ok(warningBox.y + warningBox.height <= navBox.y, 'last content clears bottom navigation');
      }
      if (width === 390 && accent === '#D4A72C' && period === 'current-month' && expanded) {
        await page.evaluate(() => { document.body.style.fontFamily = 'Arial, sans-serif'; document.querySelector('.portal-record-group').scrollIntoView(); });
        await page.screenshot({ path: `.portal-surfaces-${theme}.png` });
      }
    }
    console.log(`${theme}, ${accent}, ${width}px: all periods, closed/open history, contrast, filters and nav clearance OK`);
    await page.close();
  }
} finally { await browser.close(); }
