// Visual regression checks using the actual monthly-review JSX and trainer classes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = createRequire(path.join(process.env.BM_TEST_NODE_MODULES, 'playwright/package.json'))('playwright');
function compile(source) {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const source = readFileSync('app/resumen-mensual/page.tsx', 'utf8');
const ast = ts.createSourceFile('monthly.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['DataReview', 'DetailTable', 'RowPlan', 'compactDate'];
const fragments = ast.statements.filter(n => (ts.isFunctionDeclaration(n) && names.includes(n.name.text)) || (ts.isVariableStatement(n) && /^(const money|const serviceLabels)/.test(n.getText(ast)))).map(n => n.getText(ast));
const { DataReview, DetailTable } = compile(`${fragments.join('\n')}\nexport { DataReview, DetailTable };`);
const students = readFileSync('app/alumnos/page.tsx', 'utf8');
const dashboard = readFileSync('app/dashboard/page.tsx', 'utf8');
const inactive = students.match(/"(trainer-neutral-status bm-status bm-status-neutral)"/)[1];
const unconfigured = dashboard.match(/SIN_CONFIGURAR:.*className: "([^"]+)"/)[1];
const columnsJsx = students.match(/<thead className="trainer-table-heading[^>]*>.*?<\/thead>/)[0];
const { Columns } = compile(`export function Columns() { return ${columnsJsx}; }`);
const columns = renderToStaticMarkup(React.createElement(Columns));
const filters = students.match(/<div className="(trainer-panel-filters[^"]+)"/)[1];
const search = students.match(/<label className="(flex min-h-11[^"]+)"/)[1];
const month = source.match(/<section className="(trainer-month-filters[^"]+)"/)[1];
const data = { warnings: ['No disponible: este dato no se registraba históricamente.'], dataReview: {
  membershipsWithoutAmount: [{ membershipId: 'm', studentName: 'Alumno de prueba', serviceType: 'MIXED', planName: 'Plan mixto', frequencyDays: 2, startDate: '2026-10-01', endDate: null, amount: null, reason: 'Importe no registrado.' }],
  activityWithoutObligation: [{ studentId: 's', studentName: 'Alumno de prueba', serviceType: 'PERSONALIZED', studentStatus: 'activo', reason: 'Sin obligación registrada.', membershipStatus: null, membershipAmount: null, membershipStartDate: null, activity: ['Asistencia registrada'] }],
  missingObligationCauses: [{ cause: 'missing', count: 1, label: 'Sin historial' }]
} };
const row = { studentId: 's', studentName: 'Alumno de prueba', collectedAmount: 0, attendancePresent: 2, planName: 'Plan mixto', serviceType: 'MIXED', frequencyDays: 2, paymentStatus: 'Sin obligación' };
const review = renderToStaticMarkup(React.createElement(DataReview, { data }));
const table = renderToStaticMarkup(React.createElement(DetailTable, { rows: [row], onSelect() {} }));
const css = readdirSync('.next/static/chunks').filter(f => f.endsWith('.css')).map(f => readFileSync(path.join('.next/static/chunks', f), 'utf8')).join('\n');
const branding = compile(readFileSync('lib/workspace-branding.ts', 'utf8'));
const appearance = ts.transpileModule(readFileSync('lib/appearance.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const theme of ['light', 'dark']) for (const accent of ['#D4A72C', '#EF4444']) for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.emulateMedia({ colorScheme: theme });
    const variables = Object.entries(branding.workspaceBrandingVariables(accent)).map(([k,v]) => `${k}:${v}`).join(';');
    await page.setContent(`<html><head><style>${css}</style></head><body><main class="admin-panel workspace-brand p-4" style="${variables};padding-top:96px"><section class="${month}"><button>Mes anterior</button></section>${review}<section class="trainer-student-list"><div class="${filters}"><label class="${search}"><input placeholder="Buscar alumno"></label><select><option>Todos los estados</option></select></div><div class="hidden overflow-x-auto md:block"><table class="min-w-[960px]">${columns}<tbody><tr><td>Alumno</td></tr></tbody></table></div></section><div class="hidden overflow-x-auto md:block">${table}</div><span class="rounded-full px-2 py-1 text-xs font-bold ${inactive}">Inactivo</span><span class="rounded-full px-2 py-1 text-xs font-bold ${unconfigured}">Sin configurar</span></main></body></html>`);
    for (const preference of [theme, 'system']) {
      await page.evaluate(({code, preference}) => { const exports = {}; new Function('exports', code)(exports); exports.applyAppearance(preference); }, {code: appearance, preference});
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      await page.locator('.trainer-data-review').evaluate(e => { e.open = true; });
      const result = await page.evaluate(() => {
        const style = e => getComputedStyle(e);
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d');
        const luminance = color => { ctx.fillStyle = color; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0); };
        const contrast = (a,b) => { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
        const review = document.querySelector('.trainer-data-review'), neutral = document.querySelector('.trainer-neutral-status');
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          heading: style(document.querySelector('.trainer-table-heading')).backgroundColor,
          headings: [...document.querySelectorAll('.trainer-table-heading')].map(e => style(e).backgroundColor),
          neutral: style(neutral).backgroundColor,
          filter: style(document.querySelector('.trainer-panel-filters')).backgroundColor,
          contrast: [review.querySelector('summary'), review.querySelector('summary span'), review.querySelector('p'), review.querySelector('ul')].map(e => contrast(style(e).color, style(review).backgroundColor)),
          colors: [...review.querySelectorAll('details summary')].map(e => [style(e).color,style(e.parentElement).backgroundColor]), innerContrast: [...review.querySelectorAll('details summary')].map(e => contrast(style(e).color, style(e.parentElement).backgroundColor)),
          neutralContrast: contrast(style(neutral).color, style(neutral).backgroundColor)
        };
      });
      assert.equal(result.overflow, false, JSON.stringify({theme,accent,width,result}));
      if (theme === 'light') {
        assert.equal(result.headings.length, 2);
        for (const background of result.headings) assert.equal(background, 'rgb(240, 239, 235)');
        assert.equal(result.neutral, 'rgb(240, 239, 235)');
        assert.equal(result.filter, 'rgb(255, 254, 250)');
        for (const value of [...result.contrast,...result.innerContrast,result.neutralContrast]) assert.ok(value >= 4.5, JSON.stringify(result));
      } else {
        assert.equal(result.heading, 'rgba(0, 0, 0, 0.42)');
        assert.notEqual(result.neutral, 'rgb(240, 239, 235)');
      }
      await page.locator('.trainer-data-review details').evaluateAll(nodes => nodes.forEach(e => { e.open = true; }));
      assert.equal(await page.getByText('Importe no registrado.', {exact: true}).isVisible(), true);
      if (process.env.BM_CAPTURE_CONTRAST && accent === '#D4A72C' && preference === theme && [390,1280].includes(width)) await page.screenshot({path: `.contrast-${theme}-${width}.png`, fullPage: true});
      await page.locator('.trainer-data-review').evaluate(e => { e.open = false; });
      assert.equal(await page.getByText('Importe no registrado.', {exact: true}).isVisible(), false);
    }
    console.log(`${theme}/${accent}/${width}px: direct/system appearance, contrast, headers, neutral badges, disclosure and overflow OK`);
    await page.close();
  }
} finally { await browser.close(); }
