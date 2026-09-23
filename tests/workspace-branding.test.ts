import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { allowedLogoModes, BM_DEFAULT_ACCENT, normalizeAccentColor, normalizeCustomLogoUrl, resolveWorkspaceBranding, workspaceAccentColor, workspaceBrandingVariables } from "../lib/workspace-branding.ts";
import { MAX_WORKSPACE_LOGO_BYTES, validateWorkspaceLogoBytes, workspaceLogoMetadataError } from "../lib/workspace-logo-upload.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("workspace sin color y SELF_SERVICE conservan el dorado BM", () => {
  assert.equal(workspaceAccentColor(undefined), BM_DEFAULT_ACCENT);
  assert.equal(workspaceAccentColor(""), BM_DEFAULT_ACCENT);
  assert.match(read("componentes/self-service-shell.tsx"), /workspaceBrandingVariables\(BM_DEFAULT_ACCENT\)/);
});

test("los estilos de logo quedan limitados por plan", () => {
  assert.deepEqual(allowedLogoModes("STARTER"), ["DEFAULT", "WHITE"]);
  assert.deepEqual(allowedLogoModes("PRO"), ["DEFAULT", "WHITE", "ACCENT"]);
  assert.deepEqual(allowedLogoModes("PREMIUM"), ["DEFAULT", "WHITE", "ACCENT", "CUSTOM"]);
});

test("CUSTOM exige PREMIUM y una URL segura de Vercel Blob", () => {
  const logoUrl = "https://example.public.blob.vercel-storage.com/workspace-branding/logo.webp";
  assert.equal(resolveWorkspaceBranding({ logoMode: "CUSTOM", customLogoUrl: logoUrl }, "PREMIUM").logoMode, "CUSTOM");
  assert.equal(resolveWorkspaceBranding({ logoMode: "CUSTOM", customLogoUrl: logoUrl }, "PRO").logoMode, "DEFAULT");
  assert.equal(resolveWorkspaceBranding({ logoMode: "CUSTOM", customLogoUrl: "" }, "PREMIUM").logoMode, "DEFAULT");
  assert.equal(normalizeCustomLogoUrl("https://attacker.example/logo.png"), "");
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
  assert.match(route, /allowedLogoModes\(brandingPlan\)\.includes\(logoMode\)/);
  assert.match(route, /normalizeCustomLogoUrl\(requested\.customLogoUrl\) !== currentCustomLogoUrl/);
  assert.doesNotMatch(route, /requested\.workspaceId|body\.workspaceId/);
});

test("alumno hereda color y logo de su workspace y los conserva tras un nuevo login", () => {
  const layout = read("app/portal/(student)/layout.tsx");
  const server = read("lib/workspace-branding-server.ts");
  assert.match(layout, /loadWorkspaceBranding\(session\.credential\.student\.workspaceId\)/);
  assert.match(layout, /<PortalShell branding=\{branding\}/);
  assert.match(server, /where: \{ workspaceId \}/);
  assert.match(server, /trainerSubscription: \{ select: \{ plan: true, trialEndsAt: true \} \}/);
  assert.match(server, /effectiveTrainerPlan/);
  assert.match(read("componentes/portal-shell.tsx"), /useState\(branding\)/);
  assert.match(read("componentes/portal-shell.tsx"), /workspaceBrandingVariables\(currentBranding\.accentColor\)/);
});

test("alumno conectado actualiza color y logo sólo desde su sesión sin refresh", () => {
  const route = read("app/api/portal/branding/route.ts");
  const shell = read("componentes/portal-shell.tsx");
  assert.match(route, /const session = await getPortalSession\(\)/);
  assert.match(route, /loadWorkspaceBranding\(session\.credential\.student\.workspaceId\)/);
  assert.doesNotMatch(route, /searchParams|request\.url|workspaceId:/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(shell, /fetch\("\/api\/portal\/branding"/);
  assert.match(shell, /setInterval\([^]*10000\)/);
  assert.match(shell, /setCurrentBranding/);
  assert.match(shell, /current\.logoMode === body\.logoMode/);
  assert.match(shell, /current\.customLogoUrl === body\.customLogoUrl/);
  assert.doesNotMatch(shell, /router\.refresh|location\.reload|window\.location/);
});

test("carga PREMIUM reutiliza Blob, valida el archivo y persiste sólo su URL", () => {
  const upload = read("app/api/workspace/logo/route.ts");
  assert.match(upload, /plan !== "PREMIUM"/);
  assert.match(upload, /validateWorkspaceLogoBytes/);
  assert.doesNotMatch(upload, /image\/svg/);
  assert.match(upload, /workspace-branding\/\$\{auth\.workspace\.workspaceId\}/);
  assert.match(upload, /persistUploadedWorkspaceLogo/);
  assert.match(read("lib/workspace-logo-persistence.ts"), /customLogoUrl: uploadedUrl, logoMode: "CUSTOM"/);
  assert.doesNotMatch(upload, /data: \{[^}]*Buffer/);
});

test("upload acepta PNG, JPG/JPEG y WEBP reales aunque Android omita MIME o use image/jpg", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.deepEqual(validateWorkspaceLogoBytes(jpeg, "image/jpg"), { mime: "image/jpeg", extension: "jpg" });
  assert.deepEqual(validateWorkspaceLogoBytes(png, ""), { mime: "image/png", extension: "png" });
  assert.deepEqual(validateWorkspaceLogoBytes(webp, "application/octet-stream"), { mime: "image/webp", extension: "webp" });
});

test("upload rechaza tipo inválido, firma falsa y archivos mayores a 3 MB", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(workspaceLogoMetadataError({ size: 100, type: "image/gif" }), "El logo debe ser PNG, JPG o WEBP.");
  assert.equal(workspaceLogoMetadataError({ size: MAX_WORKSPACE_LOGO_BYTES + 1, type: "image/png" }), "El logo supera el máximo de 3 MB.");
  assert.equal(validateWorkspaceLogoBytes(png, "image/jpeg"), null);
  assert.equal(validateWorkspaceLogoBytes(new Uint8Array([1, 2, 3]), "image/png"), null);
});

test("Configuración muestra progreso, éxito y error y aplica el branding sin refresh", () => {
  const settings = read("app/configuracion/page.tsx");
  assert.match(settings, /Subiendo\.\.\./);
  assert.match(settings, /Logo actualizado/);
  assert.match(settings, /role=\{uploadStatus\.kind === "error" \? "alert" : "status"\}/);
  assert.match(settings, /onChange\(body\.branding\)/);
  assert.match(settings, /WORKSPACE_BRANDING_EVENT/);
});

test("logo roto o downgrade usan el logo BM como fallback", () => {
  const logo = read("componentes/workspace-brand-logo.tsx");
  assert.match(logo, /onError=\{\(\) => setFailedCustomUrl\(branding\.customLogoUrl\)\}/);
  assert.match(logo, /src="\/bm-training-mark\.png"/);
  assert.equal(resolveWorkspaceBranding({ logoMode: "CUSTOM", customLogoUrl: "https://example.public.blob.vercel-storage.com/logo.png" }, "STARTER").logoMode, "DEFAULT");
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
  assert.doesNotMatch(read("app/master/page.tsx"), /WorkspaceBrandLogo|customLogoUrl|logoMode/);
});

test("Configuración ofrece presets, preview y controles de logo por plan", () => {
  const settings = read("app/configuracion/page.tsx");
  assert.match(settings, /label: "Personalización"/);
  assert.match(settings, /type="color"/);
  assert.match(settings, /Vista previa/);
  assert.match(settings, /Restablecer color BM/);
  assert.match(settings, /update\("accentColor", BM_DEFAULT_ACCENT\)/);
  assert.match(settings, /Estilo del logo/);
  assert.match(settings, /Subir logo propio/);
  assert.match(settings, /Reemplazar logo/);
  assert.match(settings, /Eliminar logo/);
  assert.match(settings, /Volver al logo BM/);
  assert.match(settings, /<WorkspaceBrandLogo branding=\{value\}/);
});

test("listado Master es compacto, conserva filtros y agrega búsqueda", () => {
  const trainers = read("componentes/platform-trainers.tsx");
  for (const label of ["Todos", "Al día", "Vencidos", "Suspendidos", "Cancelados", "Próximos a vencer"]) assert.match(trainers, new RegExp(`"${label}"`));
  assert.match(trainers, /type="search"/);
  assert.match(trainers, /md:grid-cols-\[minmax\(190px,1\.35fr\)/);
  assert.doesNotMatch(trainers, /Último pago/);
});
