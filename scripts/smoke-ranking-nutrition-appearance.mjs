// Actual ranking and consent-block JSX with read-only fixture state.
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
const branding = compile('lib/workspace-branding.ts'), avatars = compile('lib/profile-avatars.ts'), navigation = compile('lib/ranking-navigation.ts');
let states = [], stateIndex = 0;
const hooks = { ...React, useEffect() {}, useState: initial => [states[stateIndex++] ?? initial, () => {}] };
const { PointsRanking } = compile('componentes/points-ranking.tsx', name => {
  if (name === 'react') return hooks;
  if (name === 'next/link') return function FixtureLink({ children, ...props }) { return React.createElement('a', props, children); };
  if (name.endsWith('student-photo')) return { StudentPhoto: props => React.createElement('img', props) };
  if (name.endsWith('profile-avatars')) return avatars;
  if (name.endsWith('ranking-navigation')) return navigation;
  return require(name);
});
const source = readFileSync('componentes/student-nutrition.tsx', 'utf8');
const ast = ts.createSourceFile('nutrition.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let consent;
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'section' && node.getText(ast).includes('nutrition-personalization-title')) consent = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast); assert.ok(consent);
const { Consent } = compile('componentes/student-nutrition.tsx', require, `export function Consent() { const consenting=false, enablePersonalization=()=>{}; return ${consent}; }`);
const entries = Array.from({ length: 6 }, (_, i) => ({ studentId: String(i), studentName: `Alumno ${i + 1}`, level: 'Constancia', total: 35 - i, movements: [] }));
const css = readdirSync('.next/static/chunks').filter(file => file.endsWith('.css')).map(file => readFileSync(path.join('.next/static/chunks', file), 'utf8')).join('\n');
const appearanceCode = ts.transpileModule(readFileSync('lib/appearance.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const theme of ['light', 'dark']) for (const accent of ['#D4A72C', '#EF4444']) for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    await page.emulateMedia({ colorScheme: theme });
    const variables = Object.entries(branding.workspaceBrandingVariables(accent)).map(([key, value]) => `${key}:${value}`).join(';');
    for (const period of ['month', '30d', 'total']) {
      states = [period, entries, false, false, 0, false, '', '', false, null]; stateIndex = 0;
      const content = renderToStaticMarkup(React.createElement(Consent)) + renderToStaticMarkup(React.createElement(PointsRanking));
      await page.setContent(`<html data-theme="${theme}"><head><style>${css}</style></head><body><main class="workspace-brand admin-panel p-4" style="${variables}">${content}</main></body></html>`);
      await page.evaluate(code => { const exports = {}; new Function('exports', code)(exports); exports.applyAppearance('system'); }, appearanceCode);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      const result = await page.evaluate(() => {
        const title = document.querySelector('.nutrition-personalization-title'), ranking = document.querySelector('.trainer-points-ranking');
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d');
        const luminance = color => { context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0); };
        const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
        const style = e => getComputedStyle(e);
        return { overflow: document.documentElement.scrollWidth > innerWidth, background: style(ranking).backgroundImage, title: style(ranking.querySelector('p')).color, consentContrast: contrast(style(title).color, style(document.documentElement).getPropertyValue('--background').trim()), subtitle: style(title.nextElementSibling).color };
      });
      assert.equal(result.overflow, false);
      assert.equal(await page.getByRole('button', { name: 'Aceptar y activar', exact: true }).isEnabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Recalcular puntos', exact: true }).isEnabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Ver ranking completo (6)', exact: true }).count(), 1);
      assert.equal(await page.locator('.trainer-points-ranking > ol > li').count(), 5);
      if (theme === 'light') {
        assert.ok(result.background.includes('255, 255, 255'));
        assert.equal(result.title, 'rgb(30, 32, 37)');
        assert.equal(result.subtitle, 'rgb(98, 102, 110)');
        assert.ok(result.consentContrast >= 4.5, JSON.stringify(result));
      } else assert.ok(result.background.includes('11, 11, 11'));
    }
    console.log(`${theme}/${accent}/${width}px: consent contrast, ranking surface, periods, cards, buttons and overflow OK`);
    await page.close();
  }
} finally { await browser.close(); }
