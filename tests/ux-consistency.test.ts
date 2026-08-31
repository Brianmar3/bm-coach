import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const moduleShell = readFileSync(new URL("../componentes/module-shell.tsx", import.meta.url), "utf8");
const portalShell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
const splash = readFileSync(new URL("../componentes/bm-training-splash.tsx", import.meta.url), "utf8");
const portalLoading = readFileSync(new URL("../app/portal/(student)/loading.tsx", import.meta.url), "utf8");
const rootLayout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const portalLayout = readFileSync(new URL("../app/portal/layout.tsx", import.meta.url), "utf8");
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
  assert.match(moduleShell, /placeholder:text-zinc-500/);
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

test("App Motion V1 anima sólo logo y contenido mientras mantiene estable la navegación", () => {
  const splashDuration = Number(splash.match(/SPLASH_DURATION_MS = ([\d_]+)/)?.[1].replaceAll("_", ""));
  assert.ok(splashDuration >= 1_400 && splashDuration <= 1_500);
  assert.match(splash, /useState<SplashPhase>\("showing"\)/);
  assert.doesNotMatch(splash, /"checking"/);
  assert.match(splash, /onTransitionEnd=\{completeExit\}/);
  assert.match(splash, /bm-app-splash-logo/);
  assert.match(portalShell, /key=\{pathname\}/);
  assert.match(portalShell, /portal-route-enter/);
  assert.match(portalShell, /portal-nav-active-icon/);
  assert.match(globals, /prefers-reduced-motion: reduce/);
  assert.match(globals, /transform: translateY\(8px\)/);
  assert.doesNotMatch(globals, /@keyframes bm-[^{]+\{[^}]*(?:width|height|top|left):/s);
});

test("el aro del splash rodea el asset real y usa un único destello orbital", () => {
  assert.match(splash, /src="\/bm-training-splash\.png"/);
  assert.match(splash, /<svg[^>]+viewBox="0 0 200 200"/);
  assert.match(splash, /className="bm-splash-ring-base"/);
  assert.match(splash, /className="bm-splash-orbit"/);
  assert.match(splash, /d="M 70\.95 10\.6 A 94 94 0 0 1 100 6"/);
  assert.equal((splash.match(/className="bm-splash-orbit-spark"/g) ?? []).length, 1);
  assert.match(splash, /className="bm-app-splash-logo relative z-10 w-\[96%\]"/);
  assert.match(splash, /bm-app-splash-logo-image/);
  assert.match(splash, /\bpreload\b/);
  assert.doesNotMatch(splash, /\bpriority\b/);
  assert.match(splash, /backgroundColor: "#000000"/);
  assert.match(splash, /height: "100dvh"/);
  assert.match(splash, /width: "min\(88vw, 74dvh, 42rem\)"/);
  assert.match(splash, /onAnimationEnd=\{completeVisibleAnimation\}/);
  assert.doesNotMatch(globals, /bm-splash-logo-enter/);
  assert.doesNotMatch(globals, /bm-splash-ring-enter/);
  assert.match(globals, /bm-splash-orbit-travel 1100ms linear 150ms/);
  assert.match(globals, /\.bm-app-splash--playing \.bm-splash-orbit/);
  assert.match(globals, /transform: rotate\(360deg\)/);
  assert.match(globals, /\.bm-splash-orbit \{\s+opacity: 0;/);
  assert.match(splash, /phase === "exiting" \? "bm-splash-content-enter"/);
  assert.match(globals, /\.bm-splash-content-enter > \* \{/);
});

test("cada arranque de documento conserva el puente visual sin depender de la sesión", () => {
  assert.doesNotMatch(splash, /sessionStorage/);
  assert.doesNotMatch(splash, /SPLASH_SESSION_KEY/);
  assert.match(splash, /useState<SplashPhase>\("showing"\)/);
});

test("los manifests y metadatos usan la identidad oficial v5 y su variante maskable", () => {
  for (const source of [rootLayout, portalLayout, appManifest, portalManifest]) {
    assert.match(source, /bm-training-pwa-192-v5\.png/);
    assert.match(source, /bm-training-pwa-512-v5\.png/);
    assert.doesNotMatch(source, /bm-training-(?:pwa|maskable|apple-touch)-[^"']*-v4\.png/);
  }

  assert.match(rootLayout, /bm-training-apple-touch-v5\.png/);
  assert.match(portalLayout, /bm-training-apple-touch-v5\.png/);
  assert.match(appManifest, /bm-training-maskable-512-v5\.png/);
  assert.match(appManifest, /purpose: "maskable"/);
  assert.match(portalManifest, /bm-training-maskable-512-v5\.png/);
  assert.match(portalManifest, /"purpose": "maskable"/);
});

test("las esperas reales del portal usan skeleton sin duplicar el logo", () => {
  assert.match(portalLoading, /aria-busy="true"/);
  assert.match(portalLoading, /animate-pulse/);
  assert.match(portalLoading, /motion-reduce:animate-none/);
  assert.doesNotMatch(portalLoading, /bm-training-(?:logo|splash|mark)/);
});
