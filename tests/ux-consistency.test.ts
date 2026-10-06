import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const moduleShell = readFileSync(new URL("../componentes/module-shell.tsx", import.meta.url), "utf8");
const portalShell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8") + readFileSync(new URL("../componentes/portal-visuals.tsx", import.meta.url), "utf8");
const splash = readFileSync(new URL("../componentes/bm-training-splash.tsx", import.meta.url), "utf8");
const fullLogo = readFileSync(new URL("../public/bm-training-full-logo-transparent.png", import.meta.url));
const pwaIcon192 = readFileSync(new URL("../public/icons/bm-training-pwa-192-v7.png", import.meta.url));
const pwaIcon512 = readFileSync(new URL("../public/icons/bm-training-pwa-512-v7.png", import.meta.url));
const pwaMaskable512 = readFileSync(new URL("../public/icons/bm-training-maskable-512-v7.png", import.meta.url));
const bootReady = readFileSync(new URL("../componentes/bm-boot-ready.tsx", import.meta.url), "utf8");
const appFrame = readFileSync(new URL("../componentes/app-frame.tsx", import.meta.url), "utf8");
const portalLoading = readFileSync(new URL("../app/portal/(student)/loading.tsx", import.meta.url), "utf8");
const rootLayout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const portalLayout = readFileSync(new URL("../app/portal/layout.tsx", import.meta.url), "utf8");
const portalLogin = readFileSync(new URL("../app/portal/login/page.tsx", import.meta.url), "utf8");
const appManifest = readFileSync(new URL("../app/manifest.ts", import.meta.url), "utf8");
const portalManifest = readFileSync(
  new URL("../public/portal/manifest.webmanifest", import.meta.url),
  "utf8",
);

test("la tipografía y los campos reutilizados conservan legibilidad móvil", () => {
  assert.match(globals, /font-family: var\(--font-geist-sans\)/);
  assert.match(moduleShell, /text-base/);
  assert.match(moduleShell, /sm:text-sm/);
  assert.match(moduleShell, /min-h-11/);
  assert.match(moduleShell, /placeholder:text-\[var\(--foreground-muted\)\]/);
});

test("la navegación móvil respeta safe area y deja espacio al contenido", () => {
  assert.match(portalShell, /env\(safe-area-inset-bottom\)/);
  assert.match(
    portalShell,
    /pb-\[calc\(var\(--portal-bottom-nav-height\)\+var\(--portal-bottom-nav-offset\)\+var\(--portal-bottom-nav-clearance\)\+env\(safe-area-inset-bottom\)\)\]/,
  );
  assert.match(portalShell, /min-h-11 min-w-0/);
  assert.match(portalShell, /aria-current=\{active \? "page" : undefined\}/);
});

test("el puente de arranque existe en el HTML inicial y se retira por hidratación real", () => {
  const splashIndex = rootLayout.indexOf("<BmTrainingSplash />");
  const appIndex = rootLayout.indexOf('id="bm-app-root"');
  assert.ok(splashIndex >= 0 && appIndex > splashIndex);
  assert.match(appFrame, /<BmBootReady \/>/);
  assert.match(bootReady, /useLayoutEffect/);
  assert.match(bootReady, /dataset\.bmAppReady = "true"/);
  assert.match(globals, /html\[data-bm-app-ready="true"\] \.bm-app-splash/);
  assert.match(globals, /html\[data-bm-app-ready="true"\] #bm-app-root/);
  assert.doesNotMatch(splash, /"use client"/);
  for (const source of [splash, bootReady]) {
    assert.doesNotMatch(source, /setTimeout|requestAnimationFrame|SPLASH_DURATION/);
  }
  assert.match(portalShell, /key=\{pathname\}/);
  assert.match(portalShell, /portal-route-enter/);
  assert.match(portalShell, /portal-nav-active-icon/);
  assert.match(globals, /prefers-reduced-motion: reduce/);
  assert.match(globals, /transform: translateY\(8px\)/);
  assert.doesNotMatch(globals, /@keyframes bm-[^{]+\{[^}]*(?:width|height|top|left):/s);
});

test("el shell SSR muestra el logo completo oficial sobre el fondo oscuro", () => {
  assert.match(splash, /src="\/bm-training-full-logo-transparent\.png"/);
  assert.match(splash, /width=\{1238\}/);
  assert.match(splash, /height=\{792\}/);
  assert.match(splash, /object-contain/);
  assert.match(splash, /bm-app-splash-logo-image/);
  assert.match(splash, /\bpreload\b/);
  assert.match(splash, /\bunoptimized\b/);
  assert.doesNotMatch(splash, /\bpriority\b/);
  assert.doesNotMatch(splash, /bm-app-splash-ring|bm-splash-ring-base/);
  assert.match(rootLayout, /data-theme="dark"/);
  assert.match(rootLayout, /<head><script/);
  assert.match(globals, /--background: #0b0b0c/);
  assert.match(globals, /\.bm-app-splash \{[\s\S]*?background: transparent;/);
  assert.match(splash, /h-\[100dvh\]/);
  assert.match(globals, /width: min\(88vw, 74dvh, 42rem\)/);
  assert.doesNotMatch(splash, /onAnimationEnd|onTransitionEnd/);
  assert.doesNotMatch(globals, /bm-splash-orbit|bm-app-splash--playing/);
});

test("el logo completo usa un PNG RGBA real y mantiene su proporción", () => {
  assert.equal(fullLogo.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(fullLogo.readUInt32BE(16), 1238);
  assert.equal(fullLogo.readUInt32BE(20), 792);
  assert.equal(fullLogo[25], 6);
});

test("cada documento comparte el puente SSR y los redirects de sesión ocurren antes del HTML final", () => {
  assert.doesNotMatch(splash, /sessionStorage/);
  assert.doesNotMatch(splash, /SPLASH_SESSION_KEY/);
  assert.match(rootLayout, /<BmTrainingSplash \/>/);
  assert.match(rootLayout, /<AppFrame>\{children\}<\/AppFrame>/);
  assert.match(portalLogin, /getPortalSession/);
  assert.match(portalLogin, /redirect\("\/portal"\)/);
  assert.match(portalLogin, /redirect\("\/dashboard"\)/);
  assert.match(globals, /prefers-reduced-motion: reduce/);
  assert.match(globals, /\.bm-app-splash \{\s+transition-duration: 0ms;/);
});

test("los manifests y metadatos usan la identidad oficial v7 y su variante maskable", () => {
  for (const source of [rootLayout, portalLayout, appManifest, portalManifest]) {
    assert.match(source, /bm-training-pwa-192-v7\.png/);
    assert.match(source, /bm-training-pwa-512-v7\.png/);
    assert.doesNotMatch(source, /bm-training-(?:pwa|maskable|apple-touch)-[^"']*-v[46]\.png/);
  }

  assert.match(rootLayout, /bm-training-apple-touch-v7\.png/);
  assert.match(portalLayout, /bm-training-apple-touch-v7\.png/);
  assert.match(appManifest, /bm-training-maskable-512-v7\.png/);
  assert.match(appManifest, /purpose: "maskable"/);
  assert.match(portalManifest, /bm-training-maskable-512-v7\.png/);
  assert.match(portalManifest, /"purpose": "maskable"/);

  assert.equal(pwaIcon192.readUInt32BE(16), 192);
  assert.equal(pwaIcon192.readUInt32BE(20), 192);
  assert.equal(pwaIcon512.readUInt32BE(16), 512);
  assert.equal(pwaIcon512.readUInt32BE(20), 512);
  assert.equal(pwaMaskable512.readUInt32BE(16), 512);
  assert.equal(pwaMaskable512.readUInt32BE(20), 512);
});

test("las esperas reales del portal usan skeleton sin duplicar el logo", () => {
  assert.match(portalLoading, /aria-busy="true"/);
  assert.match(portalLoading, /animate-pulse/);
  assert.match(portalLoading, /motion-reduce:animate-none/);
  assert.doesNotMatch(portalLoading, /bm-training-(?:logo|splash|mark)/);
});
