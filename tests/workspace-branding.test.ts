import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { BM_DEFAULT_ACCENT, normalizeAccentColor, workspaceAccentColor, workspaceBrandingVariables } from "../lib/workspace-branding.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("workspace sin color y SELF_SERVICE conservan el dorado BM", () => {
  assert.equal(workspaceAccentColor(undefined), BM_DEFAULT_ACCENT);
  assert.equal(workspaceAccentColor(""), BM_DEFAULT_ACCENT);
  assert.match(read("componentes/self-service-shell.tsx"), /workspaceBrandingVariables\(BM_DEFAULT_ACCENT\)/);
});

test("normaliza HEX válido y rechaza valores que no son un color seguro", () => {
  assert.equal(normalizeAccentColor(" #3b82f6 "), "#3B82F6");
  for (const value of ["3B82F6", "#fff", "#GG82F6", "red", "url(javascript:1)", null]) assert.equal(normalizeAccentColor(value), null);
});

test("el tema calcula contraste y variantes centralizadas", () => {
  const light = workspaceBrandingVariables("#FACC15");
  const dark = workspaceBrandingVariables("#1D4ED8");
  assert.equal(light["--bm-accent-contrast"], "#09090B");
  assert.equal(dark["--bm-accent-contrast"], "#FFFFFF");
  assert.equal(dark["--bm-accent"], "#1D4ED8");
  assert.match(dark["--bm-accent-soft"], /^#[0-9A-F]{8}$/);
});

test("trainer sólo guarda el color del workspace resuelto por su sesión", () => {
  const route = read("app/api/store/[collection]/route.ts");
  assert.match(route, /const \{ workspaceId \} = await requireTrainerWorkspace\(\)/);
  assert.match(route, /normalizeAccentColor\(requested\.accentColor\)/);
  assert.match(route, /if \(!accentColor\) return Response\.json\([^]*status: 400/);
  assert.doesNotMatch(route, /requested\.workspaceId|body\.workspaceId/);
});

test("alumno hereda el color de su workspace y lo conserva tras un nuevo login", () => {
  const layout = read("app/portal/(student)/layout.tsx");
  const server = read("lib/workspace-branding-server.ts");
  assert.match(layout, /loadWorkspaceAccentColor\(session\.credential\.student\.workspaceId\)/);
  assert.match(layout, /<PortalShell accentColor=\{accentColor\}/);
  assert.match(server, /where: \{ workspaceId \}/);
  assert.match(read("componentes/portal-shell.tsx"), /useState\(accentColor\)/);
  assert.match(read("componentes/portal-shell.tsx"), /workspaceBrandingVariables\(currentAccentColor\)/);
});

test("alumno conectado actualiza sólo las variables de su workspace sin refresh", () => {
  const route = read("app/api/portal/branding/route.ts");
  const shell = read("componentes/portal-shell.tsx");
  assert.match(route, /const session = await getPortalSession\(\)/);
  assert.match(route, /loadWorkspaceAccentColor\(session\.credential\.student\.workspaceId\)/);
  assert.doesNotMatch(route, /searchParams|request\.url|workspaceId:/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(shell, /fetch\("\/api\/portal\/branding"/);
  assert.match(shell, /setInterval\([^]*10000\)/);
  assert.match(shell, /setCurrentAccentColor/);
  assert.match(shell, /workspaceBrandingVariables\(currentAccentColor\)/);
  assert.doesNotMatch(shell, /router\.refresh|location\.reload|window\.location/);
});

test("polling se pausa al desmontar y se reactiva al volver a la app", () => {
  const shell = read("componentes/portal-shell.tsx");
  assert.match(shell, /window\.addEventListener\("focus", onFocus\)/);
  assert.match(shell, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(shell, /window\.clearInterval\(interval\)/);
  assert.match(shell, /controller\?\.abort\(\)/);
});

test("Master conserva dorado BM y la personalización queda fuera de Plataforma", () => {
  const appFrame = read("componentes/app-frame.tsx");
  assert.match(appFrame, /pathname === "\/master" \|\| pathname\.startsWith\("\/platform"\)/);
  assert.match(appFrame, /<WorkspaceBrandingProvider><div className=\{`admin-panel/);
  assert.doesNotMatch(read("componentes/platform-shell.tsx"), /WorkspaceBrandingProvider|workspaceBrandingVariables/);
});

test("Configuración ofrece presets, preview y restablecimiento", () => {
  const settings = read("app/configuracion/page.tsx");
  assert.match(settings, /label: "Personalización"/);
  assert.match(settings, /type="color"/);
  assert.match(settings, /Vista previa/);
  assert.match(settings, /Restablecer color BM/);
  assert.match(settings, /update\("accentColor", BM_DEFAULT_ACCENT\)/);
});

test("listado Master es compacto, conserva filtros y agrega búsqueda", () => {
  const trainers = read("componentes/platform-trainers.tsx");
  for (const label of ["Todos", "Al día", "Vencidos", "Suspendidos", "Cancelados", "Próximos a vencer"]) assert.match(trainers, new RegExp(`"${label}"`));
  assert.match(trainers, /type="search"/);
  assert.match(trainers, /md:grid-cols-\[minmax\(190px,1\.35fr\)/);
  assert.doesNotMatch(trainers, /Último pago/);
});
