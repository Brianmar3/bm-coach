import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { APPEARANCE_CHANGE_EVENT, APPEARANCE_STORAGE_KEY, parseAppearancePreference, resolveAppearance, readAppearancePreference, setAppearancePreference, applyAppearance } from "../lib/appearance.ts";

test("oscuro es el fallback; claro, oscuro y sistema se resuelven sin guardar un tema efectivo", () => {
  assert.equal(parseAppearancePreference(null), "dark");
  assert.equal(parseAppearancePreference("invalid"), "dark");
  assert.equal(parseAppearancePreference("light"), "light");
  assert.equal(parseAppearancePreference("system"), "system");
  assert.equal(resolveAppearance("dark", false), "dark");
  assert.equal(resolveAppearance("light", true), "light");
  assert.equal(resolveAppearance("system", false), "light");
  assert.equal(resolveAppearance("system", true), "dark");
});

test("la preferencia se persiste sólo localmente y cambia el atributo de html", () => {
  const values = new Map<string, string>();
  const events: string[] = [];
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  Object.assign(globalThis, {
    window: {
      localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
      matchMedia: () => ({ matches: false }),
      dispatchEvent: (event: Event) => events.push(event.type),
    },
    document: { documentElement: root },
  });
  try {
    setAppearancePreference("system");
    assert.equal(values.get(APPEARANCE_STORAGE_KEY), "system");
    assert.equal(root.dataset.theme, "light");
    assert.equal(root.dataset.appearance, "system");
    assert.equal(root.style.colorScheme, "light");
    assert.deepEqual(events, [APPEARANCE_CHANGE_EVENT]);
    setAppearancePreference("dark");
    assert.equal(readAppearancePreference(), "dark");
    assert.equal(root.dataset.theme, "dark");
    setAppearancePreference("light");
    assert.equal(root.dataset.theme, "light");
    values.set(APPEARANCE_STORAGE_KEY, "system");
    applyAppearance(readAppearancePreference());
    assert.equal(root.dataset.theme, "light");
  } finally {
    Object.assign(globalThis, { window: originalWindow, document: originalDocument });
  }
});

test("el bootstrap aplica la preferencia antes del body sin mismatch de SSR", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const inline = layout.match(/__html: `([^`]+)`/)?.[1];
  assert.ok(inline);
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  runInNewContext(inline, {
    localStorage: { getItem: () => "system" },
    matchMedia: () => ({ matches: false }),
    document: { documentElement: root },
  });
  assert.equal(root.dataset.theme, "light");
  assert.equal(root.dataset.appearance, "system");
  assert.match(layout, /<head><script/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(layout, /data-theme="dark"/);
});

test("entrenador y alumno comparten el selector sin modificar workspace ni APIs", () => {
  const trainer = readFileSync("app/configuracion/page.tsx", "utf8");
  const portal = readFileSync("componentes/portal-section.tsx", "utf8");
  const profile = readFileSync("componentes/student-profile-settings-page.tsx", "utf8");
  const runtime = readFileSync("componentes/appearance-runtime.tsx", "utf8");
  assert.match(trainer, /active === "apariencia".*<AppearanceSelector \/>/);
  assert.match(portal, /<AppearanceSelector \/>/);
  assert.match(profile, /<AppearanceSelector \/>/);
  assert.match(runtime, /media\?\.addEventListener\("change", onSystemChange\)/);
  assert.doesNotMatch(readFileSync("lib/appearance.ts", "utf8"), /api\/|workspaceId|CoachSettings/);
});
