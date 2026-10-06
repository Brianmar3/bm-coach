import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BM_DEFAULT_ACCENT, workspaceOnboardingVariables } from "../lib/workspace-branding.ts";

const read = (path: string) => readFileSync(path, "utf8");
function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
test("onboarding conserva acento real y fallback BM, con contraste de botones e iconos", () => {
  assert.equal(workspaceOnboardingVariables(undefined)["--bm-accent"], BM_DEFAULT_ACCENT);
  for (const accent of [BM_DEFAULT_ACCENT, "#22C55E", "#1D4ED8", "#050505", "#FFFFFF", "#808080", "#EC4899"]) {
    const variables = workspaceOnboardingVariables(accent);
    assert.equal(variables["--bm-accent"], accent);
    assert.ok(contrast(accent, variables["--ob-contrast"]) >= 4.5, `button ${accent}`);
    assert.ok(contrast(variables["--ob-button-highlight"], variables["--ob-contrast"]) >= 4.5, `button gradient ${accent}`);
    assert.ok(contrast(variables["--ob-readable"], "#19191B") >= 4.5, `text/icon ${accent}`);
  }
});
test("usa branding del workspace desde SSR, sin resolver tenant ni tokens en el cliente", () => {
  const invitation = read("app/join/student/[token]/page.tsx");
  const onboarding = read("app/portal/onboarding/page.tsx");
  assert.match(invitation, /loadWorkspaceBranding\(invitation.workspaceId\)/);
  assert.match(onboarding, /loadWorkspaceBranding\(session.credential.student.workspaceId\)/);
  const component = read("componentes/student-onboarding.tsx");
  assert.match(component, /style=\{workspaceOnboardingVariables\(branding.accentColor\)/);
  assert.match(component, /\[1, 2, 3, 4\]/);
  assert.doesNotMatch(component, /text-yellow|#[0-9a-f]{6}/i);
  const consume = read("app/api/student-invitations/[token]/route.ts");
  assert.match(consume, /studentRecord.create\(\{ data: \{ id: studentId, workspaceId: invitation!\.workspaceId/);
});
test("botones, progreso, orbitas y foco no conservan colores dorados directos", () => {
  const styles = read("app/globals.css").split(":root {")[0];
  assert.doesNotMatch(styles, /250,204,21|250,190,20|212,167,44|#ffd83f|#edb80f|#db9f0c|#ffe16b|#e0b63e|#f8c52d|#ffe272/i);
  assert.match(styles, /\.onboarding-primary.*background:linear-gradient\(180deg,var\(--ob-button-highlight\),var\(--ob-accent\)\).*color:var\(--ob-contrast\)/);
  assert.match(styles, /\.onboarding-progress i.active.*var\(--ob-accent\)/);
  assert.match(styles, /focus-visible.*var\(--ob-readable\)/);
  assert.match(styles, /onboarding-field-error.*248,113,113/);
  assert.match(styles, /safe-area-inset-bottom/);
});
test("diana central neutra: círculos concéntricos y punto, sin flechas ni persona", () => {
  const component = read("componentes/student-onboarding.tsx");
  const target = component.split("function OnboardingTargetIcon()")[1].split("type PhysicalField")[0];
  assert.equal((target.match(/<circle cx="12" cy="12"/g) ?? []).length, 3);
  assert.match(target, /r="1.8" fill="currentColor"/);
  assert.doesNotMatch(target, /<path|<line|<polygon|BmProfile|BmTarget|WorkspaceBrandLogo/);
  assert.match(component, /<div><OnboardingTargetIcon \/><\/div>/);
});
