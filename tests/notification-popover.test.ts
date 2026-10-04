import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actionMenuPosition } from "../lib/action-menu-position.ts";

const center = readFileSync(new URL("../componentes/admin-notification-center.tsx", import.meta.url), "utf8");
const studentShell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
const trainerTopbar = readFileSync(new URL("../componentes/admin-topbar.tsx", import.meta.url), "utf8");

test("alumno y entrenador comparten el popover anclado a su campana", () => {
  assert.match(studentShell, /<StudentNotificationCenter \/>/);
  assert.match(trainerTopbar, /<AdminNotificationCenter \/>/);
  assert.match(center, /return <NotificationCenter audience="student" \/>/);
  assert.match(center, /return <NotificationCenter audience="trainer" \/>/);
  assert.match(center, /trigger\.getBoundingClientRect\(\)/);
  assert.match(center, /actionMenuPosition\(/);
  assert.match(center, /createPortal\(/);
  assert.match(center, /className="fixed z-\[90\] flex flex-col/);
  assert.doesNotMatch(center, /inset-x-2 bottom-|bg-black\/65 backdrop-blur/);
});

test("el panel abre debajo, hace flip arriba y queda dentro del viewport", () => {
  const mobile = { width: 360, height: 740 };
  const below = actionMenuPosition({ top: 72, bottom: 112, right: 310 }, { width: 336, height: 380 }, mobile);
  assert.equal(below.placement, "below");
  assert.equal(below.top, 120);
  const above = actionMenuPosition({ top: 620, bottom: 660, right: 350 }, { width: 336, height: 380 }, mobile);
  assert.equal(above.placement, "above");
  for (const result of [below, above]) {
    assert.ok(result.left >= 8);
    assert.ok(result.left + result.width <= mobile.width - 8);
    assert.ok(result.top >= 8);
    assert.ok(result.top + result.maxHeight <= mobile.height - 8);
  }
  assert.match(center, /Math\.min\(400, window\.innerWidth - 24\)/);
  assert.match(center, /window\.innerHeight \* 0\.68/);
  assert.match(center, /overflow-y-auto overscroll-contain/);
});

test("cierres y acciones existentes permanecen conectados", () => {
  assert.match(center, /setOpenedOnPath\(\(current\) => current === pathname \? null : pathname\)/);
  assert.match(center, /!panelRef\.current\?\.contains\(target\)/);
  assert.match(center, /useEscapeLayer\(open, close/);
  assert.match(center, /panelRef\.current\?\.contains\(event\.target\)\) return/);
  assert.match(center, /const open = openedOnPath === pathname/);
  assert.match(center, /aria-expanded=\{open\}/);
  assert.match(center, /setUnreadCount\(data\.unreadCount\)/);
  assert.match(center, /onClick=\{markAllRead\}/);
  assert.match(center, /onClick=\{\(\) => void deleteAllNotifications\(\)\}/);
  assert.match(center, /onClick=\{\(\) => openNotification\(notification\)\}/);
  assert.match(center, /router\.push\(destination\)/);
  assert.match(center, /audience === "trainer"\s*\? "\/api\/admin\/notifications"\s*:\s*"\/api\/portal\/notifications"/);
});
