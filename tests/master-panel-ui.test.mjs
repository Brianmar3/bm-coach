import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
function loadComponent(){
 const exports={};
 const deps={
  react:React,'react/jsx-runtime':require('react/jsx-runtime'),
  'next/link':{__esModule:true,default:({children,...props})=>{delete props.prefetch;return React.createElement('a',props,children);}},
  '@/componentes/keyboard-tabs':{KeyboardTabs:({children,...props})=>React.createElement('div',props,children)},
  '@/componentes/keyboard-dialog':{KeyboardDialog:({children,as='section',...props})=>{delete props.onClose;delete props.dismissible;return React.createElement(as,{...props,role:'dialog'},children);}},
  '@/componentes/module-shell':{inputClass:''},
  '@/componentes/platform-invitations':{PlatformInvitations:({onNewInvitation})=>React.createElement('button',{onClick:onNewInvitation},'+ Invitar entrenador')},
  '@/componentes/trainer-membership-manager':{subscriptionLabel:{ACTIVE:'Al día'},subscriptionBadge:{ACTIVE:''},TrainerMembershipManager:()=>null},
 };
 const code=ts.transpileModule(readFileSync('componentes/platform-trainers.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','exports',code)(name=>{assert.ok(name in deps,name);return deps[name];},exports);
 return exports.PlatformTrainers;
}
test('lista real refresca al volver, mantiene un CTA y no refresca encima del formulario',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://bm.test/platform/trainers'});
 const previous={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
 const root=createRoot(document.getElementById('root'));
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.fetch=previous.fetch;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;});
 let active=1,limit=20,calls=0;
 globalThis.fetch=async url=>{
  assert.equal(url,'/api/platform/trainers');calls++;
  return Response.json({invitations:[],trainers:[{id:'trainer',name:'Test trainer',email:'test@example.test',status:'ACTIVE',createdAt:'2026-01-01',effectiveSubscriptionStatus:'ACTIVE',trainerSubscription:null,memberships:[{workspace:{id:'a',name:'Test workspace',status:'ACTIVE',studentCounts:{total:active+1,active,inactive:1},capacity:{plan:'STARTER',used:active,limit,reached:false,nearLimit:false}}}]}]});
 };
 const Component=loadComponent();
 await act(async()=>root.render(React.createElement(Component)));
 assert.match(document.body.textContent,/1 \/ 20/);
 assert.doesNotMatch(document.body.textContent,/Alumnos activos: ocupan cupo|\d+ total/);
 assert.ok([...document.querySelectorAll('button')].some(button=>button.textContent==='Actualizar datos'));
 assert.equal([...document.querySelectorAll('button')].filter(button=>button.textContent==='+ Invitar entrenador').length,1);
 active=3;limit=null;await act(async()=>window.dispatchEvent(new window.Event('focus')));
 const card=document.querySelector('article');
 assert.equal(card.querySelector('div.md\\:hidden p.font-bold.mt-1')?.textContent,'3 / ∞');
 assert.equal(card.querySelector('dd.font-bold')?.textContent,'3 / ∞');
 assert.doesNotMatch(card.textContent,/\d+ total/);
 const invite=[...document.querySelectorAll('button')].find(button=>button.textContent==='+ Invitar entrenador');
 await act(async()=>invite.click());
 assert.ok(document.querySelector('form[aria-label="Invitar entrenador"]'));
 const before=calls;await act(async()=>window.dispatchEvent(new window.Event('focus')));assert.equal(calls,before);
 await act(async()=>root.render(React.createElement(Component,{key:'direct',initialInviteOpen:true})));
 assert.equal(calls,before+1);
 assert.ok(document.querySelector('form[role="dialog"]'));
 assert.doesNotMatch(document.body.textContent,/Cargando…/);
});
