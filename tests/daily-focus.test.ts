import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  argentinaDailyFocusDateKey,
  DAILY_FOCUS_CATEGORIES,
  DAILY_FOCUS_MESSAGES,
  DAILY_FOCUS_TIME_ZONE,
  dailyFocusForDate,
  dailyFocusForInstant,
} from "../lib/daily-focus.ts";

const librarySource = readFileSync(new URL("../lib/daily-focus.ts", import.meta.url), "utf8");
const portalSource = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("la biblioteca principal contiene exactamente las 78 entradas completas", () => {
  assert.equal(DAILY_FOCUS_MESSAGES.length, 78);
  for (const message of DAILY_FOCUS_MESSAGES) {
    assert.ok(message.title.trim());
    assert.ok(message.reflection.trim());
    assert.ok(message.title.length <= 120);
    assert.ok(message.reflection.length >= 20 && message.reflection.length <= 180);
  }
});

test("todas las categorías están normalizadas y representadas", () => {
  const valid = new Set(DAILY_FOCUS_CATEGORIES);
  for (const message of DAILY_FOCUS_MESSAGES) assert.ok(valid.has(message.category));
  assert.deepEqual([...new Set(DAILY_FOCUS_MESSAGES.map((message) => message.category))], [...DAILY_FOCUS_CATEGORIES]);
});

test("la misma fecha conserva el mensaje y el día siguiente avanza", () => {
  assert.strictEqual(dailyFocusForDate("2026-08-02"), dailyFocusForDate("2026-08-02"));
  assert.notStrictEqual(dailyFocusForDate("2026-08-02"), dailyFocusForDate("2026-08-03"));
});

test("recorre el ciclo completo antes de repetir", () => {
  const start = "2026-01-01";
  const cycle = Array.from({ length: 78 }, (_, index) => dailyFocusForDate(addDays(start, index)));
  assert.equal(new Set(cycle).size, 78);
  assert.strictEqual(dailyFocusForDate(addDays(start, 78)), cycle[0]);
});

test("la fecha diaria usa America/Argentina/Buenos_Aires", () => {
  assert.equal(DAILY_FOCUS_TIME_ZONE, "America/Argentina/Buenos_Aires");
  const beforeMidnight = new Date("2026-08-03T02:30:00.000Z");
  const afterMidnight = new Date("2026-08-03T03:30:00.000Z");
  assert.equal(argentinaDailyFocusDateKey(beforeMidnight), "2026-08-02");
  assert.equal(argentinaDailyFocusDateKey(afterMidnight), "2026-08-03");
  assert.strictEqual(dailyFocusForInstant(beforeMidnight), dailyFocusForDate("2026-08-02"));
});

test("la rotación es determinística, no persiste y deja fuera la biblioteca anterior", () => {
  assert.doesNotMatch(librarySource, /Math\.random|prisma|localStorage|sessionStorage/i);
  for (const previous of [
    "La constancia construye lo que la motivación comienza.",
    "Cada sesión cuenta.",
    "Lo que repetís, mejora.",
  ]) assert.doesNotMatch(librarySource, new RegExp(previous.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("no contiene atribuciones a autores o títulos de libros", () => {
  const content = DAILY_FOCUS_MESSAGES.map((message) => `${message.title} ${message.reflection}`).join(" ");
  assert.doesNotMatch(content, /James Clear|Marco Aurelio|Séneca|Epicteto|Hábitos Atómicos|Meditaciones/i);
});

test("el bloque móvil muestra título y reflexión sin desbordes ni altura excesiva", () => {
  assert.match(portalSource, /dailyFocus\.title/);
  assert.match(portalSource, /dailyFocus\.reflection/);
  assert.match(portalSource, /line-clamp-2 break-words/);
  assert.match(portalSource, /min-w-0/);
  assert.match(portalSource, /overflow-hidden/);
  assert.doesNotMatch(portalSource, /dailyFocus\.category/);
});
