import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const passwordField = readFileSync(new URL("../componentes/password-field.tsx", import.meta.url), "utf8");
const portalLogin = readFileSync(new URL("../componentes/portal-login-form.tsx", import.meta.url), "utf8");
const trainerLogin = readFileSync(new URL("../app/admin/login/page.tsx", import.meta.url), "utf8");
const portal = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");

test("el campo de contraseña inicia oculto y alterna visibilidad sin enviar el formulario", () => {
  assert.match(passwordField, /useState\(false\)/);
  assert.match(passwordField, /type=\{visible \? "text" : "password"\}/);
  assert.match(passwordField, /type="button"/);
  assert.match(passwordField, /setVisible\(\(current\) => !current\)/);
  assert.match(passwordField, /Mostrar contraseña/);
  assert.match(passwordField, /Ocultar contraseña/);
});

test("el campo compartido anuncia errores y Bloq Mayús de forma accesible", () => {
  assert.match(passwordField, /getModifierState\("CapsLock"\)/);
  assert.match(passwordField, /Bloq Mayús está activado/);
  assert.match(passwordField, /aria-invalid=\{error \? true : undefined\}/);
  assert.match(passwordField, /aria-describedby=\{describedBy\}/);
  assert.match(passwordField, /role="alert"/);
});

test("los dos accesos validan inline, conservan Enter nativo y bloquean doble envío", () => {
  for (const source of [portalLogin, trainerLogin]) {
    assert.match(source, /<form noValidate onSubmit=\{submit\}/);
    assert.match(source, /if \(loading\) return/);
    assert.match(source, /disabled=\{loading\}/);
    assert.match(source, /aria-busy=\{loading\}/);
    assert.doesNotMatch(source, /onKeyDown=.*preventDefault/);
  }
  assert.match(portalLogin, /aria-invalid=\{fieldErrors\.username \? true : undefined\}/);
  assert.match(portalLogin, /autocomplete="username"/i);
  assert.match(portalLogin, /autoComplete="current-password"/);
  assert.match(trainerLogin, /<PasswordField/);
});

test("el cambio de contraseña usa tres controles independientes y valida antes de la red", () => {
  for (const id of ["current-password", "new-password", "confirm-password"]) assert.match(portal, new RegExp(`id="${id}"`));
  assert.match(portal, /if \(saving \|\| !validate\(\)\) return/);
  assert.ok(portal.indexOf("if (saving || !validate()) return") < portal.indexOf('fetch("/api/portal/change-password"'));
  assert.match(portal, /Las contraseñas nuevas no coinciden/);
  assert.match(portal, /currentRef\.current\?\.focus/);
  assert.match(portal, /newRef\.current\?\.focus/);
  assert.match(portal, /confirmRef\.current\?\.focus/);
});

test("los errores de acceso visibles son neutrales y no exponen detalles técnicos", () => {
  assert.match(portalLogin, /Los datos ingresados no son correctos/);
  assert.match(trainerLogin, /La credencial ingresada no es correcta/);
  assert.doesNotMatch(portalLogin, /base de datos|hash|variable de entorno/i);
  assert.doesNotMatch(trainerLogin, /variable de entorno|no está configurada/i);
});
