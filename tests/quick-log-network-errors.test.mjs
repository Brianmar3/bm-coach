import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Execute the component's actual handlers with isolated UI/network dependencies.
// This is not a browser or Android smoke test.
const component = readFileSync(new URL('../componentes/quick-log.tsx', import.meta.url), 'utf8');
const start = component.indexOf('  async function remove(log: QuickLog)');
const end = component.indexOf('  return <div>', start);
assert.ok(start >= 0 && end > start, 'QuickLogHistory handlers must be found');
const javascript = ts.transpileModule(component.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function harness(fetch, confirm = true) {
  const errors = [], notices = [];
  let loads = 0;
  const handlers = new Function('fetch', 'window', 'setError', 'setNotice', 'load', 'labels',
    `${javascript}\nreturn { remove, removePhoto };`)(fetch, { confirm: () => confirm },
    value => errors.push(value), value => notices.push(value), async () => { loads++; },
    { PHOTO: { title: 'Foto' } });
  return { handlers, errors, notices, loads: () => loads };
}

for (const operation of ['remove', 'removePhoto']) {
  const invoke = h => h.handlers[operation]({ id: 'log-fixture', title: 'Test', type: 'PHOTO' }, 'photo-fixture');
  test(`${operation}: network failure is caught without confirming deletion`, async () => {
    const h = harness(async () => { throw new TypeError('Failed to fetch'); });
    await invoke(h);
    assert.match(h.errors.at(-1), /No se pudo confirmar.*conexión/);
    assert.match(h.errors.at(-1), /antes de reintentar/);
    assert.deepEqual(h.notices, ['']);
    assert.equal(h.loads(), 0);
  });
  test(`${operation}: malformed response is not reported as success`, async () => {
    const h = harness(async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } }));
    await invoke(h);
    assert.match(h.errors.at(-1), /No se pudo confirmar/);
    assert.deepEqual(h.notices, ['']);
  });
  test(`${operation}: authorization error keeps server message`, async () => {
    const h = harness(async () => ({ ok: false, json: async () => ({ error: 'Acceso denegado.' }) }));
    await invoke(h);
    assert.equal(h.errors.at(-1), 'Acceso denegado.');
    assert.equal(h.loads(), 0);
  });
  test(`${operation}: success refreshes after confirmed response`, async () => {
    const h = harness(async () => ({ ok: true, json: async () => ({ message: 'Confirmado.' }) }));
    await invoke(h);
    assert.equal(h.notices.at(-1), 'Confirmado.');
    assert.equal(h.loads(), 1);
    assert.deepEqual(h.errors, ['']);
  });
  test(`${operation}: cancelled confirmation never sends a request`, async () => {
    const h = harness(async () => { assert.fail('Unexpected request'); }, false);
    await invoke(h);
    assert.deepEqual(h.errors, []);
    assert.deepEqual(h.notices, []);
  });
}
