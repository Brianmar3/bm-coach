import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const require=createRequire(import.meta.url), ts=require('typescript');
const mod={exports:{}};
new Function('module','exports',ts.transpileModule(readFileSync('lib/portal-home-scroll.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports);
const {trackPortalHomeScroll}=mod.exports;
function environment(){const {window:w}=new JSDOM('<a href="/portal/pagos">Pagos</a>',{url:'https://bm.test/portal',pretendToBeVisual:true});w.document.querySelector('a').addEventListener('click',e=>e.preventDefault());let y=0;Object.defineProperty(w,'scrollY',{get:()=>y});Object.defineProperty(w.document.documentElement,'scrollHeight',{value:3000});w.scrollTo=({top})=>{y=top};globalThis.MouseEvent=w.MouseEvent;return w;}
test('guarda scroll, bloquea el reset al navegar y restaura al volver',async()=>{const w=environment();let cleanup=trackPortalHomeScroll(w,'student-a',true);w.scrollTo({top:640});w.dispatchEvent(new w.Event('scroll'));w.document.querySelector('a').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));w.scrollTo({top:0});w.dispatchEvent(new w.Event('scroll'));assert.equal(w.sessionStorage.getItem('student-a'),'640');cleanup();cleanup=trackPortalHomeScroll(w,'student-a',true);await new Promise(r=>w.setTimeout(r,70));assert.equal(w.scrollY,640);cleanup();w.close();});
test('popstate conserva la posición de salida y no cambia history.scrollRestoration',()=>{const w=environment();const cleanup=trackPortalHomeScroll(w,'a',true);w.scrollTo({top:350});w.dispatchEvent(new w.PopStateEvent('popstate'));w.scrollTo({top:0});w.dispatchEvent(new w.Event('scroll'));assert.equal(w.sessionStorage.getItem('a'),'350');assert.equal(w.history.scrollRestoration,undefined);cleanup();w.close();});
test('aislamiento por alumno y ninguna escritura fuera de Inicio',()=>{const w=environment();w.sessionStorage.setItem('a','200');const cleanup=trackPortalHomeScroll(w,'b',false);w.scrollTo({top:90});w.dispatchEvent(new w.Event('scroll'));assert.equal(w.sessionStorage.getItem('b'),null);assert.equal(w.sessionStorage.getItem('a'),'200');cleanup();w.close();});
test('storage bloqueado no impide navegar',()=>{const w=environment();Object.defineProperty(w,'sessionStorage',{get(){throw Error('blocked')}});const cleanup=trackPortalHomeScroll(w,'a',true);w.dispatchEvent(new w.Event('scroll'));cleanup();w.close();});
test('trofeo reutiliza Ranking, alcance CLASSES y movimiento reducido sin transformaciones',()=>{const shell=readFileSync('componentes/portal-shell.tsx','utf8'),css=readFileSync('componentes/portal-classes-navigation.module.css','utf8');assert.match(shell,/serviceType === "CLASSES" && isCompetitiveGamificationEligible/);assert.ok(shell.includes('href="/portal/ranking" aria-label="Abrir Ranking"'));assert.match(css,/prefers-reduced-motion: reduce/);assert.doesNotMatch(css,/transform|height|translate/);});

test('cerrar el scope cancela la restauración pendiente',async()=>{const w=environment();w.sessionStorage.setItem('a','500');const cleanup=trackPortalHomeScroll(w,'a',true);cleanup();await new Promise(r=>w.setTimeout(r,70));assert.equal(w.scrollY,0);w.close();});
