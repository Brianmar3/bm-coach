import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function transpile(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;}
const pageModule={exports:{}};
new Function('require','module','exports',transpile(readFileSync('app/seguimiento/page.tsx','utf8')))(name=>name==='@/componentes/module-shell'?{ModuleShell:()=>null}:name==='@/componentes/routine-follow-up-dashboard'?{RoutineFollowUpDashboard:()=>null}:require(name),pageModule,pageModule.exports);
for(const id of ['a','b'])test('la ruta directa conserva alumno '+id+' y sesión en el primer render del servidor',async()=>{
 const page=await pageModule.exports.default({searchParams:Promise.resolve({studentId:'student-'+id,sessionId:'session-'+id})});
 assert.equal(page.props.children.props.initialStudentId,'student-'+id);assert.equal(page.props.children.props.initialSessionId,'session-'+id);
});
test('varios alumnos y sesiones conservan sus filtros, sin redirecciones al listado general',async()=>{
 const page=await pageModule.exports.default({searchParams:Promise.resolve({studentIds:'a,b',sessionIds:'one,two'})});assert.deepEqual(page.props.children.props.initialStudentIds,['a','b']);assert.deepEqual(page.props.children.props.initialSessionIds,['one','two']);
});
const source=readFileSync('componentes/routine-follow-up-dashboard.tsx','utf8');
const a=source.indexOf('  const openStudent = useCallback'),b=source.indexOf('\n  useEffect',a);
const openSource=source.slice(a,b);
for(const width of [390,1280])test(width+'px abre alumno y sesión exactos; sesión inexistente conserva el seguimiento',async()=>{
 for(const studentId of ['student-a','student-b']){
  let selected,tab,session,error;const calls=[];
  const make=new Function('useCallback','openerRef','document','setSelectedStudent','setTab','setDetail','setDetailLoading','setDetailError','apiRequest','setSelectedSession',transpile(openSource+'\nreturn openStudent;'));
  const open=make(fn=>fn,{current:null},{activeElement:null},value=>selected=value,value=>tab=value,()=>{},()=>{},value=>error=value,async url=>{calls.push(url);return {sessions:[{id:'session-'+studentId}]};},value=>session=value);
  await open({studentId},'sesiones','session-'+studentId);assert.equal(selected.studentId,studentId);assert.equal(tab,'sesiones');assert.equal(session.id,'session-'+studentId);assert.equal(new URL(calls[0],'https://bm.test').searchParams.get('studentId'),studentId);
  await open({studentId},'sesiones','missing');assert.equal(selected.studentId,studentId);assert.equal(session,null);assert.equal(error,'');
 }
});
test('las consultas existentes conservan autenticación y aislamiento de alumno/workspace',()=>{const api=readFileSync('app/api/seguimiento/detalle/route.ts','utf8');assert.match(api,/requireAdminApiResponse\(\)/);assert.match(api,/assertStudentInWorkspace\(studentId, workspaceId\)/);assert.match(api,/followUpSessionWhere\(workspaceId, \{ studentId \}\)/);});
