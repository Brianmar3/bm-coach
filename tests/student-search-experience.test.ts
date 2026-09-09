import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { studentMatchesSearch } from "../lib/student-search.ts";

const page = readFileSync(new URL("../app/alumnos/page.tsx", import.meta.url), "utf8");

test("una búsqueda temporal equivocada se puede corregir y recuperar resultados", () => {
  const student = { id: "student-1", firstName: "Brian", lastName: "Martinez", phone: "3404123456" };
  assert.equal(studentMatchesSearch(student, "M"), true);
  assert.equal(studentMatchesSearch(student, "Martni"), false);
  assert.equal(studentMatchesSearch(student, "Martinez"), true);
  assert.equal(studentMatchesSearch(student, "3404"), true);
});

test("la búsqueda escrita se aplica con debounce de 400 ms y conserva la última lista", () => {
  assert.match(page, /const \[query, setQuery\] = useState\(""\)/);
  assert.match(page, /const \[appliedQuery, setAppliedQuery\] = useState\(""\)/);
  assert.match(page, /window\.setTimeout\(\(\) => setAppliedQuery\(query\), 400\)/);
  assert.match(page, /window\.clearTimeout\(timeout\)/);
  assert.match(page, /studentMatchesSearch\(item, appliedQuery\)/);
});

test("el estado vacío mantiene buscador y foco disponibles", () => {
  assert.match(page, /aria-controls="student-results"/);
  assert.match(page, /id="student-results"/);
  assert.match(page, /role="status" aria-live="polite"/);
  assert.match(page, /No encontramos alumnos para “\{appliedQuery\.trim\(\)\}”/);
  assert.match(page, /Podés corregir la búsqueda sin salir de esta pantalla/);
  assert.doesNotMatch(page, /className=\{visible\.length === 0 \? "hidden"/);
});

test("Enter aplica sin bloquear y Limpiar filtros depende de filtros reales", () => {
  assert.match(page, /event\.key === "Enter"\) setAppliedQuery\(query\)/);
  assert.match(page, /hasNonSearchFilters && <button[^>]*onClick=\{clearFilters\}/);
  assert.doesNotMatch(page, /Boolean\(query\.trim\(\)\).*Limpiar filtros/s);
  for (const filter of ["status", "plan", "serviceType"]) assert.match(page, new RegExp(`${filter} !== "todos"`));
});
