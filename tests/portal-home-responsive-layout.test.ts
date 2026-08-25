import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const overview = home.slice(home.indexOf("function PortalOverview"), home.indexOf("type PersonalizedHomePlan"));

test("el Home conserva altura natural en todas las modalidades", () => {
  assert.doesNotMatch(overview, /min-h-(?:screen|dvh|svh)|h-screen|flex-1|grow|justify-between|mt-auto/);
  assert.match(overview, /routineFocused/);
  assert.match(overview, /homePlan \? <RoutineHomeCard/);
  assert.match(overview, /groupClassesEnabled && <PortalClasses compact/);
});

test("el shell no fuerza un viewport vacío debajo del Home", () => {
  assert.match(shell, /const isHome = pathname === "\/portal"/);
  assert.match(shell, /isHome \? "" : "min-h-screen"/);
  assert.doesNotMatch(shell, /isHome \? "min-h-screen"/);
});

test("la reserva inferior usa una sola fuente de altura y separación", () => {
  assert.match(styles, /--portal-bottom-nav-height: 4\.75rem/);
  assert.match(styles, /--portal-bottom-nav-offset: 0\.75rem/);
  assert.match(styles, /--portal-bottom-nav-clearance: 1\.5rem/);
  assert.match(shell, /var\(--portal-bottom-nav-height\).*var\(--portal-bottom-nav-offset\).*var\(--portal-bottom-nav-clearance\).*env\(safe-area-inset-bottom\)/);
  assert.match(shell, /h-\[var\(--portal-bottom-nav-height\)\]/);
  assert.doesNotMatch(shell, /8\.25rem|h-\[76px\]/);
  assert.doesNotMatch(overview, /safe-area-inset-bottom|pb-\[calc\(/);
});

test("la navegación sigue fija y reserva 24px visuales sin tapar contenido", () => {
  assert.match(shell, /className="fixed bottom-\[calc\(env\(safe-area-inset-bottom\)\+var\(--portal-bottom-nav-offset\)\)\]/);
  assert.match(styles, /--portal-bottom-nav-clearance: 1\.5rem/);
});
