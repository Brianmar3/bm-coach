import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkLibraryInteractions({page, origin, create, geometry, temp, getSaves}) {
  await page.goto(origin); await create(3);
  await page.locator('.routine-block-adder summary').click();
  for (let day=0; day<3; day++) {
    await page.locator('.routine-workspace-day').nth(day).locator('button').last().click();
    await page.getByRole('button',{name:'Fuerza',exact:true}).click();
    for(let i=0;i<5;i++) { await page.getByRole('button',{name:'Ejercicio propio',exact:true}).click(); await page.locator('.routine-exercise-quick').last().getByLabel('Ejercicio',{exact:true}).fill(`D${day+1} E${i+1}`); const row=page.locator(".routine-exercise-row").last();await row.locator("details > summary").last().click();await row.getByLabel("Grupo muscular",{exact:true}).fill("Cuádriceps");await row.locator("details > summary").last().click(); }
  }
  await page.locator('.routine-workspace-day').first().locator('button').last().click();
  const rows=()=>page.locator('.routine-exercise-quick');
  const names=()=>rows().getByLabel('Ejercicio',{exact:true}).evaluateAll(items=>items.map(x=>x.value));
  async function undoRedo(before, after) {
    await page.getByRole('button',{name:'Deshacer',exact:true}).click();assert.equal(await rows().count(),before);
    await page.getByRole('button',{name:'Rehacer',exact:true}).click();assert.equal(await rows().count(),after);
  }
  async function drag(kind,index,invalid=false) {
    const source=page.locator('.routine-library-drawer .routine-library-copy-handle').first();
    await source.scrollIntoViewIfNeeded(); const box=await source.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.mouse.move(box.x-15,box.y+5,{steps:5});
    const target=invalid?page.locator('.routine-workspace-title'):page.locator(`[data-library-drop="${kind}"]`).nth(index);
    if(!invalid) await page.waitForFunction(({kind,index})=>document.querySelectorAll(`[data-library-drop="${kind}"]`)[index]?.hasAttribute('data-enabled'),{kind,index});
    await target.scrollIntoViewIfNeeded(); const t=await target.boundingBox();
    await page.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:12});await page.mouse.up();await page.waitForTimeout(180);
  }
  await page.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).click();
  await page.getByLabel('Buscar ejercicio',{exact:true}).fill('sentadilla');
  // Native drag remains active while the canvas scrolls at the viewport edge.
  { const source=page.locator('.routine-library-copy-handle').first();await source.scrollIntoViewIfNeeded();const r=await source.boundingBox();await page.mouse.move(r.x+20,r.y+20);await page.mouse.down();await page.mouse.move(r.x-20,r.y+20,{steps:5});await page.locator('[data-library-drop="exercise"][data-enabled]').first().waitFor();const before=await page.locator('.routine-editor-workspace').evaluate(el=>el.scrollTop);await page.mouse.move(600,990,{steps:10});await page.waitForTimeout(450);assert.ok(await page.locator('.routine-editor-workspace').evaluate((el,before)=>el.scrollTop>before,before),'Canvas edge autoscroll');await page.keyboard.press('Escape');await page.mouse.up(); }
  for (const index of [0,3,7]) { const before=await rows().count();await drag('exercise',index);assert.equal(await rows().count(),before+1);assert.equal((await names())[index],'Sentadilla con barra'); }
  assert.equal(await rows().count(),8);await undoRedo(7,8);
  await drag('exercise',0,true);assert.equal(await rows().count(),8,'Invalid destination does not insert');
  await page.locator('.routine-library-drawer').getByRole('button',{name:'Agregar',exact:true}).dblclick();await page.waitForTimeout(200);assert.equal(await rows().count(),9,'Double click inserts only once');
  assert.equal(await page.getByLabel('Buscar ejercicio',{exact:true}).inputValue(),'sentadilla');
  await page.locator('.routine-library-drawer').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('button',{name:'Fuerza',exact:true}).click();
  await page.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).last().click();
  await drag('exercise',10);assert.equal(await rows().count(),10,'Empty block accepts exercise');
  await page.locator('.routine-library-drawer').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('button',{name:'Buscar en Biblioteca',exact:true}).click();
  const blocks=()=>page.getByLabel('Nombre del bloque',{exact:true});
  for (const index of [0,2,4]) { const before=await blocks().count();await drag('block',index);assert.equal(await blocks().count(),before+1);assert.equal(await blocks().nth(index).inputValue(),'Piernas base'); }
  assert.equal(await blocks().count(),5);
  await page.getByRole('button',{name:'Deshacer',exact:true}).click();assert.equal(await blocks().count(),4);
  await page.getByRole('button',{name:'Rehacer',exact:true}).click();assert.equal(await blocks().count(),5);
  await page.getByLabel('Cerrar selector de Biblioteca').click();
  await page.waitForTimeout(750);
  const backup=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('bm:routine-draft:')))));
  assert.ok(backup,'Local backup exists after library inserts');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Guardado en el servidor',{exact:true}).waitFor();
  const saved=getSaves().at(-1);assert.equal(saved.days.length,3);assert.equal(saved.days[0].blocks.length,5);
  const expected=saved.days[0].blocks.map(b=>({name:b.name,exercises:b.exercises.map(e=>e.name)}));
  await page.reload();await page.getByRole('button',{name:/Borradores/}).click();await page.getByRole('button',{name:'Continuar editando',exact:true}).first().click();
  assert.deepEqual(await blocks().evaluateAll(items=>items.map(x=>x.value)),expected.map(b=>b.name));
  assert.deepEqual(await names(),expected.flatMap(b=>b.exercises));
  const ids=await page.locator('[data-routine-block-id]').evaluateAll(items=>items.map(x=>x.dataset.routineBlockId));assert.equal(new Set(ids).size,ids.length,'Every inserted block and exercise has independent client IDs');
  for(const width of [390,768,1280,1440,1920]) {
    await page.setViewportSize({width,height:900});
    for(const theme of ['light','dark','system']) for(const accent of ['#D4A72C','#3b82f6']) {
      await page.evaluate(({theme,accent})=>{window.applyTestAppearance(theme);Object.entries(window.testBranding(accent)).forEach(([k,v])=>document.querySelector('.workspace-brand').style.setProperty(k,v));},{theme,accent});
      await page.getByRole('button',{name:'Acciones del bloque',exact:true}).last().scrollIntoViewIfNeeded();
      await page.getByRole('button',{name:'Acciones del bloque',exact:true}).last().click();
      const panel=page.locator('.routine-floating-actions');await panel.waitFor();
      assert.ok(await panel.evaluate(el=>{const r=el.getBoundingClientRect();return el.parentElement===document.body&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight+1;}),'Portal stays within viewport');
      await page.locator('.routine-editor-workspace').evaluate(el=>{el.scrollTop=Math.max(0,el.scrollTop-120);});await page.waitForTimeout(50);
      assert.ok(await panel.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}),'Menu follows scroll without clipping');
      await page.keyboard.press('Escape');assert.equal(await panel.count(),0);
      assert.ok(await page.getByRole('button',{name:'Acciones del bloque',exact:true}).last().evaluate(el=>el===document.activeElement),'Escape restores trigger focus');
      await page.getByRole('button',{name:'Acciones del bloque',exact:true}).last().click();
      await page.locator('.routine-workspace-title').click();assert.equal(await panel.count(),0,'Outside click closes');
      await page.getByRole('button',{name:'+ Agregar ejercicio',exact:true}).first().click();await geometry();
      if(width>=1280) assert.ok(await page.evaluate(()=>document.querySelector('.routine-workspace-canvas').getBoundingClientRect().right<=document.querySelector('.routine-library-drawer').getBoundingClientRect().left),'Canvas is not covered');
      if(theme==='dark'&&accent==='#3b82f6')await page.screenshot({path:path.join(temp,`library-copy-${width}.png`)});
      await page.locator('.routine-library-drawer').getByRole('button',{name:'Cerrar',exact:true}).click();
    }
  }
  console.log('Library COPY: start/middle/end, empty block, invalid destination, double click, undo/redo, local backup, save/reload, independent IDs, 30 responsive/theme/accent combinations and floating menu passed.');
}
