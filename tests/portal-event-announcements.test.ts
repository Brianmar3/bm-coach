import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { eventMatchesService, portalEventDismissalKey, visiblePortalEvents } from "../lib/portal-events.ts";
import type { CoachEvent } from "../types/gestion.ts";

function event(overrides: Partial<CoachEvent> = {}): CoachEvent {
  return { id: "event-1", title: "Entrenamiento especial", description: "", location: "", date: "2026-09-12", time: "10:00", color: "#facc15", type: "recordatorio", status: "pendiente", showToStudents: true, audience: "todos", createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z", ...overrides };
}

test("evento interno no es visible y Todos funciona para cada servicio", () => {
  assert.equal(eventMatchesService(event({ showToStudents: false }), "CLASSES"), false);
  assert.equal(eventMatchesService(event(), "CLASSES"), true);
  assert.equal(eventMatchesService(event(), "PERSONALIZED"), true);
  assert.equal(eventMatchesService(event(), "MIXED"), true);
});

test("cada audiencia usa el serviceType real y no incluye los demás", () => {
  assert.equal(eventMatchesService(event({ audience: "CLASSES" }), "CLASSES"), true);
  assert.equal(eventMatchesService(event({ audience: "CLASSES" }), "MIXED"), false);
  assert.equal(eventMatchesService(event({ audience: "PERSONALIZED" }), "PERSONALIZED"), true);
  assert.equal(eventMatchesService(event({ audience: "PERSONALIZED" }), "MIXED"), false);
  assert.equal(eventMatchesService(event({ audience: "MIXED" }), "MIXED"), true);
  assert.equal(eventMatchesService(event({ audience: "MIXED" }), "PERSONALIZED"), false);
});

test("vencidos desaparecen, futuros aparecen y el próximo queda primero", () => {
  const result = visiblePortalEvents([event({ id: "later", date: "2026-09-20" }), event({ id: "expired", date: "2026-09-01" }), event({ id: "next", date: "2026-09-10" })], "CLASSES", "2026-09-02");
  assert.deepEqual(result.map((item) => item.id), ["next", "later"]);
});

test("datos opcionales ausentes mantienen un evento válido", () => {
  const result = visiblePortalEvents([event({ description: "", location: "", time: "" })], "PERSONALIZED", "2026-09-02");
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Entrenamiento especial");
});

test("cerrar anuncio sólo persiste una clave local versionada", () => {
  assert.equal(portalEventDismissalKey("student-1", "event-1"), "bm-portal-event-dismissed:student-1:event-1");
  const portal = readFileSync("componentes/portal-section.tsx", "utf8");
  assert.match(portal, /localStorage\.setItem/);
  assert.doesNotMatch(portal, /coachEvent\.delete|\/api\/eventos.*DELETE/);
});

test("el anuncio está entre Hero y Enfoque y resume múltiples eventos", () => {
  const portal = readFileSync("componentes/portal-section.tsx", "utf8");
  assert.ok(portal.indexOf("<PortalEventAnnouncement") > portal.indexOf("portal-home-hero"));
  assert.ok(portal.indexOf("<PortalEventAnnouncement") < portal.indexOf("Enfoque de hoy"));
  assert.match(portal, /events\.length - 1/);
});

test("el entrenador conserva la consulta completa de sus eventos", () => {
  const trainerApi = readFileSync("app/api/eventos/route.ts", "utf8");
  assert.match(trainerApi, /prisma\.coachEvent\.findMany/);
  assert.doesNotMatch(trainerApi, /showToStudents: true/);
});

test("publicar reutiliza notificación interna y Push con clave idempotente", () => {
  const publication = readFileSync("lib/event-publication-notifications.ts", "utf8");
  assert.match(publication, /studentNotification\.create/);
  assert.match(publication, /sendStudentPush/);
  assert.match(publication, /coach-event:\$\{event\.id\}:\$\{student\.id\}/);
  assert.match(publication, /error\.code === "P2002"/);
});
