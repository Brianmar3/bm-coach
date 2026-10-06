// Visual-only fixture: renders the actual component, without login or database writes.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(path.join(process.cwd(), "package.json"));
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { chromium } = createRequire(path.join(process.env.BM_TEST_NODE_MODULES, "playwright/package.json"))("playwright");
function compile(file, resolve = require) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} }; new Function("require", "module", "exports", code)(resolve, compiledModule, compiledModule.exports); return compiledModule.exports;
}
const avatars = compile("lib/profile-avatars.ts");
const branding = compile("lib/workspace-branding.ts");
let currentBranding;
const { StudentAvatarPage } = compile("componentes/student-avatar-page.tsx", (name) => {
  if (name === "next/link") return function FixtureLink({ children, ...props }) { return React.createElement("a", props, children); };
  if (name === "next/navigation") return { useRouter: () => ({ refresh() {} }) };
  if (name.includes("workspace-branding-provider")) return { useWorkspaceBranding: () => currentBranding };
  if (name.includes("profile-avatars")) return avatars;
  if (name.endsWith(".module.css")) return Object.fromEntries(["page", "back", "current", "choice", "check"].map((key) => [key, key]));
  if (name === "@/componentes/icons") return { BmCheckIcon: ({ size }) => React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 }, React.createElement("path", { d: "m5 12 4 4L19 6" })) };
  return require(name);
});
const chunks = ".next/static/chunks";
const css = readdirSync(chunks).filter((file) => file.endsWith(".css")).map((file) => readFileSync(path.join(chunks, file), "utf8")).join("\n") + readFileSync("componentes/student-avatar-page.module.css", "utf8").replace(/:global\((html:not\(\[data-theme="light"\]\))\)/g, "$1");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const theme of ["light", "dark"]) for (const accent of ["#D4A72C", "#22C55E"]) for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    await page.route("http://bm.local/**", (route) => {
      const url = new URL(route.request().url());
      if (!/^\/avatars\/[\w-]+\.webp$/.test(url.pathname)) return route.abort();
      return route.fulfill({ contentType: "image/webp", body: readFileSync(path.join("public", url.pathname)) });
    });
    currentBranding = { ...branding.DEFAULT_WORKSPACE_BRANDING, accentColor: accent };
    const variables = Object.entries(branding.workspaceBrandingVariables(accent)).map(([key, value]) => `${key}:${value}`).join(";");
    const profile = { avatarPresetId: avatars.PROFILE_AVATARS[0].id, profileImageUrl: avatars.PROFILE_AVATARS[0].src, hasProfilePhoto: true };
    const content = renderToStaticMarkup(React.createElement(StudentAvatarPage, { profile }));
    // Same main clearance and fixed nav geometry used by PortalShell.
    await page.setContent(`<!doctype html><html data-theme="${theme}"><head><base href="http://bm.local/"><style>${css}</style></head><body><div class="workspace-brand" style="${variables}"><main class="mx-auto max-w-6xl p-2.5 pb-[calc(var(--portal-bottom-nav-height)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-clearance)+env(safe-area-inset-bottom))] sm:p-6 md:pb-12">${content}</main><nav class="portal-mobile-nav fixed bottom-[calc(env(safe-area-inset-bottom)+var(--portal-bottom-nav-offset))] left-5 right-5 h-[var(--portal-bottom-nav-height)] md:hidden">Inicio · Rutina · Perfil</nav></div></body></html>`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const back = await page.getByRole("link", { name: "Volver" }).boundingBox(); assert.equal(back.height, 44);
    const selected = page.getByRole("button", { name: "Elegir avatar Avatar 01", exact: true });
    assert.equal(await selected.getAttribute("aria-pressed"), "true"); assert.equal(await selected.locator(".check").count(), 1);
    const colors = await page.evaluate(() => ({ background: getComputedStyle(document.querySelector(".current")).backgroundImage, surface: getComputedStyle(document.documentElement).getPropertyValue("--surface").trim(), selected: getComputedStyle(document.querySelector('.choice[aria-pressed="true"]')).borderColor }));
    assert.ok(colors.background.includes(theme === "light" ? "255, 254, 250" : "21, 21, 23"));
    assert.equal(colors.selected, accent === "#D4A72C" ? "rgb(212, 167, 44)" : "rgb(34, 197, 94)");
    const last = page.getByRole("button", { name: "Elegir avatar Avatar 32", exact: true });
    await last.scrollIntoViewIfNeeded();
    if (width < 768) {
      const card = await last.boundingBox(); const nav = await page.locator("nav").boundingBox();
      assert.ok(card.y + card.height < nav.y, "Last avatar row must fit above navigation");
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const upload = await page.getByText("Subir foto propia", { exact: true }).boundingBox();
      assert.ok(upload.y + upload.height < nav.y, "Final controls must fit above navigation");
    }
    // Also check the exact own-photo state shown in the user's screenshot.
    const ownPhoto = renderToStaticMarkup(React.createElement(StudentAvatarPage, { profile: { profileImageUrl: "/api/portal/media/profile/test", hasProfilePhoto: true } }));
    assert.ok(ownPhoto.includes("Imagen de perfil"));
    if (width === 390 && accent === "#D4A72C") {
      await page.evaluate(() => { document.body.style.fontFamily = "Arial, sans-serif"; scrollTo(0, 0); });
      await page.waitForFunction(() => [...document.querySelectorAll("img")].slice(0, 7).every((img) => img.complete && img.naturalWidth > 0));
      await page.screenshot({ path: `.avatar-${theme}.png` });
    }
    console.log(`${theme}, ${accent}, ${width}px: surface, selection, touch target, overflow and last row OK`);
    await page.close();
  }
} finally { await browser.close(); }
