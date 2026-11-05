import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const compile = source => ts.transpileModule(source.replace(/^import .*;\r?\n/gm, "").replace(/export /g, ""), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const homeLoadEvolution = new Function(compile(read("../lib/home-load-evolution.ts")) + ";return homeLoadEvolution;")();
const Link = ({ children, ...props }) => React.createElement("a", props, children);
const Icon = () => null;
const Card = new Function("React", "Link", "BmChevronRightIcon", "BmProgressIcon", "homeLoadEvolution", compile(read("../componentes/home-load-evolution.tsx")) + ";return HomeLoadEvolution;")(React, Link, Icon, Icon, homeLoadEvolution);
const session = (id, date, weight, extra = {}) => ({ id, date, startTime: "10:00", status: "finalizado", exercises: [{ exerciseId: "squat", exerciseName: "Sentadilla", sets: [{ completed: true, weight }, { completed: false, weight: 999 }] }], ...extra });

test("máximo real por sesión, cronología y ejercicios separados sin sumar cargas", () => {
  const input = [session("b", "2026-11-05", 60), session("a", "2026-11-01", 50), session("c", "2026-11-04", 500, { status: "en_progreso" })];
  const items = homeLoadEvolution(input);
  assert.deepEqual(items[0].points.map(point => point.weight), [50, 60]);
  assert.equal(items[0].name, "Sentadilla");
  assert.deepEqual(homeLoadEvolution([...input, input[0]]), items);
  assert.deepEqual(input.map(s => s.id), ["b", "a", "c"]);
});
test("vacío y un registro no simulan tendencia", () => {
  const empty = renderToStaticMarkup(React.createElement(Card, { sessions: [] }));
  assert.ok(empty.includes("Registrá tus pesos"));
  const single = renderToStaticMarkup(React.createElement(Card, { sessions: [session("a", "2026-11-01", 60)] }));
  assert.ok(single.includes("Un registro"));
  assert.ok(!single.includes("<svg"));
});
test("gráfico con valores y fechas accesibles, descenso real y máximo seis puntos", () => {
  const sessions = Array.from({ length: 8 }, (_, i) => session(String(i), `2026-11-${String(i + 1).padStart(2, "0")}`, 80 - i));
  assert.equal(homeLoadEvolution(sessions)[0].points.length, 6);
  const html = renderToStaticMarkup(React.createElement(Card, { sessions }));
  assert.ok(html.includes("-1 kg"));
  assert.ok(html.includes("2026-11-08: 73 kg"));
  assert.ok(html.includes('href="/portal/progreso"'));
});
test("selección determinista y descarte de cargas inválidas", () => {
  const items = homeLoadEvolution([session("a", "2026-11-01", null), session("b", "2026-11-02", -1), session("c", "2026-11-03", NaN)]);
  assert.equal(items.length, 0);
});
test("Home personalizado incorpora evolución antes del resumen sin afectar Clases ni Mixto", () => {
  const home = read("../componentes/portal-section.tsx");
  assert.ok(home.includes('routineFocused = data.profile.serviceType === "PERSONALIZED"'));
  assert.ok(home.includes('routineFocused && <HomeLoadEvolution sessions={data.workoutSessions} />'));
  assert.ok(home.indexOf('<HomeLoadEvolution sessions=') < home.indexOf('<HomeQuickStats data='));
  const css = read("../app/globals.css");
  assert.ok(css.includes('.portal-home-personalized > .portal-home-main-card'));
  assert.ok(css.includes('flex-grow: 0;'));
  assert.ok(home.includes('groupClassesEnabled && !weeklyCelebrated && data.home.weeklyMission'));
});
test("datos exclusivamente del alumno autenticado: sin nueva lectura ni IDs enviados por cliente", () => {
  const api = read("../app/api/portal/data/route.ts");
  assert.ok(api.includes('const studentId = session.studentId'));
  assert.ok(api.includes('where: { studentId },'));
  assert.ok(api.includes('session.credential.student.workspaceId'));
  assert.ok(!read("../componentes/home-load-evolution.tsx").includes('fetch('));
});
