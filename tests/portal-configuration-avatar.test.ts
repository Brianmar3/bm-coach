import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_PROFILE_AVATAR, PROFILE_AVATARS, profileAvatarById } from "../lib/profile-avatars.ts";

const portal = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const push = readFileSync(new URL("../componentes/push-notifications-card.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../componentes/student-profile-view.tsx", import.meta.url), "utf8");
const avatarPage = readFileSync(new URL("../componentes/student-avatar-page.tsx", import.meta.url), "utf8");
const avatarRoute = readFileSync(new URL("../app/portal/(student)/perfil/avatar/page.tsx", import.meta.url), "utf8");
const profileRoute = readFileSync(new URL("../app/api/portal/profile-photo/route.ts", import.meta.url), "utf8");
const portalShell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");

test("Ajustes navega a vistas propias y no usa Configuración como destino genérico", () => {
  for (const route of ["seguridad", "privacidad", "preferencias", "ayuda"]) assert.match(profile, new RegExp(`/portal/perfil/${route}`));
  assert.doesNotMatch(profile, /\/portal\/configuracion#/);
});

test("el formulario de contraseña empieza plegado y conserva su instancia al cerrar", () => {
  assert.match(portal, /const \[expanded, setExpanded\] = useState\(false\)/);
  assert.match(portal, /aria-expanded=\{expanded\}/);
  assert.match(portal, /aria-controls=\{contentId\}/);
  assert.match(portal, /inert=\{!expanded\}/);
  assert.match(portal, /<ChangePasswordCard embedded \/>/);
  assert.doesNotMatch(portal, /expanded &&\s*<ChangePasswordCard/);
  for (const id of ["current-password", "new-password", "confirm-password"]) {
    assert.match(portal, new RegExp(`id="${id}"`));
  }
});

test("Notificaciones usa alcance general y un único mensaje contextual", () => {
  assert.match(push, /: "Notificaciones"/);
  assert.match(push, /pagos, vencimientos, logros y novedades de tu entrenamiento/);
  assert.match(push, /const contextualMessage = message \|\|/);
  assert.equal((push.match(/\{contextualMessage && \(/g) ?? []).length, 1);
  assert.doesNotMatch(push, /Notificaciones de logros/);
});

test("el shell mantiene espacio seguro por encima de la navegación inferior", () => {
  assert.match(portalShell, /pb-\[calc\(env\(safe-area-inset-bottom\)\+8\.25rem\)\]/);
  assert.match(portalShell, /bottom-\[calc\(env\(safe-area-inset-bottom\)\+0\.75rem\)\]/);
});

test("el selector conserva los avatares anteriores y registra los nuevos sin duplicados", () => {
  const previousIds = [
    "athlete-man-01", "athlete-woman-01", "coach-man-01", "coach-woman-01",
    "runner-man-01", "runner-woman-01", "kettlebell-01", "dumbbell-01",
    "barbell-01", "stopwatch-01", "bm-shield-01", "power-01",
  ];
  const newIds = [
    "functional-woman-01", "functional-man-01", "boxer-man-01", "boxer-woman-01",
    "strength-man-01", "cardio-man-01", "mobility-woman-01", "strength-woman-01",
  ];
  const ids = PROFILE_AVATARS.map((avatar) => avatar.id);
  const sources = PROFILE_AVATARS.map((avatar) => avatar.src);
  for (const id of previousIds) assert.ok(ids.includes(id), id);
  for (const id of newIds) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(sources).size, sources.length);
  assert.equal(PROFILE_AVATARS.length, 20);
  assert.ok(PROFILE_AVATARS.some((avatar) => avatar.category === "Personajes"));
  assert.ok(PROFILE_AVATARS.some((avatar) => avatar.category === "Equipamiento"));
  assert.ok(newIds.every((id) => profileAvatarById(id)?.category === "Personajes"));
  assert.equal(PROFILE_AVATARS.filter((avatar) => avatar.category === "Equipamiento").length, 6);
  for (const avatar of PROFILE_AVATARS) {
    assert.ok(existsSync(new URL(`../public${avatar.src}`, import.meta.url)), avatar.src);
  }
  assert.match(avatarPage, /\["Personajes", "Equipamiento"\]/);
  assert.match(avatarPage, /grid grid-cols-3 gap-2 sm:grid-cols-4/);
});

test("la selección sigue persistiendo por avatarId con la API existente", () => {
  assert.equal(profileAvatarById(DEFAULT_PROFILE_AVATAR.id)?.src, DEFAULT_PROFILE_AVATAR.src);
  assert.match(avatarPage, /method: "PUT"/);
  assert.match(avatarPage, /JSON\.stringify\(\{ avatarId: avatarChoice \}\)/);
  assert.match(profileRoute, /profileAvatarById\(input\.avatarId\)/);
  assert.match(profileRoute, /profileImageUrl: avatar\.src/);
});

test("Cambiar avatar navega a una página propia y ya no abre un modal", () => {
  assert.match(profile, /href="\/portal\/perfil\/avatar"/);
  assert.match(avatarRoute, /section="avatar"/);
  assert.doesNotMatch(profile, /avatarPickerOpen|aria-modal/);
  assert.doesNotMatch(avatarPage, /fixed inset-0|sticky bottom-0|z-\[70\]|safe-area-inset/);
});

test("la página muestra selección local, grupos reales y guardado explícito", () => {
  assert.match(avatarPage, /Avatar actual/);
  assert.match(avatarPage, /Personajes/);
  assert.match(avatarPage, /Equipamiento/);
  assert.match(avatarPage, /setAvatarChoice\(avatar\.id\)/);
  assert.match(avatarPage, /Guardar avatar/);
  assert.match(avatarPage, /href="\/portal\/perfil"/);
  assert.doesNotMatch(avatarPage, /onClick=\{saveAvatar\}.*setAvatarChoice/s);
});
