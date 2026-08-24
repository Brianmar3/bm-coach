import assert from "node:assert/strict";
import test from "node:test";
import { choosePortalExperience, parsePortalExperience } from "../lib/portal-experience.ts";
test("restaura cada portal cuando sólo su sesión es válida", () => { assert.equal(choosePortalExperience({ studentValid: false, adminValid: true, preferred: null }), "admin"); assert.equal(choosePortalExperience({ studentValid: true, adminValid: false, preferred: null }), "student"); });
test("sin sesiones válidas muestra el login del alumno", () => { assert.equal(choosePortalExperience({ studentValid: false, adminValid: false, preferred: "admin" }), null); });
test("si ambas sesiones coexisten respeta la última experiencia", () => { assert.equal(choosePortalExperience({ studentValid: true, adminValid: true, preferred: "admin" }), "admin"); assert.equal(choosePortalExperience({ studentValid: true, adminValid: true, preferred: "student" }), "student"); });
test("si la preferida venció usa la otra sesión válida", () => { assert.equal(choosePortalExperience({ studentValid: true, adminValid: false, preferred: "admin" }), "student"); assert.equal(choosePortalExperience({ studentValid: false, adminValid: true, preferred: "student" }), "admin"); });
test("ignora preferencias manipuladas", () => { assert.equal(parsePortalExperience("coach"), null); });
