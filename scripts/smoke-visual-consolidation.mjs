// Read-only rendering of production JSX; no app data, API writes or screenshots.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = createRequire(path.join(process.env.BM_TEST_NODE_MODULES, 'playwright/package.json'))('playwright');
const postcss = require('postcss');
const css = (await postcss([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css', 'utf8'), { from: path.resolve('app/globals.css') })).css;
function compile(source, resolve = require) {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolve, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const iconFactory = compile(readFileSync('componentes/icons/bm-premium/icon.tsx', 'utf8'));
const icons = Object.assign({}, ...['core', 'support'].map(name => compile(readFileSync(`componentes/icons/bm-premium/${name}.tsx`, 'utf8'), id => id === './icon' ? iconFactory : require(id))));
const Link = ({ children, ...props }) => React.createElement('a', props, children);
const dependencies = { ...icons, Link, StudentPhoto: props => React.createElement('img', props), DEFAULT_PROFILE_AVATAR: { src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E' } };
function extract(file, names, extra = {}) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const statements = ast.statements.filter(node => (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) || (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.includes(d.name.getText(ast)))));
  assert.equal(statements.length, names.length, `Missing production declaration in ${file}`);
  const deps = { ...dependencies, ...extra };
  return compile(`const { ${Object.keys(deps).join(',')} } = require('fixture');\n${statements.map(s => s.getText(ast)).join('\n')}\nexport { ${names.join(',')} };`, id => id === 'fixture' ? deps : require(id));
}
function jsx(file, predicate, deps) {
  const source = readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) { if (!found && ts.isJsxElement(node) && predicate(node.getText(ast), node.openingElement.tagName.getText(ast))) found = node.getText(ast); if (!found) ts.forEachChild(node, visit); }
  visit(ast); assert.ok(found, `Missing production JSX in ${file}`);
  return compile(`const { ${Object.keys(deps).join(',')} } = require('fixture'); export function Fixture(){return ${found};}`, id => id === 'fixture' ? deps : require(id)).Fixture;
}
const shell = extract('componentes/module-shell.tsx', ['ModuleShell', 'inputClass']);
const frames = extract('componentes/portal-visuals.tsx', ['PortalHeroFrame', 'PortalRoutineFrame']);
const home = extract('componentes/portal-section.tsx', ['RoutineHomeCard', 'MonthlyAttendanceIndicator'], { ...frames, useHomeAnimatedValue: value => value });
const nutrition = extract('componentes/nutrition-workspace.tsx', ['PageHeader']);
const nutritionHeader = jsx('componentes/student-nutrition.tsx', (text, tag) => tag === 'header' && text.includes('Tu objetivo:'), { data: { objective: 'Mejorar hábitos', contextStatus: 'FULL' }, NutritionIllustration: () => null, LineIcon: icons.BmCalendarIcon, Link, ...icons });
const evaluation = extract('componentes/professional-evaluations-dashboard.tsx', ['Card', 'Badge', 'ActionButton', 'Stat']);
const studentEvaluation = extract('componentes/portal-evaluations-dashboard.tsx', ['MetricCard']);
const ranking = extract('componentes/portal-ranking.tsx', ['CrownIcon', 'RankBadge', 'RankingRow']);
const dashboard = extract('app/dashboard/page.tsx', ['MetricCard', 'Panel', 'DashboardIcon', 'accountStyle']);
const students = extract('app/alumnos/page.tsx', ['MobileDatum', 'MobileAction']);
const studentStatus = jsx('app/alumnos/page.tsx', (text, tag) => tag === 'span' && text.includes('trainer-neutral-status') && text.includes('item.status'), { item: { status: 'inactivo' } });
const month = extract('app/resumen-mensual/page.tsx', ['StatusBadge', 'Metric', 'TodayCollections', 'money'], { showDate: date => date });
const followUp = extract('componentes/routine-follow-up-dashboard.tsx', ['Metric', 'Status', 'Pagination', 'stateLabels']);
const branding = compile(readFileSync('lib/workspace-branding.ts', 'utf8'));
const appearance = ts.transpileModule(readFileSync('lib/appearance.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const h = React.createElement;
const view = (name, children) => h('div', { 'data-screen': name, className: 'space-y-4' }, ...children);
const noop = () => {};
const portal = [
  view('Home', [h(frames.PortalHeroFrame, {}, h('div', { className: 'relative min-h-36' }, h(home.MonthlyAttendanceIndicator, { data: { home: { monthlyAttendancePercentage: 75, classesAttendedThisMonth: 9 } } }))), h(home.RoutineHomeCard, { plan: { target: 4, completed: 2, available: true, title: 'Fuerza y movilidad' } })]),
  view('Nutrición', [h(nutritionHeader), h(nutrition.PageHeader, { title: 'Plan semanal', description: 'Tus comidas de esta semana' })]),
  view('Evaluaciones alumno', [h(studentEvaluation.MetricCard, { icon: icons.BmWeightIcon, label: 'Peso actual', display: '72 kg' })]),
  view('Ranking', [h('ol', {}, h(ranking.RankingRow, { entry: { studentId: 'a', position: 4, studentName: 'Alumno de prueba', total: 240 }, currentStudentId: 'a', reducedMotion: true, delay: 0 }))]),
];
const trainer = [
  view('Dashboard', [h(dashboard.MetricCard, { label: 'Alumnos activos', value: '24', subtitle: 'Este mes', href: '/alumnos', icon: h(dashboard.DashboardIcon, { name: 'students' }) }), h(dashboard.Panel, { title: 'Resumen' }, ...Object.values(dashboard.accountStyle).map(s => h('span', { key: s.label, className: s.className }, s.label)))]),
  view('Alumnos', [h(studentStatus), h(students.MobileDatum, { icon: h(icons.BmMailIcon, { size: 16 }), label: 'Correo', value: 'alumno@example.test' }), h(students.MobileAction, { icon: h(icons.BmEyeIcon, { size: 16 }), label: 'Ver ficha', action: noop })]),
  view('Evaluaciones entrenador', [h(evaluation.Card, { className: 'bm-card-pad' }, h(evaluation.Badge, { tone: 'gold' }, 'En curso'), h(evaluation.Badge, { tone: 'amber' }, 'Pendiente'), h(evaluation.Stat, { label: 'Peso', value: '72 kg', note: 'Evaluación anterior' }), h(evaluation.ActionButton, { primary: true, onClick: noop }, 'Guardar'), h(evaluation.ActionButton, { onClick: noop }, 'Volver'))]),
  view('Resumen mensual', [h(month.Metric, { label: 'Cobrado', value: '$ 120.000', detail: 'Período actual' }), h(month.StatusBadge, { data: { metadata: { status: 'DRAFT' } } }), h(month.TodayCollections, { data: { metadata: { label: 'Octubre' }, today: { isCurrentPeriod: true, registeredTotal: 1000, registeredCount: 1, selectedPeriodImpactTotal: 1000, totalBeforeToday: 2000, currentTotal: 3000, movements: [] } } })]),
  view('Seguimiento', [h(followUp.Metric, { label: 'Sesiones', value: '12', helper: 'Últimos 30 días' }), ...['on_track', 'attention', 'no_data'].map(state => h(followUp.Status, { key: state, state })), h(followUp.Pagination, { page: 1, pages: 3, count: 15, setPage: noop })]),
];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let cases = 0;
try {
  for (const theme of ['light', 'dark']) for (const accent of ['#D4A72C', '#1E3A8A']) for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const body = renderToStaticMarkup(h(React.Fragment, {}, h('main', { className: 'workspace-brand space-y-6 p-4', style: branding.workspaceBrandingVariables(accent) }, ...portal), h('div', { className: 'workspace-brand admin-panel', style: branding.workspaceBrandingVariables(accent) }, h(shell.ModuleShell, { title: 'Entrenador', subtitle: 'Resumen de actividad' }, ...trainer))));
    await page.setContent(`<html data-theme="${theme}"><head><style>${css}</style></head><body>${body}</body></html>`);
    for (const preference of [theme, 'system']) {
      await page.evaluate(({ appearance, preference }) => { const exports = {}; new Function('exports', appearance)(exports); exports.applyAppearance(preference); }, { appearance, preference });
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      const result = await page.evaluate(() => {
        const style = e => getComputedStyle(e);
        const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
        const rgb = c => { ctx.clearRect(0,0,1,1); ctx.fillStyle = c; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data].slice(0,3); };
        const lum = c => rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
        const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
        const surfaces = [...document.querySelectorAll('.bm-surface')].map(e => ({ radius: style(e).borderRadius, background: style(e).backgroundColor, image: style(e).backgroundImage }));
        const primary = document.querySelector('.bm-button-primary');
        const badge = document.querySelector('[data-screen="Ranking"] .absolute.-top-3');
        const muted = [...document.querySelectorAll('[data-screen] [class*="text-[var(--foreground-muted)]"]')];
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          surfaces,
          primaryContrast: ratio(style(primary).color, style(primary).backgroundColor),
          statusContrast: [...document.querySelectorAll('.bm-status')].map(e => ({ text: e.textContent, ratio: ratio(style(e).color, style(e).backgroundColor) })),
          rankingContrast: ratio(style(badge).color, style(badge).backgroundColor),
          mutedMin: Math.min(...muted.map(e => parseFloat(style(e).fontSize))),
          mutedContrast: Math.min(...muted.map(e=>ratio(style(e).color, style(e).getPropertyValue('--surface').trim()))),
          icons: [...document.querySelectorAll('[data-screen="Dashboard"] svg, [data-screen="Seguimiento"] svg')].every(e => e.hasAttribute('data-bm-icon')),
          ring: style(document.querySelector('[data-screen="Home"] [style*="conic-gradient"]')).backgroundImage,
          accent: style(primary).backgroundColor,
        };
      });
      const context = JSON.stringify({ theme, accent, width, preference, result });
      assert.equal(result.overflow, false, context);
      assert.ok(result.surfaces.length >= 8, context);
      assert.ok(result.surfaces.every(s=>s.radius==='16px' && s.image==='none'), context);
      assert.ok(result.primaryContrast >= 4.5, context);
      assert.ok(result.rankingContrast >= 4.5, context);
      assert.ok(result.statusContrast.every(s=>s.ratio >= 4.5), context);
      assert.ok(result.mutedMin >= 11 && result.mutedContrast >= 4.5, context);
      assert.ok(result.icons, context);
      assert.ok(result.ring.includes(result.accent), context);
      assert.equal(await page.getByRole('link', { name: 'Empezar rutina' }).getAttribute('href'), '/portal/rutina');
      assert.equal(await page.getByRole('button', { name: 'Página anterior', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Página siguiente', exact: true }).isEnabled(), true);
      cases++;
    }
    console.log(`${theme}/${accent}/${width}: surfaces, contrast, typography, icons and controls OK`);
    await page.close();
  }
  console.log(`${cases} appearance/viewport cases passed; production JSX, no screenshots or API writes.`);
} finally { await browser.close(); }
