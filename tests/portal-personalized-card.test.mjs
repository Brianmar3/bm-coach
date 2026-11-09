import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('../componentes/portal-section.tsx', import.meta.url), 'utf8');
const fragment = source.slice(source.indexOf('function personalizedHomePlan'), source.indexOf('function WeeklyObjective'));
const code = ts.transpileModule(fragment, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const Frame = ({ children }) => React.createElement('section', null, children);
const Link = ({ children, ...props }) => React.createElement('a', props, children);
const Icon = () => null;
const { planFor, Card } = new Function('React', 'getWeekKey', 'sessionBelongsToWeek', 'usefulDayName', 'cleanRoutineDisplayName', 'PortalRoutineFrame', 'Link', 'BmDumbbellIcon', 'BmPlayIcon', code + '\nreturn {planFor:personalizedHomePlan,Card:RoutineHomeCard};')(
  React, () => 'current', session => session.week === 'current', (_number, name) => name, name => name, Frame, Link, Icon, Icon,
);
const day = { id: 'day-1', dayNumber: 1, name: 'Tren inferior', objective: 'Fuerza', estimatedMinutes: 50, blocks: [{ exercises: [{}, {}, {}] }] };
const data = (sessions = [], days = [day]) => ({ routine: { id: 'routine', name: 'Plan real', days }, workoutSessions: sessions });
const session = (status, extra = {}) => ({ routineId: 'routine', dayId: day.id, week: 'current', status, ...extra });
const html = input => renderToStaticMarkup(React.createElement(Card, { plan: planFor(input) }));

test('día pendiente muestra nombre, objetivo, ejercicios y duración asignados', () => {
  const output = html(data());
  for (const text of ['Día 1 · Tren inferior', 'Fuerza', '3 ejercicios programados', '50 min aprox.', 'Pendiente', 'Ver entrenamiento']) assert.ok(output.includes(text));
  assert.ok(!output.includes('sesiones completadas esta semana'));
});
test('sesión en curso continúa el mismo día; finalizada conserva su estado real', () => {
  assert.equal(planFor(data([session('en_progreso')])).status, 'En curso');
  assert.ok(html(data([session('en_progreso')])).includes('Continuar rutina'));
  assert.equal(planFor(data([session('finalizado')])).status, 'Finalizada');
  const nextDay = { ...day, id: 'day-2', dayNumber: 2, name: 'Tren superior' };
  const next = planFor(data([session('finalizado')], [day, nextDay]));
  assert.equal(next.status, 'Pendiente');
  assert.ok(next.title.includes('Tren superior'));
});
test('sesiones de otra rutina o semana no inventan estado actual', () => {
  assert.equal(planFor(data([session('en_progreso', { routineId: 'other' })])).status, 'Pendiente');
  assert.equal(planFor(data([session('finalizado', { week: 'old' })])).status, 'Pendiente');
});
test('sin rutina o días utilizables ofrece un estado vacío sin métricas ficticias', () => {
  assert.ok(html({ routine: null, workoutSessions: [] }).includes('Sin rutina asignada'));
  const output = html(data([], []));
  assert.ok(output.includes('todavía no tiene días disponibles'));
  assert.ok(!output.includes('min aprox.'));
});
test('información incompleta no inventa minutos y no recorta textos', () => {
  const output = html(data([], [{ ...day, objective: '', estimatedMinutes: null }]));
  assert.ok(!output.includes('min aprox.'));
  assert.ok(!output.includes('line-clamp'));
  assert.ok(output.includes('break-words'));
  assert.ok(output.includes('min-h-12 w-full'));
  assert.ok(output.includes('href="/portal/rutina"'));
});
