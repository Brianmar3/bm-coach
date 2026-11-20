const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

test('el arrastre de horarios reutiliza vista visible, destino y auto-scroll para mouse y toque', () => {
  const page = fs.readFileSync(path.join(__dirname, '../app/clases/page.tsx'), 'utf8');
  const hook = fs.readFileSync(path.join(__dirname, '../componentes/use-touch-class-copy.ts'), 'utf8');
  assert.match(page, /data-schedule-day=\{day\.value\}/);
  assert.match(page, /drag\.startMouse\(event\)/);
  assert.match(page, /drag\.start\(event, schedule\.id\)/);
  assert.match(page, /studentIds: \[\]/);
  assert.match(page, /onDrop=\{\(event\) => \{ event\.preventDefault\(\);/);
  assert.match(hook, /document\.body\.appendChild\(preview\)/);
  const mouseDrag = hook.slice(hook.indexOf('function startMouse'), hook.indexOf('function start(event:'));
  assert.match(mouseDrag, /setDragImage\(event\.currentTarget/);
  assert.doesNotMatch(mouseDrag, /createPreview\(/);
  assert.match(hook, /window\.scrollBy\(0, speed\)/);
  const js = ts.transpileModule(hook, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const dom = new JSDOM('<div data-schedule-day="MONDAY"><article id="source">Funcional</article></div><div data-schedule-day="TUESDAY"></div>');
  const previous = { window: global.window, document: global.document, HTMLElement: global.HTMLElement };
  Object.assign(global, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
  try {
    const module = { exports: {} };
    new Function('require', 'module', 'exports', js)(require, module, module.exports);
    assert.equal(typeof module.exports.useTouchClassCopy, 'function');
    assert.equal(module.exports.edgeScrollSpeed(590, 0, 600) > 0, true);
    assert.equal(module.exports.edgeScrollSpeed(10, 0, 600) < 0, true);
  } finally {
    Object.assign(global, previous);
    dom.window.close();
  }
});
