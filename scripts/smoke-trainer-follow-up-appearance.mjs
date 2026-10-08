// Actual drawer, rows and charts; synthetic data, no API/database writes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = createRequire(path.join(process.env.BM_TEST_NODE_MODULES, 'playwright/package.json'))('playwright');
function compile(file, resolve = require, suffix = '') {
  const code = ts.transpileModule(readFileSync(file, 'utf8') + suffix, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolve, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const factory = compile('componentes/icons/bm-premium/icon.tsx');
const icons = { ...compile('componentes/icons/bm-premium/core.tsx', name => name === './icon' ? factory : require(name)), ...compile('componentes/icons/bm-premium/support.tsx', name => name === './icon' ? factory : require(name)) };
const charts = compile('componentes/routine-follow-up-charts.tsx');
const avatars = compile('lib/profile-avatars.ts');
const branding = compile('lib/workspace-branding.ts');
const { StudentDrawer, StudentRow } = compile('componentes/routine-follow-up-dashboard.tsx', name => {
  if (name === '@/componentes/icons') return icons;
  if (name === '@/componentes/student-photo') return { StudentPhoto: props => React.createElement('img', props) };
  if (name === '@/componentes/routine-follow-up-charts') return charts;
  if (name === '@/lib/profile-avatars') return avatars;
  if (name.startsWith('@/')) return {};
  return require(name);
}, '\nexport { StudentDrawer, StudentRow };');
const session = { id: 'fixture', date: '2026-10-06', routine: 'Mi plan', dayNumber: 1, durationMinutes: 70, status: 'completed', exerciseCount: 4, completedSets: 8, exercises: [], hasPain: false };
const student = { studentName: 'Brian Martinez', state: 'attention', activeRoutine: { name: 'Mi plan', location: 'Salón' }, sessionCount: 5, averageDuration: 70, exerciseCount: 20, completedSets: 52, compliancePercentage: 33, expectedSessionCount: 15, latestSession: session };
const detail = { initialProfile: { birthDate: '1998-12-03', height: 170, weight: 73, goal: 'Bajar grasa', experienceLevel: 'Intermedio', trainingExperience: 'Más de 3 años', limitations: 'Aductor izquierdo', updatedAt: '2026-10-06T12:00:00Z' }, sessions: [session], evaluations: [], blockDistribution: [{ label: 'Fuerza', count: 5 }], exerciseProgress: [{ exerciseId: 'exercise', name: 'Sentadillas con barra', points: [{ date: '2026-09-01', weight: 48, repetitions: 12 }, { date: '2026-09-29', weight: 40, repetitions: 10 }] }] };
const chunks = '.next/static/chunks';
const css = readdirSync(chunks).filter(file => file.endsWith('.css')).map(file => readFileSync(path.join(chunks, file), 'utf8')).join('\n');
const appearanceCode = ts.transpileModule(readFileSync('lib/appearance.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const theme of ['light', 'dark']) for (const accent of ['#D4A72C', '#22C55E']) for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    await page.emulateMedia({ colorScheme: theme });
    const variables = Object.entries(branding.workspaceBrandingVariables(accent)).map(([key, value]) => `${key}:${value}`).join(';');
    for (const tab of ['resumen', 'sesiones', 'progreso', 'molestias']) {
      const content = renderToStaticMarkup(React.createElement(StudentRow, { student, open() {} })) + renderToStaticMarkup(React.createElement(StudentDrawer, { student, detail, tab, loading: false, error: '', retry() {}, setTab() {}, close() {}, openSession() {}, suspended: false }));
      await page.setContent(`<html data-theme="${theme}"><head><style>${css}</style></head><body><div class="workspace-brand admin-panel" style="${variables}">${content}</div></body></html>`);
      await page.evaluate(code => { const exports = {}; new Function('exports', code)(exports); exports.applyAppearance('system'); }, appearanceCode);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      const dialog = page.getByRole('dialog');
      assert.equal(await page.getByRole('button', { name: 'Cerrar seguimiento' }).isVisible(), true);
      assert.equal(await dialog.getByText('Necesita atención', { exact: true }).count(), 1);
      const result = await dialog.evaluate(element => {
        const style = e => getComputedStyle(e);
        const header = element.querySelector('header'), tabs = [...header.querySelectorAll('[role=tab]')];
        return { background: style(element).backgroundColor, header: style(header).backgroundColor, title: style(header.querySelector('h2')).color, close: style(header.querySelector('button')).color, secondary: style(header.querySelector('h2 + p')).color, selected: tabs.filter(e => e.getAttribute('aria-selected') === 'true').length, active: style(tabs.find(e => e.getAttribute('aria-selected') === 'true')).color, activeBorder: style(tabs.find(e => e.getAttribute('aria-selected') === 'true')).borderBottomColor, badge: style(header.querySelector('span')).color, overflow: element.scrollWidth > element.clientWidth || document.documentElement.scrollWidth > innerWidth, card: style(element.querySelector('article')).backgroundColor };
      });
      assert.equal(result.overflow, false, JSON.stringify({ theme, width, tab, result }));
      assert.equal(result.selected, 1);
      if (theme === 'light') {
        assert.equal(result.background, 'rgb(245, 244, 240)');
        assert.equal(result.title, 'rgb(30, 32, 37)');
        assert.equal(result.secondary, 'rgb(98, 102, 110)');
        assert.equal(result.close, 'rgb(98, 102, 110)');
        assert.equal(result.badge, 'rgb(188, 52, 58)');
        assert.equal(result.card, 'rgb(255, 255, 255)');
      } else {
        assert.equal(result.background, 'rgb(11, 11, 13)');
        const headerPixel = await page.evaluate(color => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; }, result.header);
        assert.ok(headerPixel.every((value, index) => Math.abs(value - [11, 11, 13, 242][index]) <= 1), JSON.stringify(headerPixel));
      }
      assert.equal(result.activeBorder, accent === '#D4A72C' ? 'rgb(212, 167, 44)' : 'rgb(34, 197, 94)');
      if (tab === 'molestias') assert.equal(await dialog.getByText('No hay molestias registradas.', { exact: true }).count(), 1);
      if (tab === 'sesiones') assert.equal(await dialog.getByText('Ver detalle', { exact: true }).count(), 1);
      if (tab === 'progreso') {
        assert.equal(await dialog.locator('select option').first().textContent(), 'Sentadillas con barra');
        assert.equal(await dialog.locator('polyline').getAttribute('points'), '0,12 320,108');
        assert.equal(await dialog.locator('polyline').getAttribute('stroke'), '#facc15');
      }
    }
    console.log(`${theme}/${accent}/${width}px: four tabs, header, cards, badge, close, charts and overflow OK`);
    await page.close();
  }
} finally { await browser.close(); }
