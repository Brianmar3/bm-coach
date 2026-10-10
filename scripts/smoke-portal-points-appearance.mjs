// Production JSX with read-only fixtures; no API writes or screenshots.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = createRequire(path.join(process.env.BM_TEST_NODE_MODULES, 'playwright/package.json'))('playwright');
function compile(source, resolve = require) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', output)(resolve, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const factory = compile(readFileSync('componentes/icons/bm-premium/icon.tsx', 'utf8'));
const icons = Object.assign({}, ...['core', 'support'].map(name => compile(readFileSync(`componentes/icons/bm-premium/${name}.tsx`, 'utf8'), id => id === './icon' ? factory : require(id))));
const Link = ({ children, ...props }) => {
  delete props.onNavigate; delete props.replace;
  return React.createElement('a', props, children);
};
let backCalls = 0;
const { PortalPointsBackLink } = compile(readFileSync('componentes/portal-points-back-link.tsx', 'utf8'), id => {
  if (id === 'next/link') return { default: Link };
  if (id === 'next/navigation') return { useRouter: () => ({ back: () => backCalls++ }) };
  if (id === '@/componentes/icons') return icons;
  return require(id);
});
// Exercise the production onNavigate handler, including safe deep-link fallback.
const back = PortalPointsBackLink();
assert.equal(back.props.href, '/portal/puntos'); assert.equal(back.props.replace, true);
for (const previous of ['https://bm.test/portal/puntos', 'https://bm.test/portal', 'https://other.test/portal/puntos', null]) {
  globalThis.window = { location: { origin: 'https://bm.test' }, navigation: { currentEntry: { index: 1 }, entries: () => [{ url: previous }, {}] } };
  let prevented = false;
  const before = backCalls;
  back.props.onNavigate({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, previous === 'https://bm.test/portal/puntos');
  assert.equal(backCalls - before, prevented ? 1 : 0);
}
globalThis.window = { location: { origin: 'https://bm.test' } };
back.props.onNavigate({ preventDefault: () => assert.fail('unsupported browser must use parent link') });
delete globalThis.window;
const deps = { ...icons, Link, PortalPointsBackLink, HomeAnimatedNumber: ({ value }) => value, date: () => '29/9/2026', StudentPhoto: props => React.createElement('img', props), DEFAULT_PROFILE_AVATAR: { src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E' } };
function extract(file, names, extra = {}) {
  const source = readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  assert.equal(nodes.length, names.length);
  const scope = { ...deps, ...extra };
  return compile(`const {${Object.keys(scope).join(',')}}=require('fixture');\n${nodes.map(n => n.getText(ast)).join('\n')}\nexport {${names.join(',')}};`, id => id === 'fixture' ? scope : require(id));
}
const points = extract('componentes/portal-section.tsx', ['PointsSummary', 'AchievementCard', 'achievementIcon', 'achievementLevelLabel']);
let fixtureToday = '2026-10-10';
const home = extract('componentes/portal-section.tsx', ['HomeQuickStats'], {
  isCompetitiveGamificationEligible: compile(readFileSync('lib/student-service.ts', 'utf8')).isCompetitiveGamificationEligible,
  homePaymentCardCopy: compile(readFileSync('lib/home-payment-card.ts', 'utf8')).homePaymentCardCopy,
  argentinaDateKey: () => fixtureToday,
  useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect: () => {},
  PORTAL_STAT_CARD_CLASS: readFileSync('componentes/portal-visuals.tsx', 'utf8').match(/PORTAL_STAT_CARD_CLASS = "([^"]+)"/)[1],
});
const pointCases = [
  { name: 'historical only', today: '2026-10-10', total: 24, monthlyTotal: 0, weekly: 0, recent: [] },
  { name: 'monthly points', today: '2026-10-10', total: 31, monthlyTotal: 7, weekly: 7, recent: [{ points: 7, occurredAt: '2026-10-09T12:00:00Z' }] },
  { name: 'no points', today: '2026-10-10', total: 0, monthlyTotal: 0, weekly: 0, recent: [] },
  { name: 'before month change', today: '2026-09-30', total: 24, monthlyTotal: 12, weekly: 2, recent: [{ points: 2, occurredAt: '2026-09-30T12:00:00Z' }] },
  { name: 'after month change, same week', today: '2026-10-01', total: 24, monthlyTotal: 0, weekly: 2, recent: [{ points: 2, occurredAt: '2026-09-30T12:00:00Z' }] },
  { name: 'after week change, same month', today: '2026-10-12', total: 31, monthlyTotal: 7, weekly: 0, recent: [{ points: 7, occurredAt: '2026-10-09T12:00:00Z' }] },
];
const historyHeader = extract('componentes/portal-section.tsx', ['PointsHistoryPageView'], { PointsHistory: () => null });
const { PortalNavigationLink } = extract('componentes/portal-visuals.tsx', ['PortalNavigationLink']);
const navClass = readFileSync('componentes/portal-visuals.tsx', 'utf8').match(/PORTAL_MOBILE_NAV_CLASS = "([^"]+)"/)[1];
const mainClass = readFileSync('componentes/portal-shell.tsx', 'utf8').match(/<main key=\{pathname\} className="([^"]+)"/)[1];
const rankingData = { currentStudentId: '6', currentPosition: 7, currentPoints: 0, ranking: Array.from({ length: 7 }, (_, i) => ({ studentId: String(i), studentName: `Alumno ${i + 1}`, total: 43 - i, profileImageUrl: deps.DEFAULT_PROFILE_AVATAR.src })) };
let stateIndex = 0;
const ranking = extract('componentes/portal-ranking.tsx', ['PortalRanking', 'RankingRow', 'RankBadge', 'CrownIcon', 'SummaryShield', 'RankingSkeleton'], { FEATURED_RANKING_SIZE: 5, useState: () => [stateIndex++ === 0 ? rankingData : '', () => {}], useEffect: () => {}, useMemo: fn => fn(), useReducedMotion: () => true, useAnimatedPoints: value => value });
const branding = compile(readFileSync('lib/workspace-branding.ts', 'utf8'));
const postcss = require('postcss');
const compileCss = async source => (await postcss([require('@tailwindcss/postcss')()]).process(source, { from: path.resolve('app/globals.css') })).css;
const css = await compileCss(readFileSync('app/globals.css', 'utf8'));
const oldCss = await compileCss(execFileSync('git', ['show', 'HEAD:app/globals.css'], { encoding: 'utf8' }));
const h = React.createElement;
const data = { home: { points: { total: 24, monthlyTotal: 0, nextTarget: 50, pointsToNextTarget: 26 } } };
const achievements = [5, 10, 25, 50].map((target, i) => ({ id: String(i), name: `${target} entrenamientos completados`, description: `Completaste ${target} entrenamientos.`, category: 'RUTINAS', unlocked: i === 0, target, progress: 5, level: i === 0 ? 'COMUN' : i === 3 ? 'ESPECIAL' : 'DESTACADO' }));
stateIndex = 0;
const markup = renderToStaticMarkup(h('div', {}, h(points.PointsSummary, { data, ranking: rankingData }), h('div', { className: 'mt-4 space-y-2' }, ...achievements.map(a => h(points.AchievementCard, { key: a.id, achievement: a }))), h(ranking.PortalRanking), h(historyHeader.PointsHistoryPageView, { data })));
const nav = renderToStaticMarkup(h('nav', { className: navClass, style: { gridTemplateColumns: 'repeat(5,minmax(0,1fr))' } }, h(PortalNavigationLink, { title: 'Inicio', href: '/portal', Icon: icons.BmHomeIcon, active: false })));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let cases = 0;
try {
  // Real browser history plus the production handler (without mounting app data providers).
  const flow = await browser.newPage({ viewport: { width: 390, height: 850 } });
  const parentHref = readFileSync('componentes/portal-section.tsx', 'utf8').split('function HomeQuickStats')[1].match(/competitive \? <Link href="([^"]+)"/)[1];
  await flow.route('https://bm.test/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const content = pathname === '/portal' ? `<a href="${parentHref}">Tus puntos</a>` : pathname === '/portal/puntos' ? renderToStaticMarkup(h(points.PointsSummary, { data, ranking: rankingData })) + '<a href="/portal">Inicio</a>' : renderToStaticMarkup(h(PortalPointsBackLink));
    const script = `const router={back:()=>history.back()};const onNavigate=${back.props.onNavigate.toString()};const link=document.querySelector('.portal-points-back');if(link)link.onclick=event=>{event.preventDefault();let prevented=false;onNavigate({preventDefault:()=>{prevented=true}});if(!prevented)location.replace(link.href);};`;
    return route.fulfill({ contentType: 'text/html', body: `<html><body>${content}<script>${script}</script></body></html>` });
  });
  await flow.goto('https://bm.test/portal');
  await flow.getByRole('link', { name: 'Tus puntos' }).click();
  await flow.waitForURL('https://bm.test/portal/puntos');
  await flow.evaluate(() => history.replaceState({ preserved: 'points-entry' }, ''));
  await flow.getByRole('link', { name: 'Ver ranking mensual' }).click();
  await flow.waitForURL('https://bm.test/portal/ranking');
  await flow.getByRole('link', { name: 'Volver a Puntos y logros' }).click();
  await flow.waitForURL('https://bm.test/portal/puntos');
  assert.equal(await flow.evaluate(() => history.state.preserved), 'points-entry');
  await flow.getByRole('link', { name: 'Ver ranking mensual' }).click();
  await flow.waitForURL('https://bm.test/portal/ranking');
  await flow.goBack();
  await flow.waitForURL('https://bm.test/portal/puntos');
  await flow.getByRole('link', { name: 'Inicio', exact: true }).click();
  await flow.waitForURL('https://bm.test/portal');
  await flow.close();
  const deep = await browser.newPage();
  await deep.route('https://bm.test/**', route => route.fulfill({ contentType: 'text/html', body: `<html><body>${renderToStaticMarkup(h(PortalPointsBackLink))}<script>const router={back:()=>history.back()};const onNavigate=${back.props.onNavigate.toString()};document.querySelector('a').onclick=e=>{e.preventDefault();let stopped=false;onNavigate({preventDefault:()=>stopped=true});if(!stopped)location.replace('/portal/puntos');};</script></body></html>` }));
  await deep.goto('https://bm.test/portal/ranking');
  await deep.getByRole('link', { name: 'Volver a Puntos y logros' }).click();
  await deep.waitForURL('https://bm.test/portal/puntos');
  assert.equal(await deep.evaluate(() => navigation.entries().some(e => e.url?.endsWith('/portal/ranking'))), false, 'deep link must replace child to avoid a back loop');
  await deep.close();
  for (const theme of ['light', 'dark', 'system-light', 'system-dark']) for (const accent of ['#D4A72C', '#1E3A8A']) for (const width of [320, 390, 1280]) {
    const resolved = theme.endsWith('dark') ? 'dark' : theme === 'dark' ? 'dark' : 'light';
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce', colorScheme: resolved });
    const vars = Object.entries(branding.workspaceBrandingVariables(accent)).map(([k, v]) => `${k}:${v}`).join(';');
    const html = sheet => `<html data-theme="${resolved}"><head><style>${sheet}</style></head><body><div class="workspace-brand" style="${vars}"><main class="${mainClass}">${markup}</main>${nav}</div></body></html>`;
    const surfaces = '.portal-points-summary,.portal-achievement-card,.portal-achievement-icon,.portal-achievement-badge,.portal-points-track,.portal-points-fill,.portal-ranking-summary,.portal-ranking-row';
    const snapshot = () => page.locator(surfaces).evaluateAll(elements => elements.map(e => { const s = getComputedStyle(e); return [s.backgroundColor, s.backgroundImage, s.color, s.borderColor, s.boxShadow]; }));
    let darkBefore;
    if (resolved === 'dark') { await page.setContent(html(oldCss)); darkBefore = await snapshot(); }
    for (const scenario of pointCases) {
      fixtureToday = scenario.today;
      const fixture = { profile: { serviceType: 'CLASSES' }, paymentAccount: { status: 'SIN_PAGOS', nextDueDate: '' }, home: { points: { ...scenario, nextTarget: 50, pointsToNextTarget: 50 - scenario.total } } };
      const content = renderToStaticMarkup(h('div', {}, h(home.HomeQuickStats, { data: fixture }), h(points.PointsSummary, { data: fixture, ranking: { currentPosition: 35 } })));
      await page.setContent(html(css).replace(markup, content));
      const homePoints = page.locator('.portal-home-points');
      assert.match(await homePoints.getAttribute('aria-label'), new RegExp(scenario.monthlyTotal + ' puntos este mes'));
      assert.equal(await homePoints.locator('p').nth(1).textContent(), String(scenario.monthlyTotal));
      assert.equal(await homePoints.locator('p').nth(2).textContent(), '+' + scenario.weekly + ' esta semana');
      assert.equal(await homePoints.getAttribute('href'), '/portal/puntos');
      const figures = page.locator('.portal-points-summary > div').first();
      assert.equal(await figures.locator('strong').nth(0).textContent(), String(scenario.monthlyTotal));
      assert.equal(await figures.locator('strong').nth(1).textContent(), String(scenario.total));
      assert.match(await figures.locator('div').first().textContent(), /Este mes.*Posición #35/);
      assert.match(await figures.locator('div').last().textContent(), /Total histórico.*Acumulados/);
      const sizes = await figures.locator('strong').evaluateAll(elements => elements.map(e => parseFloat(getComputedStyle(e).fontSize)));
      assert.ok(sizes[0] > sizes[1], 'Monthly score must dominate historical score');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, scenario.name + ': overflow');
      await page.getByText('Objetivo del total histórico', { exact: true }).waitFor();
      assert.match(await page.locator('.portal-points-summary').textContent(), new RegExp((50 - scenario.total) + ' pts restantes'));
      assert.equal(await page.locator('.portal-points-fill').evaluate(e => e.style.width), (scenario.total / 50 * 100) + '%');
    }
    await page.setContent(html(css));
    if (theme.startsWith('system')) {
      const appearance = ts.transpileModule(readFileSync('lib/appearance.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
      await page.evaluate(code => { const exports = {}; new Function('exports', code)(exports); exports.applyAppearance('system'); }, appearance);
      assert.equal(await page.locator('html').getAttribute('data-theme'), resolved);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme}/${accent}/${width}: overflow`);
    assert.equal(await page.getByRole('link', { name: 'Ver ranking mensual' }).getAttribute('href'), '/portal/ranking');
    for (const link of await page.getByRole('link', { name: 'Volver a Puntos y logros' }).all()) {
      assert.equal(await link.getAttribute('href'), '/portal/puntos');
      const control = await link.boundingBox();
      assert.ok(control.width >= 44 && control.height >= 44);
      assert.equal(await link.locator('span').isVisible(), width >= 768);
    }
    if (width < 768) {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      assert.ok(await page.evaluate(() => document.querySelector('main > div').getBoundingClientRect().bottom <= document.querySelector('.portal-mobile-nav').getBoundingClientRect().top), 'content clearance above bottom navigation');
    }
    if (resolved === 'dark') assert.deepEqual(await snapshot(), darkBefore, 'Dark treatment changed');
    else {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); canvas.width = canvas.height = 1;
        const lum = c => { ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [.2126, .7152, .0722][i], 0); };
        const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
        const cards = [...document.querySelectorAll('.portal-points-summary,.portal-achievement-card,.portal-ranking-summary,.portal-ranking-row')];
        return cards.map(e => ({ bg: getComputedStyle(e).backgroundColor, contrast: [...e.querySelectorAll('h4,strong,p')].map(t => contrast(getComputedStyle(t).color, getComputedStyle(e).backgroundColor)) }));
      });
      for (const card of result) { assert.ok(card.bg.includes('255, 255, 255'), JSON.stringify(card)); for (const ratio of card.contrast) assert.ok(ratio >= 4.5, JSON.stringify(card)); }
    }
    await page.close(); cases++;
  }
  console.log(`${cases} appearance cases (6 point/week/month scenarios each) passed: light/dark/system, BM/custom accent, 320/390/1280px, contrast, dark parity, routes and 44px back control. Production back handler: history restoration and safe deep links passed.`);
} finally { await browser.close(); }
