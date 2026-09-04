import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  argentinaLocalClock,
  classHasEnded,
  classIsEligibleForStudent,
  classIsInProgress,
  PORTAL_HOME_PREVIEW_COUNT,
  selectActivePortalSchedules,
  selectPortalClassAgenda,
  selectRelevantClassDay,
  selectUpcomingClassWindow,
  studentClassAvailability,
  studentIsActiveForClasses,
  type PortalWeeklyScheduleCandidate,
  type PortalClassCandidate,
} from "../lib/portal-class-schedule.ts";

function occurrence(id: string, date: string, startTime: string, endTime: string, status: PortalClassCandidate["status"] = "SCHEDULED", scheduleId = id): PortalClassCandidate {
  return { id, scheduleId, date, startTime, endTime, status };
}

function assignment(
  scheduleId: string,
  dayOfWeek: string,
  startTime: string,
  options: { active?: boolean; scheduleActive?: boolean; endedAt?: Date | null } = {},
): PortalWeeklyScheduleCandidate {
  return {
    scheduleId,
    active: options.active ?? true,
    endedAt: options.endedAt ?? null,
    schedule: {
      active: options.scheduleActive ?? true,
      dayOfWeek,
      startTime,
      endTime: "21:00",
      classType: "Entrenamiento funcional",
    },
  };
}

test("usa fecha y hora de America/Argentina/Buenos_Aires", () => {
  assert.deepEqual(argentinaLocalClock(new Date("2026-08-04T02:30:00.000Z")), { date: "2026-08-03", time: "23:30:00" });
});

test("el domingo 2 incluye la clase del lunes 3 aun a las 23:30 de Argentina", () => {
  const tomorrow = occurrence("monday", "2026-08-03", "07:00", "08:00");
  const result = selectUpcomingClassWindow([tomorrow], new Date("2026-08-03T02:30:00.000Z"));
  assert.deepEqual(result, { from: "2026-08-02", to: "2026-08-09", occurrenceIds: ["monday"] });
  assert.equal(selectRelevantClassDay([tomorrow], new Date("2026-08-03T02:30:00.000Z")).date, "2026-08-03");
});

test("los proximos siete dias cruzan semana y fin de mes sin usar UTC como dia local", () => {
  const result = selectUpcomingClassWindow([
    occurrence("july", "2026-07-31", "20:00", "21:00"),
    occurrence("august", "2026-08-03", "07:00", "08:00"),
    occurrence("outside", "2026-08-08", "07:00", "08:00"),
  ], new Date("2026-08-01T02:30:00.000Z"));
  assert.equal(result.from, "2026-07-31");
  assert.equal(result.to, "2026-08-07");
  assert.deepEqual(result.occurrenceIds, ["august"]);
});

test("la ventana futura excluye clases pasadas, inactivas y canceladas", () => {
  const now = new Date("2026-08-03T22:30:00.000Z");
  const result = selectUpcomingClassWindow([
    occurrence("ended", "2026-08-03", "18:00", "19:00"),
    occurrence("current", "2026-08-03", "19:00", "20:00"),
    occurrence("cancelled", "2026-08-04", "07:00", "08:00", "CANCELLED"),
    occurrence("valid", "2026-08-04", "08:00", "09:00"),
  ], now);
  assert.deepEqual(result.occurrenceIds, ["current", "valid"]);
});

test("la fuente única excluye finalizadas y canceladas antes de responder a Inicio o Clases", () => {
  const agenda = selectPortalClassAgenda([
    { ...occurrence("ended", "2026-08-03", "18:00", "19:00"), category: "GAP" },
    { ...occurrence("current", "2026-08-03", "19:00", "20:00"), category: "GAP" },
    { ...occurrence("cancelled", "2026-08-04", "07:00", "08:00", "CANCELLED"), category: "GAP" },
  ], "Adulto", new Date("2026-08-03T22:30:00.000Z"));
  assert.deepEqual(agenda.occurrences.map((item) => item.id), ["current"]);
  assert.deepEqual(agenda.focus.occurrenceIds, ["current"]);
  assert.equal(agenda.summary.total, 1);
});

test("los horarios semanales respetan actividad, vigencia y orden lunes a domingo", () => {
  const schedules = selectActivePortalSchedules([
    assignment("friday", "FRIDAY", "08:00"),
    assignment("inactive", "MONDAY", "07:00", { active: false }),
    assignment("ended", "TUESDAY", "07:00", { endedAt: new Date("2026-08-01T00:00:00.000Z") }),
    assignment("disabled-schedule", "WEDNESDAY", "07:00", { scheduleActive: false }),
    assignment("monday-late", "MONDAY", "20:00"),
    assignment("monday-early", "MONDAY", "07:00"),
  ]);
  assert.deepEqual(schedules.map((item) => item.scheduleId), ["monday-early", "monday-late", "friday"]);
});

test("mantiene hoy cuando hay una clase futura y las ordena por hora", () => {
  const result = selectRelevantClassDay([
    occurrence("late", "2026-08-03", "20:00", "21:00"),
    occurrence("early", "2026-08-03", "18:00", "19:00"),
  ], new Date("2026-08-03T19:00:00.000Z"));
  assert.equal(result.title, "Clases de hoy");
  assert.deepEqual(result.occurrenceIds, ["early", "late"]);
});

test("una clase iniciada y no finalizada sigue en curso", () => {
  const clock = argentinaLocalClock(new Date("2026-08-03T22:30:00.000Z"));
  const item = occurrence("current", "2026-08-03", "19:00", "20:00");
  assert.equal(classIsInProgress(item, clock), true);
  assert.equal(classHasEnded(item, clock), false);
  assert.equal(selectRelevantClassDay([item], new Date("2026-08-03T22:30:00.000Z")).date, "2026-08-03");
  assert.equal(classIsInProgress(item, argentinaLocalClock(new Date("2026-08-03T22:00:00.000Z"))), true);
});

test("al llegar exactamente al final considera terminada la última clase", () => {
  const today = occurrence("today", "2026-08-03", "20:00", "21:00");
  const tomorrow = occurrence("tomorrow", "2026-08-04", "07:00", "08:00");
  const now = new Date("2026-08-04T00:00:00.000Z");
  assert.equal(classHasEnded(today, argentinaLocalClock(now)), true);
  const result = selectRelevantClassDay([today, tomorrow], now);
  assert.equal(result.date, "2026-08-04");
  assert.equal(result.title, "Clases de mañana");
});

test("salta de viernes a lunes sin etiquetarlo como mañana", () => {
  const result = selectRelevantClassDay([
    occurrence("friday", "2026-08-07", "20:00", "21:00"),
    occurrence("monday", "2026-08-10", "07:00", "08:00"),
  ], new Date("2026-08-08T00:01:00.000Z"));
  assert.equal(result.date, "2026-08-10");
  assert.equal(result.title, "Próximas clases · Lunes 10 de agosto");
});

test("ignora una clase cancelada y busca la siguiente válida", () => {
  const result = selectRelevantClassDay([
    occurrence("cancelled", "2026-08-04", "07:00", "08:00", "CANCELLED"),
    occurrence("valid", "2026-08-05", "08:00", "09:00"),
  ], new Date("2026-08-04T00:01:00.000Z"));
  assert.equal(result.date, "2026-08-05");
  assert.deepEqual(result.occurrenceIds, ["valid"]);
});

test("la agenda general separa clases de adultos y Kids sin depender de asignaciones", () => {
  const classes = [
    { ...occurrence("functional", "2026-08-04", "07:00", "08:00"), category: "Entrenamiento funcional" },
    { ...occurrence("gap", "2026-08-04", "08:00", "09:00"), category: "GAP" },
    { ...occurrence("kids", "2026-08-04", "09:00", "10:00"), category: "Funcional Kids" },
  ];
  const now = new Date("2026-08-04T01:00:00.000Z");
  const adultAgenda = selectPortalClassAgenda(classes, "Adulto", now);
  const kidsAgenda = selectPortalClassAgenda(classes, "Kids", now);

  assert.deepEqual(adultAgenda.occurrences.map((item) => item.id), ["functional", "gap"]);
  assert.deepEqual(adultAgenda.focus.occurrenceIds, ["functional", "gap"]);
  assert.deepEqual(kidsAgenda.occurrences.map((item) => item.id), ["kids"]);
  assert.equal(classIsEligibleForStudent("Funcional Kids", "Adulto"), false);
  assert.equal(classIsEligibleForStudent("Entrenamiento funcional", "Kids"), false);
});

test("un día con siete clases conserva el total bruto y calcula totales visibles por elegibilidad", () => {
  const classes = [
    { ...occurrence("functional-07", "2026-08-03", "07:00", "08:00"), category: "Entrenamiento funcional" },
    { ...occurrence("functional-08", "2026-08-03", "08:00", "09:00"), category: "Entrenamiento funcional" },
    { ...occurrence("kids-09", "2026-08-03", "09:00", "10:00"), category: "Funcional Kids" },
    { ...occurrence("functional-1530", "2026-08-03", "15:30", "16:30"), category: "Entrenamiento funcional" },
    { ...occurrence("kids-1630", "2026-08-03", "16:30", "17:30"), category: "Funcional Kids" },
    { ...occurrence("functional-19", "2026-08-03", "19:00", "20:00"), category: "Entrenamiento funcional" },
    { ...occurrence("functional-20", "2026-08-03", "20:00", "21:00"), category: "Entrenamiento funcional" },
  ];
  const now = new Date("2026-08-03T09:00:00.000Z");
  const adultAgenda = selectPortalClassAgenda(classes, "Adulto", now);
  const kidsAgenda = selectPortalClassAgenda(classes, "Kids", now);

  assert.equal(classes.length, 7);
  assert.equal(adultAgenda.summary.total, 5);
  assert.equal(adultAgenda.focus.occurrenceIds.length, adultAgenda.summary.total);
  assert.equal(adultAgenda.occurrences.length, adultAgenda.summary.total);
  assert.equal(kidsAgenda.summary.total, 2);
  assert.equal(kidsAgenda.focus.occurrenceIds.length, kidsAgenda.summary.total);
  assert.equal(adultAgenda.summary.preview.length, PORTAL_HOME_PREVIEW_COUNT);
  assert.deepEqual(adultAgenda.summary.preview.map((item) => item.id), ["functional-07", "functional-08"]);
  assert.equal(adultAgenda.summary.hiddenCount, 3);
  assert.equal(adultAgenda.summary.firstStartTime, "07:00");
  assert.equal(adultAgenda.summary.lastStartTime, "20:00");
  assert.equal(adultAgenda.summary.mode, "TODAY");
  assert.equal(adultAgenda.summary.dateLabel, "Lunes, 3 de agosto");
});

test("cinco clases disponibles describen oferta general y no asignaciones del alumno", () => {
  const general = Array.from({ length: 5 }, (_, index) => ({
    ...occurrence(`general-${index}`, "2026-08-10", `${7 + index}:00`, `${8 + index}:00`),
    category: "Entrenamiento funcional",
  }));
  const agenda = selectPortalClassAgenda(general, "Adulto", new Date("2026-08-08T12:00:00.000Z"));
  const studentAssignments = selectActivePortalSchedules([
    assignment("assigned-thursday", "THURSDAY", "07:00"),
    assignment("assigned-friday", "FRIDAY", "07:00"),
  ]);
  assert.equal(agenda.summary.total, 5);
  assert.equal(studentAssignments.length, 2);
});

test("el resumen cambia a próximo día sin llamarlo mañana", () => {
  const agenda = selectPortalClassAgenda([
    { ...occurrence("monday", "2026-08-10", "07:00", "08:00"), category: "GAP" },
  ], "Adulto", new Date("2026-08-08T12:00:00.000Z"));
  assert.equal(agenda.summary.mode, "NEXT_DAY");
  assert.equal(agenda.summary.date, "2026-08-10");
  assert.equal(agenda.summary.dateLabel, "Lunes, 10 de agosto");
  assert.equal(agenda.summary.total, 1);
});

test("los horarios fijos y la agenda general conservan fuentes independientes", () => {
  const fixedGap = selectActivePortalSchedules([
    {
      ...assignment("fixed-gap", "MONDAY", "17:00"),
      schedule: {
        ...assignment("fixed-gap", "MONDAY", "17:00").schedule,
        classType: "GAP",
      },
    },
  ]);
  const agenda = selectPortalClassAgenda([
    { ...occurrence("functional", "2026-08-03", "18:00", "19:00"), category: "Entrenamiento funcional" },
    { ...occurrence("gap", "2026-08-03", "20:00", "21:00"), category: "GAP" },
  ], "Adulto", new Date("2026-08-03T19:00:00.000Z"));

  assert.deepEqual(fixedGap.map((item) => item.schedule.classType), ["GAP"]);
  assert.deepEqual(agenda.focus.occurrenceIds, ["functional", "gap"]);
  assert.deepEqual(selectActivePortalSchedules([]), []);
  assert.deepEqual(agenda.occurrences.map((item) => item.id), ["functional", "gap"]);
});

test("alumno inactivo o suspendido no tiene clases disponibles", () => {
  assert.equal(studentIsActiveForClasses("inactivo"), false);
  assert.equal(studentIsActiveForClasses("activo", "suspendido"), false);
  assert.equal(studentIsActiveForClasses("activo"), true);
  assert.equal(studentClassAvailability("inactivo", "inactivo").reason, "INACTIVE");
  assert.equal(studentClassAvailability("activo", "suspendido").reason, "SUSPENDED");
  assert.equal(studentClassAvailability("activo").message, null);
});

test("devuelve estado vacío cuando no hay próximas clases dentro del rango", () => {
  const result = selectRelevantClassDay([], new Date("2026-08-03T19:00:00.000Z"), 35);
  assert.equal(result.date, null);
  assert.equal(result.subtitle, "No encontramos próximas clases asignadas. Consultá con tu entrenador.");
});

test("la API deriva el alumno desde sesión y consulta la agenda general activa", () => {
  const source = readFileSync(new URL("../app/api/portal/clases/route.ts", import.meta.url), "utf8");
  assert.match(source, /session\.studentId/);
  assert.doesNotMatch(source, /input\.studentId/);
  assert.match(source, /schedule: \{ active: true, archivedAt: null \}/);
  assert.doesNotMatch(source, /assignedScheduleIds/);
  assert.doesNotMatch(source, /occurrenceBelongsToStudent/);
});

test("la API materializa recurrencias y devuelve una única agenda elegible calculada en servidor", () => {
  const source = readFileSync(new URL("../app/api/portal/clases/route.ts", import.meta.url), "utf8");
  assert.ok(source.indexOf("ensureClassOccurrences(PORTAL_CLASS_SEARCH_DAYS)") < source.indexOf("prisma.classOccurrence.findMany"));
  assert.match(source, /selectPortalClassAgenda\(occurrences\.map\(\(occurrence\) => serializeOccurrence\(occurrence, session\.studentId, effectiveSessions\)\), student\.studentType\)/);
  assert.match(source, /selectActivePortalSchedules\(assignments\)/);
  assert.match(source, /summary: agenda\.summary/);
  const query = source.slice(source.indexOf("prisma.classOccurrence.findMany"), source.indexOf("const agenda = selectPortalClassAgenda"));
  assert.doesNotMatch(query, /take:|limit:|\.slice\(/);
});

test("la vista consume la ventana del servidor y muestra un unico estado vacio", () => {
  const source = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  assert.match(source, /data\?\.upcoming\.occurrenceIds/);
  assert.doesNotMatch(source, /const weekStart =/);
  assert.equal(source.match(/No hay clases disponibles durante los próximos 7 días\./g)?.length, 1);
  assert.ok((source.match(/noClassesMessage/g)?.length ?? 0) >= 3);
  assert.match(source, /data\.availability\.message/);
});

test("Inicio usa total y preview del servidor sin recortar la fuente completa", () => {
  const source = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  assert.match(source, /data\.summary\.total/);
  assert.match(source, /data\.summary\.preview\.map/);
  assert.match(source, /data\.summary\.preview\.map/);
  assert.match(source, /Ver agenda completa/);
  assert.match(source, /data\.summary\.firstStartTime/);
  assert.match(source, /data\.summary\.lastStartTime/);
  assert.match(source, /Ver todos los horarios/);
  assert.doesNotMatch(source, /focusItems\.slice\(/);
  assert.match(source, /focusItems\.map/);
});

test("la vista de clases usa jerarquia premium y selector segmentado", () => {
  const source = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  for (const text of ["Agenda presencial", "Tus próximas clases", "Consultá tus horarios y confirmá tu asistencia.", "Clases de hoy", "Próximos 7 días"]) {
    assert.match(source, new RegExp(text));
  }
  assert.match(source, /aria-label="Vista de clases"/);
  assert.match(source, /focusSectionLabel\(data\)/);
  assert.match(source, /aria-pressed=\{!showWeek\}/);
  assert.match(source, /onClick=\{\(\) => setShowWeek\(false\)\}/);
  assert.match(source, /onClick=\{\(\) => setShowWeek\(true\)\}/);
  assert.doesNotMatch(source, /PRÓXIMA CLASE|nextClass/);
  assert.match(source, /aria-label="Vista de clases" className="portal-home-class-row mt-6/);
});

test("Funcional, GAP y Kids conservan el nombre real sin emojis ni variantes visuales", () => {
  const source = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  assert.match(source, /function disciplineLabel/);
  assert.match(source, /item\.name \|\| item\.category/);
  for (const emoji of ["🍑", "🧒", "💪", "💪🏽"]) assert.doesNotMatch(source, new RegExp(emoji, "u"));
  assert.doesNotMatch(source, /discipline\.icon|discipline\.accent|border-l-pink|border-l-sky/);
  assert.doesNotMatch(source, /ubicaci[oó]n/i);
});

test("cada clase usa una fila compacta con horario, estado, contador y respuestas", () => {
  const source = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  const row = source.slice(source.indexOf("function ClassRow"), source.indexOf("function Feedback"));
  assert.match(row, /item\.startTime/);
  assert.match(row, /item\.endTime/);
  assert.match(row, /Confirmada/);
  assert.match(row, /item\.statusLabel/);
  assert.match(row, /item\.confirmedCount === 1 \? "confirmado" : "confirmados"/);
  assert.match(row, /<ResponseButtons/);
  assert.doesNotMatch(row, /discipline\.icon|rounded-2xl.*shadow/);
});

test("horarios semanales y registros conservan acceso y presentación móvil compacta", () => {
  const source = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  const actionCard = readFileSync(new URL("../componentes/portal-action-card.tsx", import.meta.url), "utf8");
  assert.match(source, /Mis horarios semanales/);
  assert.match(source, /Ver semana/);
  assert.match(source, /data\.scheduleLabels/);
  assert.match(source, /href="\/portal\/registro"/);
  assert.match(source, /Ver mis registros/);
  assert.match(source, /PortalActionCard href="\/portal\/registro"/);
  assert.match(source, /title="Mis registros" subtitle="Ejercicios, cargas y marcas"/);
  assert.doesNotMatch(source, /Consultá tus ejercicios, cargas y marcas registradas/);
  assert.doesNotMatch(source, /<p[^>]*>Mis registros<\/p>/);
  assert.match(source, /BmHistoryIcon/);
  assert.doesNotMatch(source, /function RecordsIcon/);
  assert.match(source, /grid-cols-2/);
  assert.match(source, /min-w-0/);
  assert.match(source, /min-h-12/);
  assert.match(source, /rounded-2xl/);
  assert.match(source, /border-white\/\[\.08\]/);
  assert.match(actionCard, /border-white\/\[\.08\]/);
  assert.match(actionCard, /focus-visible:ring-offset-2/);
  assert.match(actionCard, /BmChevronRightIcon/);
  assert.doesNotMatch(actionCard, /<svg aria-hidden="true"/);
  assert.doesNotMatch(source, /overflow-x-auto/);
});

test("las tabs no usan fondo amarillo sólido y la navegación inferior conserva sus rutas", () => {
  const classes = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
  const tabs = classes.slice(classes.indexOf('aria-label="Vista de clases"'), classes.indexOf("<Feedback", classes.indexOf('aria-label="Vista de clases"')));
  assert.match(tabs, /border-yellow-400 text-yellow-300|border-b-yellow-400 text-yellow-300/);
  assert.doesNotMatch(tabs, /bg-yellow-400 text-zinc-950/);
  for (const route of ["/portal", "/portal/rutina", "/portal/clases", "/portal/nutricion", "/portal/evaluaciones"]) assert.match(shell, new RegExp(`"${route}"`));
});

test("confirmar asistencia conserva endpoint, payload y protección de doble toque", () => {
  const source = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  assert.match(source, /fetch\("\/api\/portal\/clases"/);
  assert.match(source, /body: JSON\.stringify\(\{ occurrenceId: item\.id, response: value \}\)/);
  assert.match(source, /onClick=\{\(\) => respond\(item, "GOING"\)\}/);
  assert.match(source, /onClick=\{\(\) => respond\(item, "NOT_GOING"\)\}/);
  assert.match(source, /if \(responseInFlight\.current\) return/);
  assert.match(source, /responseInFlight\.current = true/);
  assert.match(source, /responseInFlight\.current = false/);
  assert.equal(source.match(/disabled=\{saving\}/g)?.length, 3);
});

test("Inicio conserva el dorado como acento sin botones ni superficies dominantes", () => {
  const classes = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  const quickLog = readFileSync(new URL("../componentes/quick-log.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
  const responseButtons = classes.slice(classes.indexOf("function ResponseButtons"));
  const quickLogButton = quickLog.slice(quickLog.indexOf("export function QuickNoteButton"), quickLog.indexOf("function GuidedQuickLogForm"));
  assert.doesNotMatch(responseButtons, /"bg-yellow-400 text-zinc-950 hover:bg-yellow-300"/);
  assert.match(responseButtons, /<BmCheckIcon size=\{17\} \/> Asistiré/);
  assert.match(responseButtons, /border-zinc-700 bg-zinc-950/);
  const quickLogTriggerStyles = quickLogButton.slice(quickLogButton.indexOf("const className"), quickLogButton.indexOf("return <Link"));
  assert.doesNotMatch(quickLogTriggerStyles, /\bfixed\b|portal-quick-note-bottom/);
  assert.match(quickLogButton, /border-yellow-400\/45 bg-zinc-950/);
  assert.match(quickLogButton, /href="\/portal\/registro"/);
  assert.match(shell, /absolute bottom-1\.5 h-0\.5 w-4 rounded-full bg-yellow-300/);
  assert.doesNotMatch(shell, /drop-shadow-\[0_0_6px_rgba\(250,204,21/);
  assert.match(home, /role="progressbar"/);
  assert.match(home, /from-amber-500 to-yellow-300/);
  assert.match(home, /MonthlyAttendanceIndicator/);
});

test("Inicio replica la jerarquía compacta y conecta todos los accesos de la referencia", () => {
  const home = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
  const pointsPage = readFileSync(new URL("../app/portal/(student)/puntos/page.tsx", import.meta.url), "utf8");
  const overview = home.slice(home.indexOf("function PortalOverview"), home.indexOf("function HomeQuickStats"));
  const pointsView = home.slice(home.indexOf("function PointsAndAchievementsView"), home.indexOf("function MonthlyAttendanceIndicator"));
  assert.match(overview, /Enfoque de hoy/);
  assert.doesNotMatch(overview, /WeeklyMissionAchievement|Misión semanal|Misión de la semana/);
  assert.match(overview, /<PortalClasses compact/);
  assert.match(overview, /HomeQuickStats/);
  assert.doesNotMatch(overview, /<ProgressSummary|<PointsSummary|<AchievementsSpotlight/);
  assert.match(pointsView, /<WeeklyMissionAchievement data=\{data\}/);
  assert.match(home, /Activa/);
  assert.match(home, /Completada/);
  assert.match(home, /Vencida/);
  for (const href of ["/portal/asistencias", "/portal/pagos", "/portal/puntos"]) assert.match(home, new RegExp(`href="${href}"`));
  assert.match(shell, /"\/portal\/evaluaciones"/);
  assert.match(pointsPage, /section="puntos"/);
  for (const label of ["Inicio", "Rutina", "Clases", "Nutrición", "Evaluación"]) assert.match(shell, new RegExp(label));
  assert.match(home, /grid grid-cols-2/);
  const quickStats = home.slice(home.indexOf("function HomeQuickStats"), home.indexOf("function WeeklyMissionAchievement"));
  assert.match(quickStats, /competitive \? <Link href="\/portal\/puntos"/);
  assert.match(quickStats, /href="\/portal\/progreso"/);
  assert.doesNotMatch(overview, /overflow-x-auto/);
});

test("la confirmación del servidor admite clases generales elegibles y conserva cupo atómico", () => {
  const source = readFileSync(new URL("../app/api/portal/clases/route.ts", import.meta.url), "utf8");
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /classIsEligibleForStudent\(occurrence\.schedule\.classType, student\.studentType\)/);
  assert.match(source, /effectiveConfirmedCount >= occurrence\.capacityOverride/);
  assert.match(source, /classOccurrenceAttendance\.updateMany/);
  assert.match(source, /response: null/);
  assert.match(source, /classOccurrenceAttendance\.upsert/);
  assert.doesNotMatch(source, /occurrence\.schedule\?\.assignments\.length/);
});
