import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { onboardingData, onboardingIsComplete, onboardingValidation } from "../lib/student-onboarding.ts";
import type { Student } from "../types/gestion.ts";

const page = readFileSync("componentes/student-onboarding.tsx", "utf8");
const api = readFileSync("app/api/portal/onboarding/route.ts", "utf8");
const layout = readFileSync("app/portal/(student)/layout.tsx", "utf8");
const detail = readFileSync("componentes/routine-follow-up-dashboard.tsx", "utf8");
const profile = readFileSync("componentes/student-profile-view.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");
const base = { birthDate: "2000-01-01", height: 178, weight: 70, goal: "Ganar fuerza", experienceLevel: "Principiante", trainingExperience: "Menos de 6 meses", trainingCurrently: null, hasLimitations: false, limitations: "", onboardingCompleted: false, onboardingUpdatedAt: "" };

test("alumno incompleto entra al onboarding y uno completo entra al portal", () => {
  assert.equal(onboardingIsComplete(base as Student), false);
  assert.equal(onboardingIsComplete({ ...base, onboardingCompleted: true } as Student), true);
  assert.match(layout, /redirect\("\/portal\/onboarding"\)/);
});
test("el flujo tiene bienvenida y progreso de cuatro pasos", () => { assert.match(page, /Completá tu/); assert.match(page, /\[1, 2, 3, 4\]/); assert.match(page, /\{step\} de 4/); });
test("no vuelve a pedir datos administrativos existentes", () => { assert.doesNotMatch(page, /Nombre|Teléfono|Plan|Días disponibles|Lugar de entrenamiento/); });
test("peso y altura son opcionales; si se informan, se validan", () => {
  assert.equal(onboardingValidation(base, 1), "");
  assert.equal(onboardingValidation({ ...base, birthDate: "" }, 1), "Seleccioná tu fecha de nacimiento.");
  assert.equal(onboardingValidation({ ...base, weight: null }, 1), "");
  assert.equal(onboardingValidation({ ...base, height: null }, 1), "");
  assert.equal(onboardingValidation({ ...base, height: null, weight: null }, 4), "");
  assert.equal(onboardingValidation({ ...base, height: 0 }, 1), "Ingresá una altura válida.");
  assert.equal(onboardingValidation({ ...base, height: 79 }, 1), "Ingresá una altura válida.");
  assert.equal(onboardingValidation({ ...base, weight: 0 }, 1), "Ingresá un peso válido.");
  assert.equal(onboardingValidation({ ...base, weight: 351 }, 1), "Ingresá un peso válido.");
  assert.equal(onboardingValidation({ ...base, weight: NaN }, 1), "Ingresá un peso válido.");
  assert.match(page, /label="Altura \(opcional\)"/);
  assert.match(page, /label="Peso actual \(opcional\)"/);
  assert.match(page, /event\.target\.value === "" \? null/);
  assert.match(api, /birthDate.*height.*weight/s);
});
test("valida y guarda objetivo", () => { assert.equal(onboardingValidation({ ...base, goal: "" }, 2), "Elegí tu objetivo principal."); assert.match(api, /goal:/); });
test("valida nivel, experiencia y molestias", () => { assert.equal(onboardingValidation({ ...base, experienceLevel: "" }, 3), "Elegí tu nivel de experiencia."); assert.match(api, /experienceLevel.*trainingExperience.*hasLimitations.*limitations/s); });
test("entrenamiento actual se guarda aparte de la experiencia y los valores legados no se infieren", () => {
  assert.match(page, /¿Entrenás actualmente\?/);
  assert.match(page, /Experiencia entrenando/);
  assert.match(api, /trainingCurrently:/);
  assert.equal(onboardingData({ ...base, trainingCurrently: true } as Student).trainingCurrently, true);
  assert.equal(onboardingData({ ...base, trainingCurrently: false } as Student).trainingCurrently, false);
  assert.equal(onboardingData({ ...base, trainingCurrently: undefined } as Student).trainingCurrently, null);
  assert.equal(onboardingData({ ...base, trainingCurrently: undefined } as Student).trainingExperience, "Menos de 6 meses");
  assert.equal(onboardingData({ ...base, height: 1.78 } as Student).height, 178);
});
test("el endpoint edita sólo al alumno autenticado", () => { assert.match(api, /where: \{ id: session\.studentId \}/); assert.doesNotMatch(api, /studentId.*body\.data/); });
test("completar persiste la marca y evita mostrarlo nuevamente", () => { assert.match(api, /onboardingCompleted: body\.complete === true/); assert.match(layout, /onboardingIsComplete/); });
test("el entrenador recibe el Perfil inicial desde la misma ficha", () => { assert.match(detail, /Perfil inicial/); assert.match(detail, /initialProfile/); });
test("la edición posterior actualiza los mismos campos", () => { assert.match(profile, /experienceLevel/); assert.match(profile, /trainingExperience/); assert.match(profile, /trainingCurrently/); assert.match(profile, /onChange\(event\.target\.value === "" \? null/); assert.match(profile, /limitations/); });
test("la primera pantalla conserva la ilustración sin logos ni bloque de marca", () => { assert.match(page, /onboarding-orbit/); assert.match(page, /BmProfileIcon/); assert.doesNotMatch(page, /WorkspaceBrandLogo|onboarding-brand|Gestión, entrenamiento/); });
test("los pasos enfocan el formulario y muestran errores junto al campo", () => { assert.match(page, /grid-template-columns:2\.5rem 1fr 2\.5rem|aria-hidden="true"/); assert.match(page, /onboarding-field-error/); assert.match(page, /aria-invalid/); assert.match(page, /aria-describedby/); });
test("los estilos reales incluyen mobile, safe-area y reduced motion", () => { assert.match(styles, /100svh/); assert.match(styles, /safe-area-inset/); assert.match(styles, /prefers-reduced-motion/); assert.match(styles, /onboarding-summary/); });
test("los datos existentes se normalizan sin crear un perfil paralelo", () => { assert.deepEqual(onboardingData(base as Student), base); assert.match(api, /studentRecord\.update/); });
