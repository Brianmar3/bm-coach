"use client";

import { createContext, FormEvent, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { RoutineFollowUpDashboard } from "@/componentes/routine-follow-up-dashboard";
import { RoutineTableView } from "@/componentes/routine-table-view";
import { RoutineManagementPanel } from "@/componentes/routine-management-panel";
import { RoutineDuplicatesReview } from "@/componentes/routine-duplicates-review";
import { RoutineCreationDialog } from "@/componentes/routine-creation-dialog";
import { TrainerFloatingActions } from "@/componentes/trainer-floating-actions";
import { TrainingLibraryBlocksPanel } from "@/componentes/training-library-blocks";
import { TrainingLibraryBlockPicker } from "@/componentes/training-library-block-picker";
import { TrainingTagInput } from "@/componentes/training-tag-input";
import { ExerciseLibraryPicker } from "@/componentes/exercise-library";
import { RoutineExerciseMediaButton } from "@/componentes/routine-exercise-media";
import { ContextualSuggestion, RoutineEvaluationPanel, useRoutineEvaluation } from "@/componentes/routine-evaluation-panel";
import { useRoutineKeyboardNavigation } from "@/componentes/use-routine-keyboard-navigation";
import { contextualExerciseSuggestions, uncoveredPriorityReminders } from "@/lib/evaluation-interpretation";
import { CLASS_TYPE_TAG_PREFIX, classTemplateToClassDraft, classTemplateToRoutineDraft, isClassTypeTag, type ClassBaseDayDraft, type ClassBaseRoutineDraft } from "@/lib/class-template-base";
import { clearedExerciseTarget } from "@/lib/training-blocks";
import { searchStudents } from "@/lib/student-search";
import { applyLibraryExerciseSelection, createEmptyRoutineExerciseDraft, persistedRoutineExerciseVideoUrl, removeRoutineExerciseDraft, unlinkLibraryExercise, type RoutineExerciseDraft } from "@/lib/routine-exercise-draft";
import { libraryExerciseIdFromMediaUrl, resolveRoutineExerciseMedia } from "@/lib/routine-exercise-media";
import { numericDraftValue, repetitionRangeDraft, serializedRepetitionRange } from "@/lib/routine-numeric-draft";
import { editableBlockToLibrarySnapshot, librarySnapshotToEditableBlock, type EditableTrainingBlockDraft } from "@/lib/training-library-block-draft";
import { routineStatusCounts, routinesForStatusSection, type RoutineStatusSection } from "@/lib/routine-list-organization";
import { focusRoutineValidationField } from "@/lib/routine-validation-focus";
import { routineValidationIssues, type RoutineInput, type RoutineValidationIssue } from "@/lib/rutinas";
import type { Student, TrainingBlockType, TrainingEffortType, TrainingRoutine, TrainingRoutineKind, TrainingRoutineLevel, TrainingRoutineStatus } from "@/types/gestion";
import type { BMExercise } from "@/types/exercise-library";
import type { TrainingLibraryBlock, TrainingLibraryBlockPayload, TrainingLibraryFolder } from "@/types/training-library";

type ExerciseDraft = RoutineExerciseDraft;
type BlockDraft = EditableTrainingBlockDraft;
type DayDraft = ClassBaseDayDraft;
type RoutineDraft = ClassBaseRoutineDraft;
type RoutineVersionItem = { id: string; version: number; summary: string; createdAt: string };
type CopyMode = "saveAsTemplate" | "useTemplate";
type CopyFlow = { source: TrainingRoutine; mode: CopyMode };
type LibraryDialogMode = "manage" | "saveCopy";
type EditorLibraryProps = {
  libraryBlocks: TrainingLibraryBlock[];
  libraryFolders: TrainingLibraryFolder[];
  libraryReady: boolean;
  libraryLoadError: string;
  saveBlockToLibrary: (block: BlockDraft) => void;
  onLibraryBlockChanged: (block: TrainingLibraryBlock) => void;
};

const RoutineValidationContext = createContext<{ issues: RoutineValidationIssue[]; activeDay: number }>({ issues: [], activeDay: 1 });
const BlockValidationContext = createContext<{ issues: RoutineValidationIssue[]; prefix: string }>({ issues: [], prefix: "" });

function validationIssue(issues: RoutineValidationIssue[], key: string) { return issues.find((issue) => issue.key === key); }
function validationInputClass(issue?: RoutineValidationIssue) { return issue ? "border-red-400/70 focus:border-red-400 focus:ring-2 focus:ring-red-400/30" : ""; }
function validationMessageId(key: string) { return `validation-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`; }
function FieldValidationMessage({ issue }: { issue?: RoutineValidationIssue }) { return issue ? <span id={validationMessageId(issue.key)} className="mt-1 block text-xs font-medium text-red-300">{issue.message}</span> : null; }
function validationAttributes(key: string, issue?: RoutineValidationIssue) { return { "data-validation-key": key, "aria-invalid": issue ? true as const : undefined, "aria-describedby": issue ? validationMessageId(key) : undefined }; }

const objectives = ["Hipertrofia", "Fuerza", "Descenso de grasa", "Rehabilitación", "Funcional", "Resistencia", "Movilidad"];
const levels: TrainingRoutineLevel[] = ["principiante", "intermedio", "avanzado"];
const statuses: TrainingRoutineStatus[] = ["borrador", "activa", "finalizada", "archivada"];
const muscleGroups = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Cuádriceps", "Isquiotibiales", "Glúteos", "Gemelos", "Core", "Cuerpo completo", "Movilidad"];

function newExercise(order: number, type: TrainingBlockType = "STRENGTH"): ExerciseDraft {
  return createEmptyRoutineExerciseDraft(order, type);
}

const blockLabels: Record<TrainingBlockType, string> = { STRENGTH: "Fuerza", ROUNDS: "Circuito", INTERVAL: "Intervalos", EMOM: "EMOM", AMRAP: "AMRAP", FOR_TIME: "For time", FREE: "Bloque libre", MOBILITY: "Movilidad" };
const classTypes = ["Funcional", "GAP", "Kids", "Personalizado", "Gimnasio", "Casa", "Otro"] as const;
const classTypeTagPrefix = CLASS_TYPE_TAG_PREFIX;

function classTypeFromTags(tags: string[]) {
  const stored = tags.find((tag) => tag.toLocaleLowerCase("es").startsWith(classTypeTagPrefix.toLocaleLowerCase("es")))?.slice(classTypeTagPrefix.length).trim();
  return classTypes.find((type) => type.toLocaleLowerCase("es") === stored?.toLocaleLowerCase("es")) ?? "Otro";
}

function visibleClassTags(tags: string[]) {
  return tags.filter((tag) => !isClassTypeTag(tag));
}

function classTagsWithType(tags: string[], type: string) {
  return [...visibleClassTags(tags), `${classTypeTagPrefix} ${type}`];
}

function newBlock(type: TrainingBlockType, order: number): BlockDraft {
  return { clientId: crypto.randomUUID(), type, name: type === "STRENGTH" ? "Bloque de fuerza" : blockLabels[type], order, rounds: ["ROUNDS", "INTERVAL", "FOR_TIME"].includes(type) ? 3 : null, durationSeconds: type === "MOBILITY" ? 300 : ["EMOM", "AMRAP"].includes(type) ? 600 : null, workSeconds: type === "INTERVAL" ? 40 : null, restSeconds: type === "INTERVAL" ? 20 : null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: "", exercises: [] };
}

function blankRoutine(kind: TrainingRoutineKind = "assigned"): RoutineDraft {
  return {
    name: "",
    kind,
    description: "",
    objective: "Hipertrofia",
    level: "principiante",
    status: "borrador",
    startDate: "",
    durationWeeks: null,
    priorityMuscles: [],
    location: "",
    equipment: [],
    tags: kind === "template" ? [`${classTypeTagPrefix} Funcional`] : [],
    studentIds: [],
    days: [{ clientId: crypto.randomUUID(), dayNumber: 1, name: kind === "template" ? "Clase" : "Día 1", objective: "", warmup: "", observations: "", estimatedMinutes: null, blocks: [newBlock("STRENGTH", 1)], exercises: [] }],
  };
}

function routineDraft(routine: TrainingRoutine): RoutineDraft {
  return {
    name: routine.name,
    kind: routine.kind,
    description: routine.description,
    objective: routine.objective,
    level: routine.level,
    status: routine.status,
    startDate: routine.startDate,
    durationWeeks: routine.durationWeeks,
    priorityMuscles: routine.priorityMuscles,
    location: routine.location,
    equipment: routine.equipment,
    tags: routine.tags,
    studentIds: routine.studentIds,
    days: routine.days.map((day) => ({
      id: day.id,
      clientId: crypto.randomUUID(),
      dayNumber: day.dayNumber,
      name: day.name,
      objective: day.objective,
      warmup: day.warmup ?? "",
      observations: day.observations,
      estimatedMinutes: day.estimatedMinutes,
      blocks: (day.blocks.length ? day.blocks : [{ id: `legacy-${day.id}`, type: "STRENGTH" as const, name: "Bloque de fuerza", order: 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: "", exercises: day.exercises }]).map((block) => ({
        ...block,
        clientId: crypto.randomUUID(),
        exercises: block.exercises.map((exercise) => ({ ...exercise, clientId: crypto.randomUUID(), libraryExerciseId: libraryExerciseIdFromMediaUrl(exercise.videoUrl) ?? undefined })),
      })),
      exercises: day.exercises.map((exercise) => ({ ...exercise, clientId: crypto.randomUUID(), libraryExerciseId: libraryExerciseIdFromMediaUrl(exercise.videoUrl) ?? undefined })),
    })),
  };
}

function label(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

async function responseError(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}

export default function RutinasPage() {
  const [activeTab, setActiveTab] = useState<"rutinas" | "plantillas" | "seguimiento">(() => {
    if (typeof window === "undefined") return "rutinas";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested === "plantillas" || requested === "seguimiento" ? requested : "rutinas";
  });
  const [trackingStudentId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("studentId") ?? "");
  const [trackingSessionId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("sessionId") ?? "");
  const [trackingStudentIds] = useState(() => typeof window === "undefined" ? [] : (new URLSearchParams(window.location.search).get("studentIds") ?? "").split(",").filter(Boolean));
  const [trackingSessionIds] = useState(() => typeof window === "undefined" ? [] : (new URLSearchParams(window.location.search).get("sessionIds") ?? "").split(",").filter(Boolean));
  const [requestedStudentView] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "active");
  const [items, setItems] = useState<TrainingRoutine[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [routineSection, setRoutineSection] = useState<RoutineStatusSection>("activas");
  const [librarySection, setLibrarySection] = useState<"classes" | "blocks">("classes");
  const [libraryBlocks, setLibraryBlocks] = useState<TrainingLibraryBlock[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<TrainingLibraryFolder[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryLoadError, setLibraryLoadError] = useState("");
  const [libraryReload, setLibraryReload] = useState(0);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [libraryDialogMode, setLibraryDialogMode] = useState<LibraryDialogMode>("manage");
  const [libraryEditing, setLibraryEditing] = useState<TrainingLibraryBlock | null>(null);
  const [libraryBlockDraft, setLibraryBlockDraft] = useState<BlockDraft | null>(null);
  const [libraryFolderId, setLibraryFolderId] = useState("");
  const [libraryTags, setLibraryTags] = useState<string[]>([]);
  const [librarySaving, setLibrarySaving] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [editorNotice, setEditorNotice] = useState("");
  const [objectiveFilter, setObjectiveFilter] = useState("todos");
  const [studentFilter, setStudentFilter] = useState(trackingStudentId || "todos");
  const [form, setForm] = useState<RoutineDraft>(blankRoutine());
  const [editing, setEditing] = useState<TrainingRoutine | null>(null);
  const [viewing, setViewing] = useState<TrainingRoutine | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState("");
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [validationIssues, setValidationIssues] = useState<RoutineValidationIssue[]>([]);
  const [notice, setNotice] = useState("");
  const [historyRoutine, setHistoryRoutine] = useState<TrainingRoutine | null>(null);
  const [versions, setVersions] = useState<RoutineVersionItem[]>([]);
  const [copyFlow, setCopyFlow] = useState<CopyFlow | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<TrainingRoutine | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [baseSource, setBaseSource] = useState<TrainingRoutine | null>(null);
  const [baseDraftDestination, setBaseDraftDestination] = useState<"class" | "routine" | null>(null);
  const [replaceOnActivate, setReplaceOnActivate] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const copyRequestInFlight = useRef(false);

  function updateEditorForm(nextForm: RoutineDraft) {
    setForm(nextForm);
    if (!validationIssues.length) return;
    const nextIssues = routineValidationIssues(nextForm as RoutineInput);
    setValidationIssues(nextIssues);
    if (!nextIssues.length) setError("");
    else setError(nextIssues[0].summary);
  }

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/rutinas", { signal: controller.signal, cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar las rutinas.")); return response.json() as Promise<TrainingRoutine[]>; }),
      fetch("/api/alumnos", { signal: controller.signal, cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los alumnos.")); return response.json() as Promise<Student[]>; }),
    ]).then(([routines, realStudents]) => {
      setItems(routines);
      setStudents(realStudents);
      if (requestedStudentView && trackingStudentId) {
        const activeRoutine = routines.find((routine) =>
          routine.kind === "assigned" &&
          routine.status === "activa" &&
          routine.studentIds.includes(trackingStudentId)
        );
        if (activeRoutine) setViewing(activeRoutine);
      }
    }).catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message); }).finally(() => setReady(true));
    return () => controller.abort();
  }, [requestedStudentView, trackingStudentId]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/training-library/blocks", { signal: controller.signal, cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los bloques.")); return response.json() as Promise<TrainingLibraryBlock[]>; }),
      fetch("/api/training-library/folders", { signal: controller.signal, cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar las carpetas.")); return response.json() as Promise<TrainingLibraryFolder[]>; }),
    ]).then(([blocks, folders]) => { setLibraryBlocks(blocks); setLibraryFolders(folders); }).catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setLibraryLoadError(loadError.message); }).finally(() => setLibraryReady(true));
    return () => controller.abort();
  }, [libraryReload]);

  const objectiveOptions = useMemo(() => [...new Set([...objectives, ...items.map((item) => item.objective)])].sort((a, b) => a.localeCompare(b, "es")), [items]);
  const statusCounts = useMemo(() => routineStatusCounts(items), [items]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    const candidates = activeTab === "plantillas" ? items : routinesForStatusSection(items, routineSection);
    return candidates.filter((routine) => {
      const matchesQuery = !normalized || `${routine.name} ${routine.description} ${routine.objective} ${routine.tags.join(" ")} ${routine.equipment.join(" ")} ${activeTab === "plantillas" ? "" : routine.historicalStudents.map((student) => student.name).join(" ")}`.toLocaleLowerCase("es").includes(normalized);
      if (activeTab === "plantillas") return routine.kind === "template" && matchesQuery && (objectiveFilter === "todos" || routine.objective === objectiveFilter);
      return matchesQuery
      && (objectiveFilter === "todos" || routine.objective === objectiveFilter)
      && (studentFilter === "todos" || (routine.status === "archivada" ? routine.historicalStudents.some((student) => student.id === studentFilter) : routine.studentIds.includes(studentFilter)));
    });
  }, [activeTab, items, objectiveFilter, query, routineSection, studentFilter]);

  function begin(routine?: TrainingRoutine, kind?: TrainingRoutineKind) {
    setEditing(routine ?? null);
    setForm(routine ? routineDraft(routine) : blankRoutine(kind ?? (activeTab === "plantillas" ? "template" : "assigned")));
    setActiveDay(1);
    setError("");
    setValidationIssues([]);
    setEditorNotice("");
    setBaseDraftDestination(null);
    setReplaceOnActivate(false);
    setOpen(true);
  }

  function beginFromClassBase(destination: "class" | "routine", source: TrainingRoutine | null = baseSource) {
    if (!source) return;
    const draft = destination === "class" ? classTemplateToClassDraft(source) : classTemplateToRoutineDraft(source);
    setEditing(null);
    setForm(draft);
    setActiveDay(1);
    setError("");
    setValidationIssues([]);
    setEditorNotice(destination === "class" ? "Clase cargada desde Biblioteca. Podés editarla antes de guardarla." : "Rutina cargada desde una clase de Biblioteca. Completá sus datos antes de guardarla.");
    setReplaceOnActivate(false);
    setBaseDraftDestination(destination);
    setBaseSource(null);
    setOpen(true);
  }

  function startRoutineFromScratch() {
    setCreationOpen(false);
    begin(undefined, "assigned");
  }

  function startRoutineFromClass(source: TrainingRoutine) {
    setCreationOpen(false);
    beginFromClassBase("routine", source);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;
    const intent = submitter.value;
    const updatingActiveRoutine = editing?.status === "activa";
    const classTemplate = form.kind === "template" && form.days.length === 1;
    const requestedStatus = classTemplate ? editing?.status ?? "borrador" : updatingActiveRoutine ? "activa" : intent === "draft" ? "borrador" : intent === "activate" ? "activa" : form.status;
    const payload = {
      ...form,
      status: requestedStatus,
      tags: classTemplate ? classTagsWithType(form.tags, classTypeFromTags(form.tags)) : form.tags,
      replaceActive: requestedStatus === "activa" && replaceOnActivate,
      days: form.days.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        name: classTemplate ? form.name.trim() : day.name,
        objective: classTemplate ? form.objective.trim() : day.objective,
        warmup: day.warmup,
        observations: day.observations,
        estimatedMinutes: day.estimatedMinutes,
        blocks: [...day.blocks].sort((a, b) => a.order - b.order).map((block, blockIndex) => ({
          id: block.id,
          type: block.type,
          name: block.name,
          order: blockIndex + 1,
          rounds: block.rounds,
          durationSeconds: block.durationSeconds,
          workSeconds: block.workSeconds,
          restSeconds: block.restSeconds,
          restBetweenRoundsSeconds: block.restBetweenRoundsSeconds,
          targetRounds: block.targetRounds,
          instructions: block.instructions,
          exercises: [...block.exercises].sort((a, b) => a.order - b.order).map((exercise, index) => ({
            id: exercise.id,
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            sets: exercise.sets,
            repetitions: exercise.repetitions,
            weight: exercise.weight,
            effortType: exercise.effortType,
            effortValue: exercise.effortValue,
            restSeconds: exercise.restSeconds,
            observations: exercise.observations,
            videoUrl: persistedRoutineExerciseVideoUrl(exercise),
            tempo: exercise.tempo,
            alternativeExercise: exercise.alternativeExercise,
            equipment: exercise.equipment,
            optional: exercise.optional,
            targetType: exercise.targetType,
            targetSeconds: block.type === "INTERVAL" && exercise.targetType === "TIME" ? null : exercise.targetSeconds,
            targetRepetitions: exercise.targetRepetitions,
            targetDistance: exercise.targetDistance,
            targetSide: exercise.targetSide,
            order: index + 1,
          })),
        })),
        exercises: day.blocks.flatMap((block) => block.exercises),
      })),
    };
    const nextIssues = routineValidationIssues(payload as RoutineInput);
    setValidationIssues(nextIssues);
    if (nextIssues.length) {
      const firstIssue = nextIssues[0];
      setError(firstIssue.summary);
      if (firstIssue.dayNumber) setActiveDay(firstIssue.dayNumber);
      requestAnimationFrame(() => requestAnimationFrame(() => focusRoutineValidationField(firstIssue.key)));
      return;
    }
    setSaving(true); setError("");
    try {
      const response = await fetch(editing ? `/api/rutinas/${editing.id}` : "/api/rutinas", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar la rutina."));
      const saved = (await response.json()) as TrainingRoutine;
      setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      if (baseDraftDestination === "routine") setActiveTab("rutinas");
      else if (baseDraftDestination === "class") { setActiveTab("plantillas"); setLibrarySection("classes"); }
      setOpen(false); setEditing(null); setBaseDraftDestination(null); setNotice(classTemplate ? editing ? "Clase actualizada correctamente." : "Clase guardada en Biblioteca." : updatingActiveRoutine ? "Rutina actualizada correctamente" : requestedStatus === "activa" ? "Rutina activada correctamente." : "Rutina guardada correctamente.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : classTemplate ? "No se pudo guardar la clase." : "No se pudo guardar la rutina en Neon."); }
    finally { setSaving(false); }
  }

  async function duplicate(routine: TrainingRoutine) {
    if (copyRequestInFlight.current) return;
    copyRequestInFlight.current = true;
    setDuplicatingId(routine.id); setError("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}/duplicar`, { method: "POST" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo duplicar la rutina."));
      const copy = (await response.json()) as TrainingRoutine;
      setItems((current) => [copy, ...current]);
    } catch (duplicateError) { setError(duplicateError instanceof Error ? duplicateError.message : "No se pudo duplicar la rutina en Neon."); }
    finally { setDuplicatingId(""); copyRequestInFlight.current = false; }
  }

  async function duplicateForEditing(routine: TrainingRoutine) {
    if (copyRequestInFlight.current) return;
    copyRequestInFlight.current = true;
    setDuplicatingId(routine.id); setError("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}/duplicar`, { method: "POST" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo crear la copia."));
      const copy = await response.json() as TrainingRoutine;
      setItems((current) => [copy, ...current]);
      setCreationOpen(false);
      setRoutineSection("borradores");
      begin(copy);
    } catch (duplicateError) { setError(duplicateError instanceof Error ? duplicateError.message : "No se pudo crear la copia editable."); }
    finally { setDuplicatingId(""); copyRequestInFlight.current = false; }
  }

  async function createCopy({ source, mode, name, studentIds, startDate, replaceActive }: { source: TrainingRoutine; mode: CopyMode; name: string; studentIds: string[]; startDate: string; replaceActive: boolean }) {
    if (copyRequestInFlight.current) return;
    copyRequestInFlight.current = true;
    setDuplicatingId(source.id); setError("");
    try {
      const response = await fetch(`/api/rutinas/${source.id}/duplicar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, name, studentIds, startDate, status: mode === "saveAsTemplate" ? "borrador" : "activa", replaceActive }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo crear la copia."));
      const copy = await response.json() as TrainingRoutine;
      setItems((current) => [copy, ...current]);
      setCopyFlow(null);
      if (mode === "saveAsTemplate") {
        setActiveTab("plantillas");
        setNotice("Plantilla creada sin datos personales ni historial.");
      } else {
        setActiveTab("rutinas");
        setNotice(`Rutina activada correctamente para ${studentIds.length} alumno${studentIds.length === 1 ? "" : "s"}.`);
      }
    } catch (copyError) { setError(copyError instanceof Error ? copyError.message : "No se pudo crear la copia."); }
    finally { setDuplicatingId(""); copyRequestInFlight.current = false; }
  }

  async function updateAssignments(routine: TrainingRoutine, studentIds: string[]) {
    if (assignmentSaving) return;
    setAssignmentSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}/asignaciones`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentIds }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudieron actualizar las asignaciones."));
      const saved = await response.json() as TrainingRoutine;
      setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
      setViewing((current) => current?.id === saved.id ? saved : current);
      setAssignmentTarget(null);
      setNotice(`Asignación actualizada para ${studentIds.length} alumno${studentIds.length === 1 ? "" : "s"}, sin crear otra rutina.`);
    } catch (assignmentError) { setError(assignmentError instanceof Error ? assignmentError.message : "No se pudieron actualizar las asignaciones."); }
    finally { setAssignmentSaving(false); }
  }

  async function remove(routine: TrainingRoutine) {
    setActionId(routine.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar la rutina."));
      const result = await response.json() as { message: string };
      setItems((current) => current.filter((item) => item.id !== routine.id));
      if (viewing?.id === routine.id) setViewing(null);
      setNotice(result.message);
      return true;
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la rutina de Neon."); return false; }
    finally { setActionId(""); }
  }

  async function archive(routine: TrainingRoutine) {
    if (!window.confirm(`¿Archivar “${routine.name}”? La rutina dejará de estar activa, pero conservará todo su historial.`)) return;
    setActionId(routine.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive" }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo archivar la rutina."));
      const result = await response.json() as { message: string; routine: TrainingRoutine };
      setItems((current) => current.map((item) => item.id === routine.id ? result.routine : item));
      setViewing((current) => current?.id === routine.id ? result.routine : current);
      setNotice(result.message);
    } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "No se pudo archivar la rutina."); }
    finally { setActionId(""); }
  }

  async function restore(routine: TrainingRoutine) {
    if (!window.confirm(`¿Restaurar “${routine.name}” como rutina activa?`)) return;
    setActionId(routine.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo restaurar la rutina."));
      const result = await response.json() as { message: string; routine: TrainingRoutine };
      setItems((current) => current.map((item) => item.id === routine.id ? result.routine : item));
      setViewing((current) => current?.id === routine.id ? result.routine : current);
      setNotice(result.message);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "No se pudo restaurar la rutina.");
    } finally { setActionId(""); }
  }

  async function openHistory(routine: TrainingRoutine) {
    setError(""); setHistoryRoutine(routine); setVersions([]);
    try {
      const response = await fetch(`/api/rutinas/${routine.id}/versiones`, { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar el historial."));
      setVersions(await response.json() as RoutineVersionItem[]);
    } catch (historyError) { setError(historyError instanceof Error ? historyError.message : "No se pudo cargar el historial."); }
  }

  async function restoreVersion(versionId: string) {
    if (!historyRoutine || !window.confirm("¿Restaurar esta versión? La versión actual se conservará en el historial.")) return;
    setActionId(historyRoutine.id);
    try {
      const response = await fetch(`/api/rutinas/${historyRoutine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restoreVersion", versionId }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo restaurar la versión."));
      const restored = await response.json() as TrainingRoutine;
      setItems((current) => current.map((item) => item.id === restored.id ? restored : item));
      setHistoryRoutine(restored); setNotice("Versión restaurada correctamente");
      await openHistory(restored);
    } catch (restoreError) { setError(restoreError instanceof Error ? restoreError.message : "No se pudo restaurar la versión."); }
    finally { setActionId(""); }
  }

  function beginLibraryBlock(block?: TrainingLibraryBlock) {
    setLibraryDialogMode("manage");
    setLibraryEditing(block ?? null);
    setLibraryBlockDraft(block ? librarySnapshotToEditableBlock(block.content, 1) : newBlock("STRENGTH", 1));
    setLibraryFolderId(block?.folder?.id ?? "");
    setLibraryTags(block?.tags ?? []);
    setLibraryError("");
    setLibraryDialogOpen(true);
  }

  function saveBlockFromEditor(block: BlockDraft) {
    setLibraryDialogMode("saveCopy");
    setLibraryEditing(null);
    setLibraryBlockDraft(librarySnapshotToEditableBlock(editableBlockToLibrarySnapshot(block), 1));
    setLibraryFolderId("");
    setLibraryTags([]);
    setLibraryError("");
    setLibraryDialogOpen(true);
  }

  async function saveLibraryBlock(event: FormEvent) {
    event.preventDefault();
    if (!libraryBlockDraft || librarySaving) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;
    const payload: TrainingLibraryBlockPayload = {
      name: libraryBlockDraft.name,
      folderId: libraryFolderId,
      tags: libraryTags,
      block: editableBlockToLibrarySnapshot(libraryBlockDraft),
    };
    setLibrarySaving(true); setLibraryError("");
    try {
      const response = await fetch(libraryEditing ? `/api/training-library/blocks/${libraryEditing.id}` : "/api/training-library/blocks", { method: libraryEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar el bloque en Biblioteca."));
      const saved = await response.json() as TrainingLibraryBlock;
      setLibraryBlocks((current) => libraryEditing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setLibraryDialogOpen(false); setLibraryEditing(null); setLibraryBlockDraft(null);
      if (libraryDialogMode === "saveCopy") setEditorNotice("Bloque guardado en Biblioteca.");
      else setNotice(libraryEditing ? "Bloque de Biblioteca actualizado." : "Bloque guardado en Biblioteca.");
    } catch (saveError) { setLibraryError(saveError instanceof Error ? saveError.message : "No se pudo guardar el bloque en Biblioteca."); }
    finally { setLibrarySaving(false); }
  }

  return <ModuleShell title="Rutinas" subtitle="Diseñá, asigná y monitoreá planes de entrenamiento personalizados.">
    {error && !open && <p role="alert" className="mb-3 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
    {notice && !open && <p role="status" className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[.07] px-4 py-2.5 text-xs text-emerald-200">{notice}</p>}
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-zinc-800 bg-black/20 px-1">{([["rutinas", "Rutinas"], ["plantillas", "Biblioteca"], ["seguimiento", "Seguimiento"]] as const).map(([value, title]) => <button key={value} onClick={() => setActiveTab(value)} className={`relative min-h-12 shrink-0 px-4 text-sm font-bold transition ${activeTab === value ? "bg-white/[.025] text-yellow-300 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-yellow-400" : "text-zinc-400 hover:bg-white/[.02] hover:text-zinc-200"}`}>{title}</button>)}</nav>
    {activeTab === "seguimiento" ? <RoutineFollowUpDashboard initialStudentId={trackingStudentId} initialSessionId={trackingSessionId} initialStudentIds={trackingStudentIds} initialSessionIds={trackingSessionIds} /> : activeTab === "plantillas" ? <>
      <nav aria-label="Contenido de la Biblioteca" className="mb-4 grid grid-cols-2 border-b border-zinc-800 bg-black/10">
        {([["classes", "Clases completas"], ["blocks", "Bloques"]] as const).map(([value, title]) => <button key={value} type="button" aria-current={librarySection === value ? "page" : undefined} onClick={() => setLibrarySection(value)} className={`relative min-h-11 min-w-0 px-2 text-xs font-bold transition sm:text-sm ${librarySection === value ? "bg-white/[.025] text-yellow-300 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-yellow-400" : "text-zinc-400 hover:bg-white/[.02] hover:text-zinc-200"}`}>{title}</button>)}
      </nav>
      {librarySection === "classes" ? <>
        <div className="mb-3 flex justify-end"><button type="button" onClick={() => begin(undefined, "template")} className="min-h-10 rounded-xl border border-yellow-400/30 bg-black/20 px-3.5 text-sm font-bold text-yellow-300 transition hover:bg-yellow-400/[.06]">+ Crear clase completa</button></div>
        <section className="mb-4 rounded-2xl border border-zinc-800 bg-[#121212] p-3"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_minmax(180px,.8fr)]"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar clase completa…" className={inputClass} /><select aria-label="Objetivo" value={objectiveFilter} onChange={(event) => setObjectiveFilter(event.target.value)} className={inputClass}><option value="todos">Todos los objetivos</option>{objectiveOptions.map((objective) => <option key={objective}>{objective}</option>)}</select></div></section>
        <RoutineManagementPanel routines={visible} mode="plantillas" ready={ready} busyId={actionId} duplicatingId={duplicatingId} actions={{ openPlan: setViewing, openTracking: () => setActiveTab("seguimiento"), edit: begin, duplicate, saveAsTemplate: (routine) => setCopyFlow({ source: routine, mode: "saveAsTemplate" }), useAsBase: setBaseSource, useTemplate: (routine) => setCopyFlow({ source: routine, mode: "useTemplate" }), manageAssignments: setAssignmentTarget, archive, restore, history: openHistory, remove }} />
      </> : <>
        <TrainingLibraryBlocksPanel blocks={libraryBlocks} folders={libraryFolders} ready={libraryReady} loadError={libraryLoadError} retry={() => { setLibraryLoadError(""); if (!libraryBlocks.length) setLibraryReady(false); setLibraryReload((value) => value + 1); }} onNew={() => beginLibraryBlock()} onEdit={beginLibraryBlock} onBlockChanged={(block) => setLibraryBlocks((current) => current.map((item) => item.id === block.id ? block : item))} onBlockDeleted={(blockId) => setLibraryBlocks((current) => current.filter((item) => item.id !== blockId))} onFoldersChanged={setLibraryFolders} />
      </>}
    </> : <>
      <div className="mb-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setDuplicatesOpen(true)} className="min-h-11 rounded-xl border border-zinc-700 px-3.5 text-xs font-bold text-zinc-300 transition hover:border-yellow-400/30 hover:text-yellow-300">Revisar duplicados</button><button type="button" onClick={() => setCreationOpen(true)} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-black text-zinc-950 transition hover:bg-yellow-300">+ Nueva rutina</button></div>
      <nav aria-label="Estado de las rutinas" className="mb-3 grid grid-cols-3 border-b border-zinc-800 bg-black/10">{([["activas", "Activas"], ["borradores", "Borradores"], ["archivadas", "Archivadas"]] as const).map(([value, title]) => <button key={value} type="button" aria-current={routineSection === value ? "page" : undefined} onClick={() => setRoutineSection(value)} className={`relative min-h-11 min-w-0 px-1 text-xs font-bold transition sm:px-3 sm:text-sm ${routineSection === value ? "bg-white/[.025] text-yellow-300 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:bg-yellow-400 sm:after:inset-x-3" : "text-zinc-400 hover:bg-white/[.02] hover:text-zinc-200"}`}><span className="truncate">{title}</span> <span className="text-[10px] tabular-nums text-zinc-500 sm:text-xs">{statusCounts[value]}</span></button>)}</nav>
      <section className="mb-4 rounded-2xl border border-zinc-800 bg-[#121212] p-3"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_minmax(170px,.8fr)_minmax(190px,.9fr)]"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar rutina o alumno…" className={inputClass} /><select aria-label="Objetivo" value={objectiveFilter} onChange={(event) => setObjectiveFilter(event.target.value)} className={inputClass}><option value="todos">Todos los objetivos</option>{objectiveOptions.map((objective) => <option key={objective}>{objective}</option>)}</select><select aria-label="Alumno" value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)} className={inputClass}><option value="todos">Todos los alumnos</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></div></section>
      <RoutineManagementPanel routines={visible} mode="rutinas" routineSection={routineSection} ready={ready} busyId={actionId} duplicatingId={duplicatingId} actions={{ openPlan: setViewing, openTracking: () => setActiveTab("seguimiento"), edit: begin, duplicate, saveAsTemplate: (routine) => setCopyFlow({ source: routine, mode: "saveAsTemplate" }), useAsBase: setBaseSource, useTemplate: (routine) => setCopyFlow({ source: routine, mode: "useTemplate" }), manageAssignments: setAssignmentTarget, archive, restore, history: openHistory, remove }} />
    </>}
    {open && <RoutineValidationContext.Provider value={{ issues: validationIssues, activeDay }}>{form.kind === "template" && form.days.length === 1
      ? <ClassTemplateEditor form={form} setForm={updateEditorForm} error={error} validationIssues={validationIssues} notice={editorNotice} close={() => { setOpen(false); setBaseDraftDestination(null); }} submit={submit} editing={Boolean(editing)} saving={saving} libraryBlocks={libraryBlocks} libraryFolders={libraryFolders} libraryReady={libraryReady} libraryLoadError={libraryLoadError} saveBlockToLibrary={saveBlockFromEditor} onLibraryBlockChanged={(block) => setLibraryBlocks((current) => current.map((item) => item.id === block.id ? block : item))} />
      : <RoutineEditor form={form} setForm={updateEditorForm} students={students} activeDay={activeDay} setActiveDay={setActiveDay} error={error} validationIssues={validationIssues} notice={editorNotice} close={() => { setOpen(false); setBaseDraftDestination(null); }} submit={submit} editingStatus={editing?.status ?? null} saving={saving} libraryBlocks={libraryBlocks} libraryFolders={libraryFolders} libraryReady={libraryReady} libraryLoadError={libraryLoadError} saveBlockToLibrary={saveBlockFromEditor} onLibraryBlockChanged={(block) => setLibraryBlocks((current) => current.map((item) => item.id === block.id ? block : item))} />}</RoutineValidationContext.Provider>}
    {libraryDialogOpen && libraryBlockDraft && <LibraryBlockDialog block={libraryBlockDraft} setBlock={setLibraryBlockDraft} folders={libraryFolders} folderId={libraryFolderId} setFolderId={setLibraryFolderId} tags={libraryTags} setTags={setLibraryTags} error={libraryError} saving={librarySaving} editing={Boolean(libraryEditing)} compact={libraryDialogMode === "saveCopy"} close={() => { if (!librarySaving) { setLibraryDialogOpen(false); setLibraryEditing(null); setLibraryBlockDraft(null); } }} submit={saveLibraryBlock} />}
    {viewing && <RoutineTableView
      routine={viewing}
      close={() => setViewing(null)}
      actions={<>
        {viewing.status !== "archivada" && <button type="button" onClick={() => { const routine = viewing; setViewing(null); begin(routine); }} className="min-h-10 rounded-xl bg-yellow-400 px-3 text-sm font-black text-zinc-950">Editar rutina</button>}
        <button type="button" disabled={duplicatingId === viewing.id} onClick={() => duplicate(viewing)} className="min-h-10 rounded-xl border border-yellow-400/25 px-3 text-sm font-bold text-yellow-300 disabled:opacity-50">Duplicar</button>
        {viewing.kind === "assigned" && viewing.status !== "archivada" && <button type="button" onClick={() => setAssignmentTarget(viewing)} className="min-h-10 rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-300">Asignar alumnos</button>}
        {viewing.status !== "archivada" && <button type="button" disabled={actionId === viewing.id} onClick={() => archive(viewing)} className="min-h-10 rounded-xl border border-orange-400/25 px-3 text-sm font-bold text-orange-300 disabled:opacity-50">Archivar</button>}
      </>}
    />}
    {copyFlow && <RoutineCopyDialog flow={copyFlow} students={students} routines={items} busy={duplicatingId === copyFlow.source.id} close={() => setCopyFlow(null)} submit={createCopy} />}
    {assignmentTarget && <RoutineAssignmentDialog routine={assignmentTarget} students={students} busy={assignmentSaving} close={() => setAssignmentTarget(null)} submit={(studentIds) => updateAssignments(assignmentTarget, studentIds)} />}
    {duplicatesOpen && <RoutineDuplicatesReview close={() => setDuplicatesOpen(false)} onDeleted={(ids) => { setItems((current) => current.filter((routine) => !ids.includes(routine.id))); setNotice(`${ids.length} rutina${ids.length === 1 ? "" : "s"} duplicada${ids.length === 1 ? "" : "s"} vacía${ids.length === 1 ? "" : "s"} eliminada${ids.length === 1 ? "" : "s"}.`); }} onArchived={(routine) => setItems((current) => current.map((item) => item.id === routine.id ? routine : item))} />}
    {baseSource && <ClassBaseChoiceDialog source={baseSource} close={() => setBaseSource(null)} choose={beginFromClassBase} />}
    {historyRoutine && <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><section className="mx-auto my-10 max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">Historial de {historyRoutine.name}</h2><p className="text-sm text-zinc-400">Las versiones más recientes aparecen primero.</p></div><button onClick={() => setHistoryRoutine(null)} className="text-zinc-400">Cerrar</button></div><div className="mt-5 space-y-3">{versions.length === 0 ? <p className="rounded-xl bg-zinc-950 p-5 text-sm text-zinc-500">Todavía no hay versiones guardadas.</p> : versions.map((version) => <article key={version.id} className="flex flex-col gap-3 rounded-xl bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Versión {version.version}</p><p className="text-sm text-zinc-400">{version.summary} · {new Date(version.createdAt).toLocaleString("es-AR")}</p></div><button disabled={actionId === historyRoutine.id} onClick={() => restoreVersion(version.id)} className="rounded-lg border border-yellow-400/40 px-3 py-2 text-sm text-yellow-300 disabled:opacity-50">Restaurar versión</button></article>)}</div></section></div>}
    {creationOpen && <RoutineCreationDialog routines={items} busyId={duplicatingId} close={() => setCreationOpen(false)} createFromScratch={startRoutineFromScratch} createFromClass={startRoutineFromClass} copyRoutine={duplicateForEditing} />}
    <TrainerFloatingActions mode="direct" enabled={!open && !libraryDialogOpen && !viewing && !copyFlow && !assignmentTarget && !baseSource && !historyRoutine && !duplicatesOpen && !creationOpen} actions={[{ label: "Nueva rutina", symbol: "+", onSelect: () => { setActiveTab("rutinas"); setCreationOpen(true); } }]} />
  </ModuleShell>;
}

function LibraryBlockDialog({ block, setBlock, folders, folderId, setFolderId, tags, setTags, error, saving, editing, compact, close, submit }: {
  block: BlockDraft;
  setBlock: (block: BlockDraft) => void;
  folders: TrainingLibraryFolder[];
  folderId: string;
  setFolderId: (value: string) => void;
  tags: string[];
  setTags: (value: string[]) => void;
  error: string;
  saving: boolean;
  editing: boolean;
  compact: boolean;
  close: () => void;
  submit: (event: FormEvent) => void;
}) {
  const handleKeyboardNavigation = useRoutineKeyboardNavigation();
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) close(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [close, saving]);

  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/85 p-0 sm:p-4">
    <form onSubmit={submit} onKeyDownCapture={handleKeyboardNavigation} role="dialog" aria-modal="true" aria-labelledby="library-block-dialog-title" className={`mx-auto min-h-dvh w-full border border-zinc-800 bg-zinc-900 p-3 text-white sm:my-4 sm:min-h-0 sm:rounded-2xl sm:p-5 ${compact ? "max-w-xl" : "max-w-6xl"}`}>
      <header className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-300">Biblioteca · Bloques</p><h2 id="library-block-dialog-title" className="mt-1 text-xl font-black">{compact ? "Guardar en Biblioteca" : editing ? "Editar bloque reusable" : "Nuevo bloque reusable"}</h2><p className="mt-1 text-sm text-zinc-400">{compact ? "Guardá una copia independiente del bloque actual." : "Se guarda como una copia independiente, lista para reutilizar más adelante."}</p></div><button type="button" onClick={close} aria-label="Cerrar editor de bloque" className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-800 text-lg text-zinc-300">×</button></header>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      <section className={`mt-5 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {compact ? <label className="sm:col-span-2">Nombre<input required maxLength={120} value={block.name} onChange={(event) => setBlock({ ...block, name: event.target.value })} className={`${inputClass} mt-1`} /><span className="mt-1 block text-xs text-zinc-500">Tipo: {blockLabels[block.type]}</span></label> : <label>Tipo<select disabled={editing} value={block.type} onChange={(event) => setBlock(newBlock(event.target.value as TrainingBlockType, 1))} className={`${inputClass} mt-1 disabled:opacity-60`}>{(Object.keys(blockLabels) as TrainingBlockType[]).map((value) => <option key={value} value={value}>{blockLabels[value]}</option>)}</select></label>}
        <label>Carpeta<select value={folderId} onChange={(event) => setFolderId(event.target.value)} className={`${inputClass} mt-1`}><option value="">Sin carpeta</option>{folders.filter((folder) => folder.status === "active").map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
        <TrainingTagInput value={tags} onChange={setTags} disabled={saving} />
      </section>
      {!compact && <div className="mt-4"><BlockEditor standalone block={block} interpretation={null} update={(updater) => setBlock(updater(block))} move={() => undefined} duplicate={() => undefined} remove={() => undefined} /></div>}
      <footer className="sticky bottom-0 mt-4 flex justify-end gap-2 border-t border-zinc-800 bg-zinc-900 py-3 pb-[calc(env(safe-area-inset-bottom)+.75rem)]"><button type="button" disabled={saving} onClick={close} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-300 disabled:opacity-50">Cancelar</button><button type="submit" name="intent" value="save-library-block" disabled={saving} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-black text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : compact ? "Guardar en Biblioteca" : "Guardar bloque"}</button></footer>
    </form>
  </div>;
}

function ClassBaseChoiceDialog({ source, close, choose }: {
  source: TrainingRoutine;
  close: () => void;
  choose: (destination: "class" | "routine") => void;
}) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [close]);

  return <div className="fixed inset-0 z-[85] flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-4" onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="class-base-choice-title" className="w-full rounded-t-3xl border border-white/10 bg-[#121212] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-300">Biblioteca · Clase completa</p><h2 id="class-base-choice-title" className="mt-2 text-xl font-black">Usar como base</h2><p className="mt-1 truncate text-sm text-zinc-400">{source.name}</p></div><button type="button" onClick={close} aria-label="Cerrar opciones" className="grid size-10 shrink-0 place-items-center rounded-xl border border-zinc-700 text-lg text-zinc-300">×</button></div>
      <p className="mt-5 text-sm leading-relaxed text-zinc-300">Elegí qué querés crear. La copia se abrirá como borrador editable y no se guardará hasta que confirmes desde el editor.</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => choose("class")} className="min-h-12 rounded-xl border border-yellow-400/35 bg-yellow-400/[.05] px-4 text-sm font-black text-yellow-200 transition hover:bg-yellow-400/[.1]">Nueva clase</button><button type="button" onClick={() => choose("routine")} className="min-h-12 rounded-xl border border-zinc-700 px-4 text-sm font-black text-zinc-100 transition hover:bg-white/[.04]">Nueva rutina</button></div>
      <button type="button" onClick={close} className="mt-2 min-h-11 w-full rounded-xl px-4 text-sm font-bold text-zinc-400 transition hover:bg-white/[.03] hover:text-zinc-200">Cancelar</button>
    </section>
  </div>;
}

function RoutineCopyDialog({ flow, students, routines, busy, close, submit }: {
  flow: CopyFlow;
  students: Student[];
  routines: TrainingRoutine[];
  busy: boolean;
  close: () => void;
  submit: (input: { source: TrainingRoutine; mode: CopyMode; name: string; studentIds: string[]; startDate: string; replaceActive: boolean }) => Promise<void>;
}) {
  const needsStudent = flow.mode === "useTemplate";
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [name, setName] = useState(`Copia de ${flow.source.name.replace(/^Copia de\s+/i, "").replace(/(?:\s*\(copia\))+$/i, "").trim()}`);
  const [startDate, setStartDate] = useState(flow.source.startDate);
  const [replaceActive, setReplaceActive] = useState(false);
  const activeRoutines = routines.filter((routine) => routine.kind === "assigned" && routine.status === "activa" && routine.studentIds.some((studentId) => studentIds.includes(studentId)));
  function toggleStudent(studentId: string) { setStudentIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]); setReplaceActive(false); }

  useEffect(() => {
    function keydown(event: KeyboardEvent) { if (event.key === "Escape" && !busy) close(); }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [busy, close]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !name.trim() || (needsStudent && !studentIds.length)) return;
    await submit({ source: flow.source, mode: flow.mode, name: name.trim(), studentIds, startDate, replaceActive: Boolean(activeRoutines.length) && replaceActive });
  }

  return <div role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }} className="fixed inset-0 z-[70] flex items-end bg-black/80 p-0 sm:items-center sm:justify-center sm:p-4">
    <form onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="copy-routine-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 text-white shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h2 id="copy-routine-title" className="text-xl font-bold">{flow.mode === "saveAsTemplate" ? "Guardar como plantilla" : "Usar plantilla"}</h2><p className="mt-1 text-sm text-zinc-400">Se creará una sola rutina independiente, sin sesiones ni resultados previos.</p></div><button type="button" onClick={close} disabled={busy} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50">Cerrar</button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2">Nombre<input autoFocus={!needsStudent} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1`} /></label>{flow.mode !== "saveAsTemplate" && <label>Fecha de inicio<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={`${inputClass} mt-1`} /></label>}</div>
      {needsStudent && <StudentAssignmentPicker students={students} selectedIds={studentIds} toggle={toggleStudent} clear={() => { setStudentIds([]); setReplaceActive(false); }} />}
      {needsStudent && activeRoutines.length > 0 && <label className="mt-5 flex gap-3 rounded-xl border border-orange-400/30 bg-orange-400/10 p-4 text-sm text-orange-100"><input type="checkbox" checked={replaceActive} onChange={(event) => setReplaceActive(event.target.checked)} /><span>{activeRoutines.length} alumno{activeRoutines.length === 1 ? "" : "s"} ya tiene{activeRoutines.length === 1 ? "" : "n"} otra rutina activa. Finalizar esas asignaciones y activar esta rutina.</span></label>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={close} disabled={busy} className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold disabled:opacity-50">Cancelar</button><button type="submit" disabled={busy || !name.trim() || (needsStudent && (!studentIds.length || Boolean(activeRoutines.length) && !replaceActive))} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50">{busy ? "Creando…" : flow.mode === "saveAsTemplate" ? "Crear plantilla" : "Activar rutina"}</button></div>
    </form>
  </div>;
}

function RoutineAssignmentDialog({ routine, students, busy, close, submit }: { routine: TrainingRoutine; students: Student[]; busy: boolean; close: () => void; submit: (studentIds: string[]) => Promise<void> }) {
  const [studentIds, setStudentIds] = useState<string[]>(routine.studentIds);
  function toggleStudent(studentId: string) { setStudentIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]); }
  useEffect(() => { const listener = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) close(); }; document.addEventListener("keydown", listener); return () => document.removeEventListener("keydown", listener); }, [busy, close]);
  return <div className="fixed inset-0 z-[75] flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-4" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}><section role="dialog" aria-modal="true" aria-labelledby="routine-assignment-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 text-white shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id="routine-assignment-title" className="text-xl font-black">Asignar alumnos</h2><p className="mt-1 text-sm text-zinc-400">{routine.name} · se conserva el mismo plan y el progreso individual.</p></div><button type="button" onClick={close} disabled={busy} className="min-h-10 rounded-lg px-3 text-sm text-zinc-400 disabled:opacity-50">Cerrar</button></div><StudentAssignmentPicker students={students} selectedIds={studentIds} toggle={toggleStudent} clear={() => setStudentIds([])} /><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={close} disabled={busy} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold disabled:opacity-50">Cancelar</button><button type="button" onClick={() => void submit(studentIds)} disabled={busy} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-black text-zinc-950 disabled:opacity-50">{busy ? "Guardando…" : `Guardar asignaciones (${studentIds.length})`}</button></div></section></div>;
}

function BlockAdder({ blocks, folders, ready, error, addNew, addFromLibrary, onBlockChanged }: {
  blocks: TrainingLibraryBlock[];
  folders: TrainingLibraryFolder[];
  ready: boolean;
  error: string;
  addNew: (type: TrainingBlockType) => void;
  addFromLibrary: (block: TrainingLibraryBlock) => void;
  onBlockChanged: (block: TrainingLibraryBlock) => void;
}) {
  const [showTypes, setShowTypes] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const insertionInFlight = useRef(false);
  function insert(block: TrainingLibraryBlock) {
    if (insertionInFlight.current || block.status !== "active") return;
    insertionInFlight.current = true;
    setBusyId(block.id);
    addFromLibrary(block);
    setPickerOpen(false);
    void fetch(`/api/training-library/blocks/${block.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "markUsed" }) }).then(async (response) => { if (response.ok) onBlockChanged(await response.json() as TrainingLibraryBlock); }).catch(() => undefined).finally(() => { insertionInFlight.current = false; setBusyId(""); });
  }
  return <>
    <details aria-label="Agregar bloque" className="mt-3 rounded-xl border border-yellow-400/25 bg-yellow-400/[.04]"><summary className="cursor-pointer list-none px-4 py-3 font-bold text-yellow-300">+ Agregar bloque</summary><div className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-3"><button type="button" onClick={() => setShowTypes((value) => !value)} className="min-h-11 rounded-lg bg-zinc-800 px-3 text-sm font-bold text-zinc-100">Crear nuevo</button><button type="button" onClick={() => setPickerOpen(true)} className="min-h-11 rounded-lg border border-yellow-400/25 px-3 text-sm font-bold text-yellow-200">Desde Biblioteca</button>{showTypes && <div className="col-span-2 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 sm:grid-cols-4">{(Object.keys(blockLabels) as TrainingBlockType[]).map((type) => <button type="button" key={type} onClick={() => { addNew(type); setShowTypes(false); }} className="min-h-11 rounded-lg bg-zinc-800 px-2 text-sm">{blockLabels[type]}</button>)}</div>}</div></details>
    {pickerOpen && <TrainingLibraryBlockPicker blocks={blocks} folders={folders} ready={ready} error={error} busyId={busyId} close={() => { if (!busyId) setPickerOpen(false); }} add={insert} onBlockChanged={onBlockChanged} />}
  </>;
}

function ClassTemplateEditor({ form, setForm, error, notice, close, submit, editing, saving, libraryBlocks, libraryFolders, libraryReady, libraryLoadError, saveBlockToLibrary, onLibraryBlockChanged }: {
  form: RoutineDraft;
  setForm: (form: RoutineDraft) => void;
  error: string;
  validationIssues: RoutineValidationIssue[];
  notice: string;
  close: () => void;
  submit: (event: FormEvent) => void;
  editing: boolean;
  saving: boolean;
} & EditorLibraryProps) {
  const currentDay = form.days[0];
  const handleKeyboardNavigation = useRoutineKeyboardNavigation();
  const updateDay = (updater: (day: DayDraft) => DayDraft) => setForm({ ...form, days: [updater(currentDay)] });
  const reorderBlocks = (blocks: BlockDraft[]) => blocks.map((block, index) => ({ ...block, order: index + 1 }));
  const classType = classTypeFromTags(form.tags);
  function addBlock(type: TrainingBlockType) { updateDay((day) => ({ ...day, blocks: [...day.blocks, newBlock(type, day.blocks.length + 1)] })); }
  function addLibraryBlock(block: TrainingLibraryBlock) { updateDay((day) => ({ ...day, blocks: [...day.blocks, librarySnapshotToEditableBlock(block.content, day.blocks.length + 1)] })); }
  function updateBlock(clientId: string, updater: (block: BlockDraft) => BlockDraft) { updateDay((day) => ({ ...day, blocks: day.blocks.map((block) => block.clientId === clientId ? updater(block) : block) })); }
  function moveBlock(clientId: string, direction: -1 | 1) { updateDay((day) => { const blocks = [...day.blocks].sort((a, b) => a.order - b.order); const index = blocks.findIndex((block) => block.clientId === clientId); const target = index + direction; if (index < 0 || target < 0 || target >= blocks.length) return day; [blocks[index], blocks[target]] = [blocks[target], blocks[index]]; return { ...day, blocks: reorderBlocks(blocks) }; }); }
  function duplicateBlock(clientId: string) { updateDay((day) => { const index = day.blocks.findIndex((block) => block.clientId === clientId); if (index < 0) return day; const source = day.blocks[index]; const copy = { ...source, id: undefined, clientId: crypto.randomUUID(), name: `${source.name} (copia)`, exercises: source.exercises.map((exercise) => ({ ...exercise, id: undefined, clientId: crypto.randomUUID() })) }; return { ...day, blocks: reorderBlocks([...day.blocks.slice(0, index + 1), copy, ...day.blocks.slice(index + 1)]) }; }); }
  function removeBlock(clientId: string) { if (!window.confirm("¿Eliminar este bloque de la clase?")) return; updateDay((day) => ({ ...day, blocks: reorderBlocks(day.blocks.filter((block) => block.clientId !== clientId)) })); }

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || saving || document.querySelector('[aria-label="Biblioteca de ejercicios BM"], [aria-labelledby="block-library-picker-title"], [aria-labelledby="library-block-dialog-title"]')) return;
      close();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [close, saving]);

  return <div role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget && !saving) close(); }} className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-0 sm:p-3">
    <form noValidate onSubmit={submit} onKeyDownCapture={handleKeyboardNavigation} role="dialog" aria-modal="true" aria-labelledby="class-template-title" className="mx-auto min-h-dvh w-full max-w-6xl border border-zinc-800 bg-zinc-900 p-3 text-white sm:my-4 sm:min-h-0 sm:rounded-2xl sm:p-5">
      <header className="sticky top-0 z-20 -mx-3 -mt-3 flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-900/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:-mt-5 sm:rounded-t-2xl sm:px-5 sm:py-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">Biblioteca · Clase completa</p><h2 id="class-template-title" className="mt-1 text-xl font-black">{editing ? "Editar clase" : "Nueva clase completa"}</h2><p className="mt-1 text-sm text-zinc-400">Diseñá una sesión lista para reutilizar.</p></div><button type="button" onClick={close} disabled={saving} aria-label="Cerrar editor de clase" className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-800 text-lg text-zinc-300 disabled:opacity-50">×</button></header>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}

      <section aria-label="Datos generales de la clase" className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">Nombre de la clase<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label>Tipo de clase<select value={classType} onChange={(event) => setForm({ ...form, tags: classTagsWithType(form.tags, event.target.value) })} className={`${inputClass} mt-1`}>{classTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Duración estimada (min)<NumericDraftInput min="1" max="1440" value={currentDay.estimatedMinutes} setValue={(value) => updateDay((day) => ({ ...day, estimatedMinutes: value }))} className={`${inputClass} mt-1`} /></label>
          <label>Nivel<select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as TrainingRoutineLevel })} className={`${inputClass} mt-1`}>{levels.map((level) => <option key={level} value={level}>{label(level)}</option>)}</select></label>
          <label>Objetivo de la clase<input required list="class-objectives" maxLength={100} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} className={`${inputClass} mt-1`} /><datalist id="class-objectives">{objectives.map((objective) => <option key={objective} value={objective} />)}</datalist></label>
          <label>Equipamiento<input value={form.equipment.join(", ")} onChange={(event) => setForm({ ...form, equipment: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Mancuernas, bandas, cajón" className={`${inputClass} mt-1`} /></label>
          <TrainingTagInput label="Tags / Etiquetas" value={visibleClassTags(form.tags)} onChange={(tags) => setForm({ ...form, tags: classTagsWithType(tags, classType) })} placeholder="Full body, metabólico" disabled={saving} />
          <label className="sm:col-span-2">Descripción o notas generales<textarea maxLength={1000} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${inputClass} mt-1`} /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 border-t border-zinc-800 pt-3 text-xs text-zinc-400"><strong className="max-w-full truncate text-zinc-100">{form.name.trim() || "Clase sin nombre"}</strong><span>·</span><span>{currentDay.estimatedMinutes ? `${currentDay.estimatedMinutes} min` : "Duración sin definir"}</span><span>·</span><span>{classType}</span><span>·</span><span>{label(form.level)}</span></div>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3 sm:p-4"><h3 className="text-sm font-black text-yellow-300">Entrada en calor</h3><p className="mt-1 text-xs text-zinc-500">Preparación opcional antes de los bloques.</p><textarea maxLength={2000} rows={4} value={currentDay.warmup} onChange={(event) => updateDay((day) => ({ ...day, warmup: event.target.value }))} placeholder="Movilidad + activación" aria-label="Entrada en calor" className={`${inputClass} mt-3`} /></section>

      <section aria-label="Bloques de la clase" className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3 sm:p-4">
        <div><h3 className="text-sm font-black text-zinc-100">Bloques de la clase</h3><p className="mt-1 text-xs text-zinc-500">Ordená la secuencia completa de la sesión.</p></div>
        <BlockAdder blocks={libraryBlocks} folders={libraryFolders} ready={libraryReady} error={libraryLoadError} addNew={addBlock} addFromLibrary={addLibraryBlock} onBlockChanged={onLibraryBlockChanged} />
        <div className="mt-4 space-y-4">{currentDay.blocks.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">Agregá el primer bloque de la clase.</p> : [...currentDay.blocks].sort((left, right) => left.order - right.order).map((block) => <BlockEditor key={block.clientId} block={block} interpretation={null} update={(updater) => updateBlock(block.clientId, updater)} move={(direction) => moveBlock(block.clientId, direction)} duplicate={() => duplicateBlock(block.clientId)} remove={() => removeBlock(block.clientId)} saveToLibrary={() => saveBlockToLibrary(block)} />)}</div>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3 sm:p-4"><label className="font-bold text-zinc-200">Cierre / observaciones<textarea maxLength={1000} rows={3} value={currentDay.observations} onChange={(event) => updateDay((day) => ({ ...day, observations: event.target.value }))} placeholder="Vuelta a la calma final" className={`${inputClass} mt-2 font-normal`} /></label></section>

      <footer className="sticky bottom-0 z-20 -mx-3 mt-4 flex justify-end gap-2 border-t border-zinc-800 bg-zinc-900/95 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+.75rem)] backdrop-blur sm:-mx-5 sm:rounded-b-2xl sm:px-5"><button type="button" onClick={close} disabled={saving} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-300 disabled:opacity-50">Cancelar</button><button type="submit" name="intent" value="class" disabled={saving} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-black text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Guardar clase"}</button></footer>
    </form>
  </div>;
}

function RoutineEditor({ form, setForm, students, activeDay, setActiveDay, error, notice, close, submit, editingStatus, saving, libraryBlocks, libraryFolders, libraryReady, libraryLoadError, saveBlockToLibrary, onLibraryBlockChanged }: { form: RoutineDraft; setForm: (form: RoutineDraft) => void; students: Student[]; activeDay: number; setActiveDay: (day: number) => void; error: string; validationIssues: RoutineValidationIssue[]; notice: string; close: () => void; submit: (event: FormEvent) => void; editingStatus: TrainingRoutineStatus | null; saving: boolean } & EditorLibraryProps) {
  const updatingActiveRoutine = editingStatus === "activa";
  const legacyMultiDayTemplate = form.kind === "template" && form.days.length > 1;
  const selectedStudent = form.studentIds.length === 1 ? students.find((student) => student.id === form.studentIds[0]) : undefined;
  const { context: evaluationContext, loading: evaluationLoading } = useRoutineEvaluation(selectedStudent);
  const interpretation = evaluationContext?.interpretation ?? null;
  const [reviewedReminders, setReviewedReminders] = useState<string[]>([]);
  const currentDay = form.days.find((day) => day.dayNumber === activeDay) ?? form.days[0];
  const handleKeyboardNavigation = useRoutineKeyboardNavigation();
  const updateDay = (updater: (day: DayDraft) => DayDraft) => setForm({ ...form, days: form.days.map((day) => day.dayNumber === activeDay ? updater(day) : day) });
  const reorderBlocks = (blocks: BlockDraft[]) => blocks.map((block, index) => ({ ...block, order: index + 1 }));
  function addBlock(type: TrainingBlockType) { updateDay((day) => ({ ...day, blocks: [...day.blocks, newBlock(type, day.blocks.length + 1)] })); }
  function addLibraryBlock(block: TrainingLibraryBlock) { updateDay((day) => ({ ...day, blocks: [...day.blocks, librarySnapshotToEditableBlock(block.content, day.blocks.length + 1)] })); }
  function updateBlock(clientId: string, updater: (block: BlockDraft) => BlockDraft) { updateDay((day) => ({ ...day, blocks: day.blocks.map((block) => block.clientId === clientId ? updater(block) : block) })); }
  function moveBlock(clientId: string, direction: -1 | 1) { updateDay((day) => { const blocks = [...day.blocks].sort((a, b) => a.order - b.order); const index = blocks.findIndex((block) => block.clientId === clientId); const target = index + direction; if (index < 0 || target < 0 || target >= blocks.length) return day; [blocks[index], blocks[target]] = [blocks[target], blocks[index]]; return { ...day, blocks: reorderBlocks(blocks) }; }); }
  function duplicateBlock(clientId: string) { updateDay((day) => { const index = day.blocks.findIndex((block) => block.clientId === clientId); if (index < 0) return day; const source = day.blocks[index]; const copy = { ...source, id: undefined, clientId: crypto.randomUUID(), name: `${source.name} (copia)`, exercises: source.exercises.map((exercise) => ({ ...exercise, id: undefined, clientId: crypto.randomUUID() })) }; return { ...day, blocks: reorderBlocks([...day.blocks.slice(0, index + 1), copy, ...day.blocks.slice(index + 1)]) }; }); }
  function removeBlock(clientId: string) { if (!window.confirm("¿Eliminar este bloque? El servidor preservará cualquier historial asociado.")) return; updateDay((day) => ({ ...day, blocks: reorderBlocks(day.blocks.filter((block) => block.clientId !== clientId)) })); }
  function addDay() { if (form.days.length >= 14) return; const next = form.days.length + 1; setForm({ ...form, days: [...form.days, { clientId: crypto.randomUUID(), dayNumber: next, name: `Día ${next}`, objective: "", warmup: "", observations: "", estimatedMinutes: null, blocks: [newBlock("STRENGTH", 1)], exercises: [] }] }); setActiveDay(next); }
  function moveDay(direction: -1 | 1) { const index = form.days.findIndex((day) => day.dayNumber === activeDay); const target = index + direction; if (index < 0 || target < 0 || target >= form.days.length) return; const days = [...form.days]; [days[index], days[target]] = [days[target], days[index]]; setForm({ ...form, days: days.map((day, i) => ({ ...day, dayNumber: i + 1 })) }); setActiveDay(target + 1); }
  function duplicateDay() { if (form.days.length >= 14) return; const index = form.days.findIndex((day) => day.dayNumber === activeDay); const source = form.days[index]; if (!source) return; const copy: DayDraft = { ...source, id: undefined, clientId: crypto.randomUUID(), dayNumber: source.dayNumber + 1, name: `${source.name} (copia)`, blocks: source.blocks.map((block) => ({ ...block, id: undefined, clientId: crypto.randomUUID(), exercises: block.exercises.map((exercise) => ({ ...exercise, id: undefined, clientId: crypto.randomUUID() })) })), exercises: [] }; const days = [...form.days.slice(0, index + 1), copy, ...form.days.slice(index + 1)].map((day, i) => ({ ...day, dayNumber: i + 1 })); setForm({ ...form, days }); setActiveDay(index + 2); }
  function removeDay() { if (form.days.length === 1 || !window.confirm(`¿Eliminar “${currentDay.name}”? Las sesiones históricas no cambiarán.`)) return; const index = form.days.findIndex((day) => day.dayNumber === activeDay); const days = form.days.filter((day) => day.dayNumber !== activeDay).map((day, i) => ({ ...day, dayNumber: i + 1 })); setForm({ ...form, days }); setActiveDay(Math.min(index + 1, days.length)); }
  function toggleStudent(studentId: string) { setForm({ ...form, studentIds: form.studentIds.includes(studentId) ? form.studentIds.filter((id) => id !== studentId) : [...form.studentIds, studentId] }); }
  const exerciseCount = (day: DayDraft) => day.blocks.reduce((sum, block) => sum + block.exercises.length, 0);
  const routineExercises = form.days.flatMap((day) => day.blocks.flatMap((block) => block.exercises.map((exercise) => ({ name: exercise.name, muscleGroup: exercise.muscleGroup }))));
  const reminders = uncoveredPriorityReminders(interpretation?.priorities ?? [], routineExercises).filter((item) => !reviewedReminders.includes(item.id));
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-0 sm:p-3"><form noValidate onSubmit={submit} onKeyDownCapture={handleKeyboardNavigation} className="mx-auto min-h-dvh w-full max-w-7xl border border-zinc-800 bg-zinc-900 p-3 text-white sm:my-4 sm:min-h-0 sm:rounded-2xl sm:p-5">
    <header className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{legacyMultiDayTemplate ? "Editar plantilla multidía" : editingStatus ? "Editar rutina" : "Nueva rutina"}</h2><p className="mt-1 text-sm text-zinc-400">{legacyMultiDayTemplate ? "Plantilla histórica: se mantiene el editor por días para no perder contenido." : "Combiná fuerza, circuitos y formatos de tiempo dentro de cada día."}</p></div><button type="button" onClick={close} aria-label="Cerrar editor" className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-800 text-lg text-zinc-300">×</button></header>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
    {form.kind === "assigned" && form.studentIds.length === 0 ? <StudentAssignmentPicker students={students} selectedIds={form.studentIds} toggle={toggleStudent} clear={() => setForm({ ...form, studentIds: [] })} /> : <>
    {form.kind === "assigned" && <StudentAssignmentPicker students={students} selectedIds={form.studentIds} toggle={toggleStudent} clear={() => setForm({ ...form, studentIds: [] })} />}
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="md:col-span-2">Nombre<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${inputClass} mt-1`} /></label><label>Objetivo<input required list="routine-objectives" maxLength={100} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} className={`${inputClass} mt-1`} /><datalist id="routine-objectives">{objectives.map((objective) => <option key={objective} value={objective} />)}</datalist></label><label>Nivel<select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as TrainingRoutineLevel })} className={`${inputClass} mt-1`}>{levels.map((level) => <option key={level}>{level}</option>)}</select></label><label>Fecha de inicio<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className={`${inputClass} mt-1`} /></label><label>Duración (semanas)<input type="number" min="1" max="104" value={form.durationWeeks ?? ""} onChange={(event) => setForm({ ...form, durationWeeks: event.target.value ? Number(event.target.value) : null })} className={`${inputClass} mt-1`} /></label><label>Lugar<input maxLength={100} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className={`${inputClass} mt-1`} /></label><label>Estado<select disabled={updatingActiveRoutine} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TrainingRoutineStatus })} className={`${inputClass} mt-1 disabled:opacity-60`}>{statuses.filter((status) => form.kind === "assigned" || status !== "finalizada").map((status) => <option key={status}>{status}</option>)}</select></label><label className="md:col-span-2">Descripción<textarea maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="md:col-span-2">Músculos prioritarios<input value={form.priorityMuscles.join(", ")} onChange={(event) => setForm({ ...form, priorityMuscles: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} className={`${inputClass} mt-1`} /></label><label className="md:col-span-2">Equipamiento<input value={form.equipment.join(", ")} onChange={(event) => setForm({ ...form, equipment: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} className={`${inputClass} mt-1`} /></label><label className="md:col-span-2">Etiquetas<input value={form.tags.join(", ")} onChange={(event) => setForm({ ...form, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} className={`${inputClass} mt-1`} /></label></div>
    {form.kind === "assigned" && <RoutineEvaluationPanel student={selectedStudent} context={evaluationContext} loading={evaluationLoading} />}
    <nav aria-label="Días de la rutina" className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-2">{form.days.map((day) => <button type="button" key={day.clientId} onClick={() => setActiveDay(day.dayNumber)} className={`min-h-14 w-28 shrink-0 rounded-xl border px-2.5 py-2 text-left text-xs sm:w-32 ${activeDay === day.dayNumber ? "border-yellow-400 bg-yellow-400 font-bold text-zinc-950" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}><span className="block">Día {day.dayNumber}</span><span className="text-[11px] opacity-70">{day.blocks.length} bloques · {exerciseCount(day)} ejercicios</span></button>)}<button type="button" onClick={addDay} className="min-h-14 w-28 shrink-0 rounded-xl border border-dashed border-zinc-600 text-xs sm:w-32">+ Día</button></nav>
    <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3 sm:p-4"><div className="grid gap-4 lg:grid-cols-[1fr_auto]"><div className="grid gap-3 sm:grid-cols-2"><label>Nombre del día<input required value={currentDay.name} onChange={(event) => updateDay((day) => ({ ...day, name: event.target.value }))} className={`${inputClass} mt-1`} /></label><label>Duración estimada<input type="number" min="1" value={currentDay.estimatedMinutes ?? ""} onChange={(event) => updateDay((day) => ({ ...day, estimatedMinutes: event.target.value ? Number(event.target.value) : null }))} className={`${inputClass} mt-1`} /></label><label>Objetivo del día<input value={currentDay.objective} onChange={(event) => updateDay((day) => ({ ...day, objective: event.target.value }))} className={`${inputClass} mt-1`} /></label><label className="sm:col-span-2">Entrada en calor<textarea rows={3} value={currentDay.warmup} onChange={(event) => updateDay((day) => ({ ...day, warmup: event.target.value }))} className={`${inputClass} mt-1`} /></label><label className="sm:col-span-2">Observaciones<textarea value={currentDay.observations} onChange={(event) => updateDay((day) => ({ ...day, observations: event.target.value }))} className={`${inputClass} mt-1`} /></label></div><div className="grid grid-cols-2 gap-2 self-end text-xs"><button type="button" onClick={() => moveDay(-1)} className="rounded-lg bg-zinc-800 p-2">← Día</button><button type="button" onClick={() => moveDay(1)} className="rounded-lg bg-zinc-800 p-2">Día →</button><button type="button" onClick={duplicateDay} className="rounded-lg bg-zinc-800 p-2">Duplicar día</button><button type="button" onClick={removeDay} className="rounded-lg bg-red-400/10 p-2 text-red-300">Eliminar día</button></div></div>
      <BlockAdder blocks={libraryBlocks} folders={libraryFolders} ready={libraryReady} error={libraryLoadError} addNew={addBlock} addFromLibrary={addLibraryBlock} onBlockChanged={onLibraryBlockChanged} />
      <div className="mt-4 space-y-4">{currentDay.blocks.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-500">Agregá el primer bloque del día.</p> : [...currentDay.blocks].sort((a, b) => a.order - b.order).map((block) => <BlockEditor key={block.clientId} block={block} interpretation={interpretation} update={(updater) => updateBlock(block.clientId, updater)} move={(direction) => moveBlock(block.clientId, direction)} duplicate={() => duplicateBlock(block.clientId)} remove={() => removeBlock(block.clientId)} saveToLibrary={() => saveBlockToLibrary(block)} />)}</div>
    </section>
    {reminders.length > 0 && <section className="mt-5 rounded-xl border border-yellow-400/20 bg-yellow-400/[.04] p-4"><p className="text-sm font-bold text-yellow-300">Recordatorio de prioridades</p><p className="mt-1 text-xs text-zinc-500">Son sugerencias; nunca bloquean el guardado.</p><div className="mt-3 space-y-2">{reminders.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-black/30 p-3 text-sm"><span>{item.message}</span><button type="button" onClick={() => setReviewedReminders((current) => [...current, item.id])} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300">Marcar revisada</button></div>)}</div></section>}
    <footer className="sticky bottom-0 mt-4 flex flex-wrap justify-end gap-2 border-t border-zinc-800 bg-zinc-900 py-3 pb-[calc(env(safe-area-inset-bottom)+.75rem)]"><button type="button" onClick={close} disabled={saving} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm">Cancelar</button>{updatingActiveRoutine ? <button className="rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950">{saving ? "Actualizando…" : "Actualizar rutina"}</button> : <><button name="intent" value="draft" className="rounded-lg border border-yellow-400/50 px-4 py-2.5 text-sm font-bold text-yellow-300">Guardar borrador</button><button name="intent" value="activate" className="rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950">Activar rutina</button></>}</footer>
    </>}
  </form></div>;
}

type BlockEditorProps = { block: BlockDraft; interpretation: import("@/types/evaluation-interpretation").EvaluationInterpretation | null; update: (updater: (block: BlockDraft) => BlockDraft) => void; move: (direction: -1 | 1) => void; duplicate: () => void; remove: () => void; saveToLibrary?: () => void; standalone?: boolean };

function BlockEditor(props: BlockEditorProps) {
  const { issues, activeDay } = useContext(RoutineValidationContext);
  const prefix = `day.${activeDay}.block.${props.block.order}`;
  return <BlockValidationContext.Provider value={{ issues, prefix }}><BlockEditorContent {...props} /></BlockValidationContext.Provider>;
}

function BlockEditorContent({ block, interpretation, update, move, duplicate, remove, saveToLibrary, standalone = false }: BlockEditorProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryMediaEnabled, setLibraryMediaEnabled] = useState(false);
  const [libraryTargetId, setLibraryTargetId] = useState<string | null>(null);
  const [librarySession, setLibrarySession] = useState(0);
  const set = <K extends keyof BlockDraft>(key: K, value: BlockDraft[K]) => update((current) => ({ ...current, [key]: value }));
  function openLibraryFor(clientId: string) { setLibraryTargetId(clientId); setLibrarySession((value) => value + 1); setLibraryOpen(true); }
  function addLibraryExercise(item: BMExercise) { update((current) => ({ ...current, exercises: applyLibraryExerciseSelection(current.exercises, libraryTargetId, item) })); setLibraryTargetId(null); setLibraryOpen(false); }
  function updateExercise<K extends keyof ExerciseDraft>(clientId: string, key: K, value: ExerciseDraft[K]) { update((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.clientId === clientId ? { ...exercise, [key]: value } : exercise) })); }
  function changeExerciseTarget(clientId: string, targetType: ExerciseDraft["targetType"]) { update((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.clientId === clientId ? { ...exercise, ...clearedExerciseTarget(targetType) } : exercise) })); }
  function moveExercise(clientId: string, direction: -1 | 1) { update((current) => { const exercises = [...current.exercises].sort((a, b) => a.order - b.order); const index = exercises.findIndex((exercise) => exercise.clientId === clientId); const target = index + direction; if (index < 0 || target < 0 || target >= exercises.length) return current; [exercises[index], exercises[target]] = [exercises[target], exercises[index]]; return { ...current, exercises: exercises.map((exercise, i) => ({ ...exercise, order: i + 1 })) }; }); }
  function removeExercise(clientId: string) { update((current) => ({ ...current, exercises: removeRoutineExerciseDraft(current.exercises, clientId) })); }
  function unlinkExercise(clientId: string) { update((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.clientId === clientId ? unlinkLibraryExercise(exercise) : exercise) })); }
  return <article className="rounded-2xl border border-yellow-400/15 bg-zinc-900 p-3 sm:p-4"><header className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-yellow-400 px-2 py-1 text-xs font-black text-zinc-950">{blockLabels[block.type]}</span><input required aria-label="Nombre del bloque" value={block.name} onChange={(event) => set("name", event.target.value)} className={`${inputClass} min-w-48 flex-1`} />{!standalone && <><button type="button" onClick={() => move(-1)} className="rounded bg-zinc-800 px-2 py-2" aria-label="Mover bloque arriba">↑</button><button type="button" onClick={() => move(1)} className="rounded bg-zinc-800 px-2 py-2" aria-label="Mover bloque abajo">↓</button><details className="relative"><summary aria-label="Acciones del bloque" className="grid size-9 cursor-pointer list-none place-items-center rounded bg-zinc-800 text-lg text-zinc-300">⋮</summary><div className="absolute right-0 z-20 mt-1 grid min-w-48 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 p-1 shadow-2xl"><button type="button" onClick={saveToLibrary} className="min-h-10 rounded-lg px-3 text-left text-xs font-bold text-yellow-200 hover:bg-zinc-800">Guardar en Biblioteca</button><button type="button" onClick={duplicate} className="min-h-10 rounded-lg px-3 text-left text-xs text-zinc-300 hover:bg-zinc-800">Duplicar</button><button type="button" onClick={remove} className="min-h-10 rounded-lg px-3 text-left text-xs text-red-300 hover:bg-red-400/10">Eliminar</button></div></details></>}</header>
    <details open className="mt-3"><summary className="cursor-pointer text-sm font-bold text-zinc-300">Configuración del bloque</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{["ROUNDS", "INTERVAL", "FOR_TIME"].includes(block.type) && <NumberField label="Rondas" value={block.rounds} setValue={(value) => set("rounds", value)} />}{["EMOM", "AMRAP"].includes(block.type) && <NumberField label="Duración total (seg.)" value={block.durationSeconds} setValue={(value) => set("durationSeconds", value)} />}{block.type === "FOR_TIME" && <NumberField label="Límite de tiempo (seg.)" value={block.durationSeconds} setValue={(value) => set("durationSeconds", value)} />}{block.type === "EMOM" && <NumberField label="Estaciones del ciclo" value={block.targetRounds} setValue={(value) => set("targetRounds", value)} />}{block.type === "ROUNDS" && <NumberField label="Descanso entre ejercicios" value={block.restSeconds} setValue={(value) => set("restSeconds", value)} />}{block.type === "INTERVAL" && <><NumberField label="Trabajo (seg.)" value={block.workSeconds} setValue={(value) => set("workSeconds", value)} /><NumberField label="Descanso (seg.)" value={block.restSeconds} setValue={(value) => set("restSeconds", value)} /></>} {["ROUNDS", "INTERVAL", "FOR_TIME"].includes(block.type) && <NumberField label="Descanso entre rondas" value={block.restBetweenRoundsSeconds} setValue={(value) => set("restBetweenRoundsSeconds", value)} />}<label className="sm:col-span-2 lg:col-span-4">Instrucciones<textarea rows={2} value={block.instructions} onChange={(event) => set("instructions", event.target.value)} className={`${inputClass} mt-1`} /></label></div></details>
    {block.type === "MOBILITY" && <div className="mt-3 grid gap-3 sm:grid-cols-2"><NumberField label="Duración total (seg.)" value={block.durationSeconds} setValue={(value) => set("durationSeconds", value)} /></div>}
    <div className="mt-4 space-y-3">{block.exercises.map((exercise) => <div key={exercise.clientId} className={libraryExerciseIdFromMediaUrl(persistedRoutineExerciseVideoUrl(exercise)) ? "library-video-linked" : undefined}>{block.type === "STRENGTH" ? <ExerciseEditor exercise={exercise} update={(key, value) => updateExercise(exercise.clientId, key, value)} move={(direction) => moveExercise(exercise.clientId, direction)} remove={() => removeExercise(exercise.clientId)} /> : <ConditioningExerciseEditor blockType={block.type} exercise={exercise} update={(key, value) => updateExercise(exercise.clientId, key, value)} changeTarget={(targetType) => changeExerciseTarget(exercise.clientId, targetType)} move={(direction) => moveExercise(exercise.clientId, direction)} remove={() => removeExercise(exercise.clientId)} />}<ExerciseMediaEditorActions exercise={exercise} libraryMediaEnabled={libraryMediaEnabled} openLibrary={() => openLibraryFor(exercise.clientId)} unlinkLibrary={() => unlinkExercise(exercise.clientId)} /><ContextualSuggestion messages={contextualExerciseSuggestions(exercise.name, exercise.muscleGroup, interpretation)} /></div>)}</div>
    <div className="mt-3 flex justify-end border-t border-zinc-800 pt-3">
      <button type="button" onClick={() => update((current) => ({ ...current, exercises: [...current.exercises, newExercise(current.exercises.length + 1, current.type)] }))} className="min-h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs font-semibold text-zinc-300">+ Agregar ejercicio</button>
    </div>
    <ExerciseLibraryPicker key={librarySession} open={libraryOpen} onClose={() => { setLibraryTargetId(null); setLibraryOpen(false); }} onSelect={addLibraryExercise} onMediaAvailabilityChange={setLibraryMediaEnabled} />
  </article>;
}

function ExerciseMediaEditorActions({ exercise, libraryMediaEnabled, openLibrary, unlinkLibrary }: { exercise: ExerciseDraft; libraryMediaEnabled: boolean; openLibrary: () => void; unlinkLibrary: () => void }) {
  const persistedVideoUrl = persistedRoutineExerciseVideoUrl(exercise);
  const libraryExerciseId = libraryExerciseIdFromMediaUrl(persistedVideoUrl);
  const media = resolveRoutineExerciseMedia(persistedVideoUrl, libraryMediaEnabled);
  return <div className="-mt-1 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-x border-b border-zinc-800 bg-zinc-950/70 px-3 py-2.5"><div><p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{libraryExerciseId ? "Biblioteca BM" : "Video demostrativo"}</p>{libraryExerciseId ? <><p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><span aria-hidden="true">✓</span> Ejercicio vinculado</p>{media.hasMedia && <p className="mt-1 text-[11px] text-zinc-400">✓ Demostración disponible</p>}</> : <p className="mt-1 text-xs text-zinc-500">URL manual opcional o Biblioteca BM</p>}</div><div className="flex flex-wrap items-center justify-end gap-2">{libraryExerciseId && media.hasMedia && <RoutineExerciseMediaButton exercise={{ ...exercise, videoUrl: persistedVideoUrl }} libraryMediaEnabled={libraryMediaEnabled} label="Ver demostración" />}{libraryExerciseId && <button type="button" onClick={unlinkLibrary} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200">Quitar vínculo</button>}<button type="button" onClick={openLibrary} className="min-h-9 rounded-lg border border-yellow-400/20 px-3 text-xs font-semibold text-yellow-200">{libraryExerciseId ? "Cambiar desde Biblioteca" : "Buscar en Biblioteca BM"}</button></div></div>;
}

function NumericDraftInput({ value, setValue, required = false, ...inputProps }: { value: number | null; setValue: (value: number | null) => void; required?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange">) {
  const [draftValue, setDraftValue] = useState(() => value === null ? "" : String(value));

  return <input {...inputProps} required={required} type="number" value={draftValue} onChange={(event) => {
    const nextDraft = event.target.value;
    setDraftValue(nextDraft);
    const nextValue = numericDraftValue(nextDraft);
    if (nextValue !== null || !required) setValue(nextValue);
  }} />;
}

function NumberField({ label: title, value, setValue, validationKey, issue }: { label: string; value: number | null; setValue: (value: number | null) => void; validationKey?: string; issue?: RoutineValidationIssue }) {
  const context = useContext(BlockValidationContext);
  const field = title === "Rondas" ? "rounds" : title.startsWith("Duración total") || title.startsWith("Límite de tiempo") ? "durationSeconds" : title.startsWith("Trabajo") ? "workSeconds" : title === "Descanso (seg.)" ? "restSeconds" : title.startsWith("Descanso entre rondas") ? "restBetweenRoundsSeconds" : title.startsWith("Estaciones") ? "targetRounds" : title === "Segundos" ? "targetSeconds" : "";
  const resolvedKey = validationKey ?? (field && context.prefix ? `${context.prefix}.${field}` : undefined);
  const resolvedIssue = issue ?? (resolvedKey ? validationIssue(context.issues, resolvedKey) : undefined);
  return <label>{title}<NumericDraftInput min="0" value={value} setValue={setValue} {...(resolvedKey ? validationAttributes(resolvedKey, resolvedIssue) : {})} className={`${inputClass} mt-1 ${validationInputClass(resolvedIssue)}`} /><FieldValidationMessage issue={resolvedIssue} /></label>;
}

function StudentAssignmentPicker({ students, selectedIds, toggle, clear }: { students: Student[]; selectedIds: string[]; toggle: (studentId: string) => void; clear: () => void }) {
  const [query, setQuery] = useState("");
  const visible = query.trim() ? searchStudents(students, query, []) : students;
  return <fieldset className="mt-5 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"><legend className="px-1 text-base font-bold text-yellow-400">Asignar alumnos</legend><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-zinc-400">Seleccionados: <strong className="text-zinc-100">{selectedIds.length}</strong></p>{selectedIds.length > 0 && <button type="button" onClick={clear} className="min-h-9 rounded-lg px-3 text-xs font-bold text-zinc-400 hover:bg-zinc-800">Limpiar</button>}</div><label className="mt-3 block text-sm text-zinc-400">Buscar alumno<input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, apellido o teléfono" className={`${inputClass} mt-1`} /></label><div className="mt-2 max-h-64 min-w-0 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/70">{visible.length ? visible.map((student) => { const checked = selectedIds.includes(student.id); return <label key={student.id} className={`flex min-h-11 cursor-pointer items-center gap-3 border-b border-zinc-800 px-3 py-2.5 text-sm last:border-0 hover:bg-zinc-800 focus-within:outline-2 focus-within:outline-yellow-400 ${checked ? "bg-yellow-400/[.06]" : ""}`}><input type="checkbox" checked={checked} onChange={() => toggle(student.id)} className="size-4 shrink-0 accent-yellow-400" /><span className="min-w-0 flex-1 truncate">{student.firstName} {student.lastName}</span><span className="hidden truncate text-xs text-zinc-500 sm:block">{student.phone || "Sin teléfono"}</span></label>; }) : <p className="p-3 text-center text-sm text-zinc-500">No se encontraron alumnos</p>}</div></fieldset>;
}

function IntervalExerciseEditor({ exercise, update, changeTarget, move, remove }: { exercise: ExerciseDraft; update: <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) => void; changeTarget: (targetType: ExerciseDraft["targetType"]) => void; move: (direction: -1 | 1) => void; remove: () => void }) {
  const { issues, prefix } = useContext(BlockValidationContext);
  const exercisePrefix = `${prefix}.exercise.${exercise.order}`;
  const issueFor = (field: string) => validationIssue(issues, `${exercisePrefix}.${field}`);
  const attrs = (field: string) => validationAttributes(`${exercisePrefix}.${field}`, issueFor(field));
  return <article className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
    <header className="mb-3 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-yellow-400 font-bold text-zinc-950">{exercise.order}</span><button type="button" onClick={() => move(-1)} className="rounded bg-zinc-800 px-2 py-1">↑</button><button type="button" onClick={() => move(1)} className="rounded bg-zinc-800 px-2 py-1">↓</button><button type="button" onClick={remove} className="ml-auto text-sm text-red-300">Eliminar</button></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="lg:col-span-2">Ejercicio<input value={exercise.name} onChange={(event) => update("name", event.target.value)} {...attrs("name")} className={`${inputClass} mt-1 ${validationInputClass(issueFor("name"))}`} /><FieldValidationMessage issue={issueFor("name")} /></label>
      <label>Zona muscular <span className="text-xs font-normal text-zinc-500">(opcional)</span><input value={exercise.muscleGroup} onChange={(event) => update("muscleGroup", event.target.value)} className={`${inputClass} mt-1`} /></label>
      <label>Objetivo<select value={exercise.targetType} onChange={(event) => changeTarget(event.target.value as ExerciseDraft["targetType"])} className={`${inputClass} mt-1`}><option value="REPS">Repeticiones</option><option value="TIME">Tiempo</option><option value="DISTANCE">Distancia</option><option value="REST">Descanso</option><option value="FREE">Libre</option></select></label>
      {exercise.targetType === "TIME" ? <p className="self-end rounded-xl border border-yellow-400/15 bg-yellow-400/[.04] px-3 py-3 text-xs text-zinc-400">Usa el tiempo general del intervalo</p> : ["REST"].includes(exercise.targetType) ? <NumberField label="Segundos" value={exercise.targetSeconds} setValue={(value) => update("targetSeconds", value)} validationKey={`${exercisePrefix}.targetSeconds`} issue={issueFor("targetSeconds")} /> : null}
      {exercise.targetType === "REPS" && <label>Repeticiones<input value={exercise.targetRepetitions} onChange={(event) => update("targetRepetitions", event.target.value)} {...attrs("targetRepetitions")} className={`${inputClass} mt-1 ${validationInputClass(issueFor("targetRepetitions"))}`} /><FieldValidationMessage issue={issueFor("targetRepetitions")} /></label>}
      {exercise.targetType === "DISTANCE" && <label>Distancia<input value={exercise.targetDistance} onChange={(event) => update("targetDistance", event.target.value)} {...attrs("targetDistance")} placeholder="Ej. 200 m" className={`${inputClass} mt-1 ${validationInputClass(issueFor("targetDistance"))}`} /><FieldValidationMessage issue={issueFor("targetDistance")} /></label>}
      <label>Indicación o lado<input value={exercise.targetSide} onChange={(event) => update("targetSide", event.target.value)} className={`${inputClass} mt-1`} /></label>
      <label>Alternativa<input value={exercise.alternativeExercise} onChange={(event) => update("alternativeExercise", event.target.value)} className={`${inputClass} mt-1`} /></label>
      <label>Video<input type="url" value={exercise.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} className={`${inputClass} mt-1`} /></label>
      <label className="sm:col-span-2 lg:col-span-4">Observaciones técnicas<textarea value={exercise.observations} onChange={(event) => update("observations", event.target.value)} className={`${inputClass} mt-1`} /></label>
    </div>
  </article>;
}

function MobilityExerciseEditor({ exercise, update, changeTarget, move, remove }: { exercise: ExerciseDraft; update: <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) => void; changeTarget: (targetType: ExerciseDraft["targetType"]) => void; move: (direction: -1 | 1) => void; remove: () => void }) {
  const { issues, prefix } = useContext(BlockValidationContext);
  const exercisePrefix = `${prefix}.exercise.${exercise.order}`;
  const nameIssue = validationIssue(issues, `${exercisePrefix}.name`);
  return <article className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
    <header className="mb-3 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-yellow-400/15 text-sm font-black text-yellow-300">{exercise.order}</span><button type="button" onClick={() => move(-1)} className="rounded bg-zinc-800 px-2 py-1" aria-label="Mover ejercicio arriba">↑</button><button type="button" onClick={() => move(1)} className="rounded bg-zinc-800 px-2 py-1" aria-label="Mover ejercicio abajo">↓</button><button type="button" onClick={remove} className="ml-auto text-sm text-red-300">Eliminar</button></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="lg:col-span-2">Ejercicio<input value={exercise.name} onChange={(event) => update("name", event.target.value)} {...validationAttributes(`${exercisePrefix}.name`, nameIssue)} className={`${inputClass} mt-1 ${validationInputClass(nameIssue)}`} /><FieldValidationMessage issue={nameIssue} /></label>
      <label>Objetivo<select value={exercise.targetType} onChange={(event) => changeTarget(event.target.value as ExerciseDraft["targetType"])} className={`${inputClass} mt-1`}><option value="TIME">Duración</option><option value="REPS">Repeticiones</option><option value="FREE">Libre</option></select></label>
      {exercise.targetType === "TIME" && <NumberField label="Segundos" value={exercise.targetSeconds} setValue={(value) => update("targetSeconds", value)} validationKey={`${exercisePrefix}.targetSeconds`} />}
      {exercise.targetType === "REPS" && <label>Repeticiones<input value={exercise.targetRepetitions} onChange={(event) => update("targetRepetitions", event.target.value)} className={`${inputClass} mt-1`} /></label>}
      <label>Indicación o lado<input value={exercise.targetSide} onChange={(event) => update("targetSide", event.target.value)} placeholder="Ej. lado" className={`${inputClass} mt-1`} /></label>
      <label className="sm:col-span-2">Indicación breve <span className="text-xs font-normal text-zinc-500">(opcional)</span><input value={exercise.observations} onChange={(event) => update("observations", event.target.value)} className={`${inputClass} mt-1`} /></label>
      <label className="sm:col-span-2">Video <span className="text-xs font-normal text-zinc-500">(opcional)</span><input type="url" value={exercise.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} className={`${inputClass} mt-1`} /></label>
    </div>
  </article>;
}

function ConditioningExerciseEditor({ exercise, blockType, update, changeTarget, move, remove }: { exercise: ExerciseDraft; blockType: TrainingBlockType; update: <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) => void; changeTarget: (targetType: ExerciseDraft["targetType"]) => void; move: (direction: -1 | 1) => void; remove: () => void }) {
  if (blockType === "MOBILITY") return <MobilityExerciseEditor exercise={exercise} update={update} changeTarget={changeTarget} move={move} remove={remove} />;
  if (["INTERVAL"].includes(blockType)) return <IntervalExerciseEditor exercise={exercise} update={update} changeTarget={changeTarget} move={move} remove={remove} />;
  if (blockType === "INTERVAL" && exercise.targetType === "TIME") return <article className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"><header className="mb-3 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-yellow-400 font-bold text-zinc-950">{exercise.order}</span><button type="button" onClick={() => move(-1)} className="rounded bg-zinc-800 px-2 py-1">↑</button><button type="button" onClick={() => move(1)} className="rounded bg-zinc-800 px-2 py-1">↓</button><button type="button" onClick={remove} className="ml-auto text-sm text-red-300">Eliminar</button></header><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="lg:col-span-2">Ejercicio<input required value={exercise.name} onChange={(event) => update("name", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Zona muscular<input required value={exercise.muscleGroup} onChange={(event) => update("muscleGroup", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Objetivo<select value={exercise.targetType} onChange={(event) => changeTarget(event.target.value as ExerciseDraft["targetType"])} className={`${inputClass} mt-1`}><option value="REPS">Repeticiones</option><option value="TIME">Tiempo</option><option value="DISTANCE">Distancia</option><option value="REST">Descanso</option><option value="FREE">Libre</option></select></label><p className="self-end rounded-xl border border-yellow-400/15 bg-yellow-400/[.04] px-3 py-3 text-xs text-zinc-400">Usa el tiempo general del intervalo</p><label>Indicación o lado<input value={exercise.targetSide} onChange={(event) => update("targetSide", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Alternativa<input value={exercise.alternativeExercise} onChange={(event) => update("alternativeExercise", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Video<input type="url" value={exercise.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} className={`${inputClass} mt-1`} /></label><label className="sm:col-span-2 lg:col-span-4">Observaciones técnicas<textarea value={exercise.observations} onChange={(event) => update("observations", event.target.value)} className={`${inputClass} mt-1`} /></label></div></article>;
  return <article className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"><header className="mb-3 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-yellow-400 font-bold text-zinc-950">{exercise.order}</span><button type="button" onClick={() => move(-1)} className="rounded bg-zinc-800 px-2 py-1">↑</button><button type="button" onClick={() => move(1)} className="rounded bg-zinc-800 px-2 py-1">↓</button><button type="button" onClick={remove} className="ml-auto text-sm text-red-300">Eliminar</button></header><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="lg:col-span-2">Ejercicio<input required value={exercise.name} onChange={(event) => update("name", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Zona muscular<input required value={exercise.muscleGroup} onChange={(event) => update("muscleGroup", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Objetivo<select value={exercise.targetType} onChange={(event) => changeTarget(event.target.value as ExerciseDraft["targetType"])} className={`${inputClass} mt-1`}><option value="REPS">Repeticiones</option><option value="TIME">Tiempo</option><option value="DISTANCE">Distancia</option><option value="REST">Descanso</option><option value="FREE">Libre</option></select></label>{["TIME", "REST"].includes(exercise.targetType) && <NumberField label="Segundos" value={exercise.targetSeconds} setValue={(value) => update("targetSeconds", value)} />}{exercise.targetType === "REPS" && <label>Repeticiones<input value={exercise.targetRepetitions} onChange={(event) => update("targetRepetitions", event.target.value)} className={`${inputClass} mt-1`} /></label>}{exercise.targetType === "DISTANCE" && <label>Distancia<input value={exercise.targetDistance} onChange={(event) => update("targetDistance", event.target.value)} placeholder="Ej. 200 m" className={`${inputClass} mt-1`} /></label>}<label>Indicación o lado<input value={exercise.targetSide} onChange={(event) => update("targetSide", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Alternativa<input value={exercise.alternativeExercise} onChange={(event) => update("alternativeExercise", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Video<input type="url" value={exercise.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} className={`${inputClass} mt-1`} /></label><label className="sm:col-span-2 lg:col-span-4">Observaciones técnicas<textarea value={exercise.observations} onChange={(event) => update("observations", event.target.value)} className={`${inputClass} mt-1`} /></label></div></article>;
}

export function LegacyRoutineEditor({ form, setForm, students, activeDay, setActiveDay, error, close, submit, editingStatus, saving }: { form: RoutineDraft; setForm: (form: RoutineDraft) => void; students: Student[]; activeDay: number; setActiveDay: (day: number) => void; error: string; close: () => void; submit: (event: FormEvent) => void; editingStatus: TrainingRoutineStatus | null; saving: boolean }) {
  const editing = editingStatus !== null;
  const updatingActiveRoutine = editingStatus === "activa";
  const currentDay = form.days.find((day) => day.dayNumber === activeDay) ?? form.days[0];
  function updateDay(updater: (day: DayDraft) => DayDraft) { setForm({ ...form, days: form.days.map((day) => day.dayNumber === activeDay ? updater(day) : day) }); }
  function addExercise() { updateDay((day) => ({ ...day, exercises: [...day.exercises, newExercise(day.exercises.length + 1)] })); }
  function updateExercise<K extends keyof ExerciseDraft>(clientId: string, key: K, value: ExerciseDraft[K]) { updateDay((day) => ({ ...day, exercises: day.exercises.map((exercise) => exercise.clientId === clientId ? { ...exercise, [key]: value } : exercise) })); }
  function removeExercise(clientId: string) {
    if (!window.confirm("¿Eliminar este ejercicio del día? El historial previo se conservará.")) return;
    updateDay((day) => ({ ...day, exercises: day.exercises.filter((exercise) => exercise.clientId !== clientId).map((exercise, index) => ({ ...exercise, order: index + 1 })) }));
  }
  function moveExercise(clientId: string, direction: -1 | 1) { updateDay((day) => { const exercises = [...day.exercises].sort((a, b) => a.order - b.order); const index = exercises.findIndex((exercise) => exercise.clientId === clientId); const target = index + direction; if (index < 0 || target < 0 || target >= exercises.length) return day; [exercises[index], exercises[target]] = [exercises[target], exercises[index]]; return { ...day, exercises: exercises.map((exercise, order) => ({ ...exercise, order: order + 1 })) }; }); }
  function toggleStudent(studentId: string) { setForm({ ...form, studentIds: form.studentIds.includes(studentId) ? form.studentIds.filter((id) => id !== studentId) : [...form.studentIds, studentId] }); }
  function addDay() {
    if (form.days.length >= 14) return;
    const next = form.days.length + 1;
    setForm({ ...form, days: [...form.days, { clientId: crypto.randomUUID(), dayNumber: next, name: `Día ${next}`, objective: "", warmup: "", observations: "", estimatedMinutes: null, blocks: [newBlock("STRENGTH", 1)], exercises: [] }] });
    setActiveDay(next);
  }
  function moveDay(direction: -1 | 1) {
    const index = form.days.findIndex((day) => day.dayNumber === activeDay);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= form.days.length) return;
    const days = [...form.days];
    [days[index], days[target]] = [days[target], days[index]];
    const reordered = days.map((day, dayIndex) => ({ ...day, dayNumber: dayIndex + 1 }));
    setForm({ ...form, days: reordered });
    setActiveDay(target + 1);
  }
  function duplicateDay() {
    if (form.days.length >= 14) return;
    const index = form.days.findIndex((day) => day.dayNumber === activeDay);
    if (index < 0) return;
    const source = form.days[index];
    const duplicate: DayDraft = {
      clientId: crypto.randomUUID(),
      dayNumber: source.dayNumber + 1,
      name: `${source.name} (copia)`,
      objective: source.objective,
      warmup: source.warmup,
      observations: source.observations,
      estimatedMinutes: source.estimatedMinutes,
      blocks: source.blocks.map((block) => ({ ...block, id: undefined, clientId: crypto.randomUUID(), exercises: block.exercises.map((exercise) => ({ ...exercise, id: undefined, clientId: crypto.randomUUID() })) })),
      exercises: source.exercises.map((exercise) => ({ ...exercise, id: undefined, clientId: crypto.randomUUID() })),
    };
    const days = [...form.days.slice(0, index + 1), duplicate, ...form.days.slice(index + 1)].map((day, dayIndex) => ({ ...day, dayNumber: dayIndex + 1 }));
    setForm({ ...form, days });
    setActiveDay(index + 2);
  }
  function removeDay() {
    if (form.days.length === 1 || !window.confirm(`¿Eliminar “${currentDay.name}”? Sus sesiones históricas no se modificarán.`)) return;
    const index = form.days.findIndex((day) => day.dayNumber === activeDay);
    const days = form.days.filter((day) => day.dayNumber !== activeDay).map((day, dayIndex) => ({ ...day, dayNumber: dayIndex + 1 }));
    setForm({ ...form, days });
    setActiveDay(Math.min(index + 1, days.length));
  }
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-0 sm:p-4"><form onSubmit={submit} className="mx-auto min-h-dvh w-full max-w-7xl border border-zinc-800 bg-zinc-900 p-4 text-white sm:my-6 sm:min-h-0 sm:rounded-2xl sm:p-6"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">{editing ? "Editar rutina" : "Nueva rutina"}</h2><p className="mt-1 text-sm text-zinc-400">Organizá la programación por días y conservá el orden de cada ejercicio.</p></div><button type="button" onClick={close} className="self-start text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="md:col-span-2">Nombre<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${inputClass} mt-1`} /></label><label>Objetivo<input required list="routine-objectives" maxLength={100} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} className={`${inputClass} mt-1`} /><datalist id="routine-objectives">{objectives.map((objective) => <option key={objective} value={objective} />)}</datalist></label><label>Nivel<select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as TrainingRoutineLevel })} className={`${inputClass} mt-1`}>{levels.map((level) => <option key={level} value={level}>{label(level)}</option>)}</select></label><label>Fecha de inicio<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className={`${inputClass} mt-1`} /></label><label>Duración (semanas)<input type="number" min="1" max="104" value={form.durationWeeks ?? ""} onChange={(event) => setForm({ ...form, durationWeeks: event.target.value ? Number(event.target.value) : null })} className={`${inputClass} mt-1`} /></label><label>Lugar<input maxLength={100} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Casa, gimnasio o Salón BM Training" className={`${inputClass} mt-1`} /></label><label>Estado<select disabled={updatingActiveRoutine} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TrainingRoutineStatus })} className={`${inputClass} mt-1 disabled:cursor-not-allowed disabled:opacity-70`}>{statuses.filter((status) => form.kind === "assigned" || status !== "finalizada").map((status) => <option key={status} value={status}>{label(status)}</option>)}</select>{updatingActiveRoutine && <span className="mt-1 block text-xs text-zinc-500">La actualización conserva el estado activo.</span>}</label><label className="md:col-span-2">Descripción<textarea maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="md:col-span-2">Músculos prioritarios<input value={form.priorityMuscles.join(", ")} onChange={(event) => setForm({ ...form, priorityMuscles: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Pecho, espalda, glúteos" className={`${inputClass} mt-1`} /></label><label className="md:col-span-2">Equipamiento<input value={form.equipment.join(", ")} onChange={(event) => setForm({ ...form, equipment: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Mancuernas, bandas" className={`${inputClass} mt-1`} /></label><label className="md:col-span-2">Etiquetas<input value={form.tags.join(", ")} onChange={(event) => setForm({ ...form, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Full body, casa, 3 días" className={`${inputClass} mt-1`} /></label></div>
    {form.kind === "assigned" && <StudentAssignmentPicker students={students} selectedIds={form.studentIds} toggle={toggleStudent} clear={() => setForm({ ...form, studentIds: [] })} />}
    <div aria-label="Días de la rutina" className="-mx-1 mt-7 flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">{form.days.map((day) => <button type="button" key={day.clientId} onClick={() => setActiveDay(day.dayNumber)} className={`min-h-16 w-36 shrink-0 snap-start rounded-xl px-3 py-3 text-left text-sm ${activeDay === day.dayNumber ? "bg-yellow-400 font-bold text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}><span className="block whitespace-nowrap font-bold">Día {day.dayNumber}</span><span className="mt-1 block whitespace-nowrap text-xs opacity-70">{day.exercises.length} ejercicios</span></button>)}<button type="button" onClick={addDay} disabled={form.days.length >= 14} className="min-h-16 w-36 shrink-0 snap-start rounded-xl border border-dashed border-zinc-600 px-3 py-3 text-left text-sm font-bold text-zinc-300 disabled:opacity-40"><span className="block whitespace-nowrap">+ Día</span><span className="mt-1 block whitespace-nowrap text-xs font-normal text-zinc-500">Agregar bloque</span></button></div>
    <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3 sm:p-4"><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end"><div className="grid min-w-0 gap-3 sm:grid-cols-2"><label>Nombre del día<input required maxLength={100} value={currentDay.name} onChange={(event) => updateDay((day) => ({ ...day, name: event.target.value }))} className={`${inputClass} mt-1`} /></label><label>Duración estimada (min)<input type="number" min="1" max="1440" value={currentDay.estimatedMinutes ?? ""} onChange={(event) => updateDay((day) => ({ ...day, estimatedMinutes: event.target.value ? Number(event.target.value) : null }))} className={`${inputClass} mt-1`} /></label><label>Objetivo del día<input maxLength={200} value={currentDay.objective} onChange={(event) => updateDay((day) => ({ ...day, objective: event.target.value }))} className={`${inputClass} mt-1`} /></label><label className="sm:col-span-2">Entrada en calor<textarea maxLength={2000} rows={4} value={currentDay.warmup} onChange={(event) => updateDay((day) => ({ ...day, warmup: event.target.value }))} placeholder="Ej.: movilidad, activación y ejercicios preparatorios..." className={`${inputClass} mt-1`} /></label><label className="sm:col-span-2">Observaciones<textarea maxLength={1000} value={currentDay.observations} onChange={(event) => updateDay((day) => ({ ...day, observations: event.target.value }))} className={`${inputClass} mt-1`} /></label></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => moveDay(-1)} className="min-h-10 whitespace-nowrap rounded-lg bg-zinc-800 px-2 text-xs">← Mover izquierda</button><button type="button" onClick={() => moveDay(1)} className="min-h-10 whitespace-nowrap rounded-lg bg-zinc-800 px-2 text-xs">Mover derecha →</button><button type="button" onClick={duplicateDay} className="min-h-10 rounded-lg bg-zinc-800 px-2 text-xs">Duplicar día</button><button type="button" onClick={addExercise} className="min-h-10 rounded-lg bg-yellow-400 px-2 text-xs font-bold text-zinc-950">+ Ejercicio</button><button type="button" onClick={removeDay} disabled={form.days.length === 1} className="col-span-2 min-h-10 rounded-lg border border-red-400/20 bg-red-400/10 px-2 text-xs text-red-300 disabled:opacity-40">Eliminar día</button></div></div><div className="mt-4 space-y-4">{currentDay.exercises.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">Este día todavía no tiene ejercicios.</p> : [...currentDay.exercises].sort((a, b) => a.order - b.order).map((exercise) => <ExerciseEditor key={exercise.clientId} exercise={exercise} update={(key, value) => updateExercise(exercise.clientId, key, value)} move={(direction) => moveExercise(exercise.clientId, direction)} remove={() => removeExercise(exercise.clientId)} />)}</div></section>
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" onClick={close} disabled={saving} className="rounded-xl border border-zinc-700 px-5 py-3 font-bold text-zinc-300 disabled:opacity-60">Cancelar</button>
      {updatingActiveRoutine ? <button type="submit" name="intent" value="update" disabled={saving} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:opacity-60">{saving ? "Actualizando…" : "Actualizar rutina"}</button> : <>
        <button type="submit" name="intent" value="draft" disabled={saving} className="rounded-xl border border-yellow-400/50 px-5 py-3 font-bold text-yellow-300 disabled:opacity-60">{saving ? "Guardando…" : "Guardar borrador"}</button>
        <button type="submit" name="intent" value="activate" disabled={saving} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:opacity-60">{saving ? "Activando…" : "Activar rutina"}</button>
      </>}
    </div>
  </form></div>;
}

function ExerciseEditor({ exercise, update, move, remove }: { exercise: ExerciseDraft; update: <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) => void; move: (direction: -1 | 1) => void; remove: () => void }) {
  const initialRepetitions = repetitionRangeDraft(exercise.repetitions);
  const [minimumRepetitions, setMinimumRepetitions] = useState(initialRepetitions.minimum);
  const [maximumRepetitions, setMaximumRepetitions] = useState(initialRepetitions.maximum);

  function updateRepetitions(minimum: string, maximum: string) {
    setMinimumRepetitions(minimum);
    setMaximumRepetitions(maximum);
    const repetitions = serializedRepetitionRange(minimum, maximum);
    if (repetitions !== null) update("repetitions", repetitions);
  }

  return <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-yellow-400 font-bold text-zinc-950">{exercise.order}</span><span className="text-sm text-zinc-500">Orden</span><button type="button" onClick={() => move(-1)} className="rounded bg-zinc-800 px-2 py-1 text-zinc-300" aria-label="Mover ejercicio arriba">↑</button><button type="button" onClick={() => move(1)} className="rounded bg-zinc-800 px-2 py-1 text-zinc-300" aria-label="Mover ejercicio abajo">↓</button></div><button type="button" onClick={remove} className="text-sm text-red-300">Eliminar ejercicio</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="xl:col-span-2">Ejercicio<input required value={exercise.name} onChange={(event) => update("name", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Grupo muscular<input required list="muscle-groups" value={exercise.muscleGroup} onChange={(event) => update("muscleGroup", event.target.value)} className={`${inputClass} mt-1`} /><datalist id="muscle-groups">{muscleGroups.map((group) => <option key={group} value={group} />)}</datalist></label><label>Series<NumericDraftInput required min="1" max="100" value={exercise.sets} setValue={(value) => { if (value !== null) update("sets", value); }} className={`${inputClass} mt-1`} /></label><label>Reps mínimas<input required type="number" min="1" max="1000" value={minimumRepetitions} onChange={(event) => updateRepetitions(event.target.value, maximumRepetitions)} className={`${inputClass} mt-1`} /></label><label>Reps máximas<input required type="number" min="1" max="1000" value={maximumRepetitions} onChange={(event) => updateRepetitions(minimumRepetitions, event.target.value)} className={`${inputClass} mt-1`} /></label><label>Peso inicial (kg)<NumericDraftInput min="0" max="1000" step="0.25" value={exercise.weight} setValue={(value) => update("weight", value)} className={`${inputClass} mt-1`} /></label><label>Esfuerzo objetivo<select value={exercise.effortType} onChange={(event) => update("effortType", event.target.value as TrainingEffortType)} className={`${inputClass} mt-1`}><option>RIR</option><option>RPE</option></select></label><label>RIR/RPE objetivo<NumericDraftInput min="0" max="10" step="0.5" value={exercise.effortValue} setValue={(value) => update("effortValue", value)} className={`${inputClass} mt-1`} /></label><label>Descanso (seg.)<NumericDraftInput min="0" max="3600" value={exercise.restSeconds} setValue={(value) => update("restSeconds", value)} className={`${inputClass} mt-1`} /></label><label>Tempo<input maxLength={40} value={exercise.tempo} onChange={(event) => update("tempo", event.target.value)} placeholder="3-1-1" className={`${inputClass} mt-1`} /></label><label>Equipamiento<input maxLength={120} value={exercise.equipment} onChange={(event) => update("equipment", event.target.value)} className={`${inputClass} mt-1`} /></label><label className="xl:col-span-2">Ejercicio alternativo<input maxLength={120} value={exercise.alternativeExercise} onChange={(event) => update("alternativeExercise", event.target.value)} className={`${inputClass} mt-1`} /></label><label className="flex items-center gap-2 self-end rounded-xl border border-zinc-700 px-3 py-3"><input type="checkbox" checked={exercise.optional} onChange={(event) => update("optional", event.target.checked)} /> Opcional</label><label className="xl:col-span-2">Video demostrativo<input type="url" placeholder="https://…" value={exercise.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} className={`${inputClass} mt-1`} /></label><label className="md:col-span-2 xl:col-span-6">Observaciones técnicas<textarea maxLength={1000} rows={2} value={exercise.observations} onChange={(event) => update("observations", event.target.value)} className={`${inputClass} mt-1`} /></label></div></article>;
}
