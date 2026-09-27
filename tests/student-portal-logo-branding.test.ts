import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("la imagen privada del logo atraviesa el proxy sólo para lectura y conserva autorización interna", () => {
  const proxy = read("proxy.ts");
  const imageRoute = read("app/api/workspace/logo/image/route.ts");
  assert.match(proxy, /path === "\/api\/workspace\/logo\/image" && \(request\.method === "GET" \|\| request\.method === "HEAD"\)/);
  assert.match(proxy, /portalRoute \|\| portalBrandingAsset/);
  assert.match(imageRoute, /getPortalSession\(\{ allowSelfService: true \}\)/);
  assert.match(imageRoute, /loadWorkspaceBranding\(portalSession\.credential\.student\.workspaceId\)/);
  assert.match(imageRoute, /branding\.logoMode === "CUSTOM" && branding\.customLogoUrl === source/);
  assert.doesNotMatch(proxy, /portalBrandingAsset = path === "\/api\/workspace\/logo"/);
});

test("el branding del alumno siempre se resuelve desde StudentRecord.workspaceId", () => {
  const route = read("app/api/portal/branding/route.ts");
  const layout = read("app/portal/(student)/layout.tsx");
  assert.match(route, /loadWorkspaceBranding\(session\.credential\.student\.workspaceId\)/);
  assert.doesNotMatch(route, /searchParams|request\.url|body\.workspaceId/);
  assert.match(layout, /loadWorkspaceBranding\(session\.credential\.student\.workspaceId\)/);
  assert.match(layout, /<PortalShell branding=\{branding\}/);
});

test("CUSTOM y cambios posteriores llegan al header sin refresh y quedan aislados por sesión", () => {
  const shell = read("componentes/portal-shell.tsx");
  const header = read("componentes/portal-visuals.tsx");
  assert.match(shell, /fetch\("\/api\/portal\/branding", \{ cache: "no-store"/);
  assert.match(shell, /setInterval\([^]*10000\)/);
  assert.match(shell, /current\.logoMode === body\.logoMode/);
  assert.match(shell, /current\.customLogoUrl === body\.customLogoUrl/);
  assert.match(shell, /<PortalHeader branding=\{currentBranding\}/);
  assert.match(header, /<WorkspaceBrandLogo branding=\{branding\}/);
  assert.doesNotMatch(shell, /location\.reload|router\.refresh/);
});

test("el renderer cubre CUSTOM, ACCENT, WHITE y fallback DEFAULT BM", () => {
  const logo = read("componentes/workspace-brand-logo.tsx");
  assert.match(logo, /branding\.logoMode === "CUSTOM" && branding\.customLogoUrl/);
  assert.match(logo, /\/api\/workspace\/logo\/image\?source=/);
  assert.match(logo, /branding\.logoMode === "WHITE" \|\| branding\.logoMode === "ACCENT"/);
  assert.match(logo, /branding\.logoMode === "WHITE" \? "text-white" : "text-\[var\(--bm-accent\)\]"/);
  assert.match(logo, /onError=\{\(\) => setFailedCustomUrl\(branding\.customLogoUrl\)\}/);
  assert.match(logo, /src="\/bm-training-mark\.png"/);
});

test("SELF_SERVICE y Master continúan usando identidad BM", () => {
  const selfService = read("componentes/self-service-shell.tsx");
  const master = read("app/master/page.tsx");
  assert.match(selfService, /workspaceBrandingVariables\(BM_DEFAULT_ACCENT\)/);
  assert.match(selfService, /<PortalHeader [^>]*studentName=/);
  assert.doesNotMatch(selfService, /branding=/);
  assert.doesNotMatch(master, /WorkspaceBrandLogo|customLogoUrl|logoMode/);
});
