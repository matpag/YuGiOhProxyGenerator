const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const ready=page=>page.waitForFunction(()=>!document.querySelector('#generate').disabled);
async function generate(page,deck){await page.locator('#decklist_input').fill(deck);await page.locator('#generate').click();await ready(page);assert.ok(await page.locator('#preview figure').count()>0,await page.locator('#status').innerText());}
async function initialMobileFlow(page){
 assert.equal(await page.locator('.howto').count(),1);
 const help=await page.locator('.howto').boundingBox(),deck=await page.locator('.decklist').boundingBox();
 assert.ok(help.y+help.height<=deck.y,'Mobile help must precede the decklist');
 assert.ok(await page.locator('.howto').evaluate(e=>Boolean(e.compareDocumentPosition(document.querySelector('.decklist'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Reading order must match visual order');
 await page.locator('#generate').scrollIntoViewIfNeeded();await fits(page,'#generate');
}
const fits=async(page,selector)=>{const b=await page.locator(selector).boundingBox();const v=page.viewportSize();assert.ok(b&&b.x>=-1&&b.x+b.width<=v.width+1&&b.y>=-1&&b.y+b.height<=v.height+1,`${selector} is unreachable in ${v.width}x${v.height}`);};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[];
 try{
  const page=await browser.newPage({locale:'it-IT',viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.releasedPreviewUrls=[];const revoke=URL.revokeObjectURL;URL.revokeObjectURL=url=>{window.releasedPreviewUrls.push(url);revoke.call(URL,url);};});
  await page.route('https://**/*',r=>r.abort());await page.goto('http://127.0.0.1:8765/');await ready(page);
  await initialMobileFlow(page);
  await page.locator('#generate').click();await ready(page);
  await page.locator('#language').selectOption('it');assert.equal(await page.locator('#download').isDisabled(),true);
  assert.equal(await page.locator('#preview button').first().isDisabled(),true,'Stale previews must disable editing');assert.match(await page.locator('#status').innerText(),/rigenerare/);
  await page.locator('#decklist_input').fill('3 Dark Magician');
  await page.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File(['1 Dark Hole\n1 Mirror Force'],'deck.txt',{type:'text/plain'}));document.querySelector('#decklist_input').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));});
  await page.waitForFunction(()=>document.querySelector('#decklist_input').value.includes('Dark Hole'));
  assert.equal(await page.locator('#decklist_input').inputValue(),'1 Dark Hole\n1 Mirror Force','Drop must replace the deck, like file selection');
  await generate(page,'1 Pot of Greed\n1 Decode Talker\n10 Dark Magician');
  await page.locator('#view-pages').click();assert.equal(await page.locator('#paper-preview img').count(),9);assert.match(await page.locator('#page-number').innerText(),/1 di 2/);
  await page.locator('#next-page').click();assert.equal(await page.locator('#paper-preview img').count(),3);assert.equal(await page.locator('#next-page').isDisabled(),true);
  // Units shown in the form must reach the shared PDF geometry unchanged.
  await page.locator('.advanced').evaluate(e=>e.open=true);await page.locator('#card_scale').fill('50');await page.locator('#margin_document').fill('10');await page.locator('#margin_cards').fill('2');
  assert.match(await page.locator('#print-summary').innerText(),/29,5 × 43 mm/);
  const placement=await page.locator('#paper-preview img').first().evaluate(img=>({left:parseFloat(img.style.left),top:parseFloat(img.style.top),width:parseFloat(img.style.width)}));
  assert.ok(Math.abs(placement.left-100*10/210)<.001);assert.ok(Math.abs(placement.top-100*10/297)<.001);assert.ok(Math.abs(placement.width-100*29.5/210)<.001);
  await page.locator('#margin_document').fill('300');assert.equal(await page.locator('#download').isDisabled(),true);assert.match(await page.locator('#preview-summary').innerText(),/non entra/);
  await page.locator('#margin_document').fill('7');await page.locator('#margin_cards').fill('0');await page.locator('#card_scale').fill('100');assert.equal(await page.locator('#download').isDisabled(),false);
  await page.locator('#view-cards').click();await page.locator('#preview img').first().focus();await page.keyboard.press('Enter');await page.locator('#zoom').waitFor({state:'visible'});await fits(page,'#close-zoom');await page.keyboard.press('Escape');
  await page.locator('#preview button').first().click();assert.equal(await page.locator('#monster-fields').isVisible(),false);assert.equal(await page.locator('#pendulum-toggle').isVisible(),false);await fits(page,'#apply-edit');await fits(page,'#close-editor-top');
  await page.locator('#edit-name').fill('Spell test');await page.locator('#editor-preview-details').evaluate(e=>e.open=true);await page.waitForFunction(()=>document.querySelector('#edit-preview-img').alt==='Spell test');const liveUrl=await page.locator('#edit-preview-img').getAttribute('src');await page.locator('#apply-edit').click();await page.locator('#editor').waitFor({state:'hidden'});
  assert.equal(await page.locator('#preview img').first().getAttribute('alt'),'Spell test');assert.ok(await page.evaluate(url=>window.releasedPreviewUrls.includes(url),liveUrl),'Closing the editor must release temporary preview images');assert.ok(await page.locator('#preview img').first().evaluate(img=>img.complete&&img.naturalWidth>0));
  await page.locator('#preview button').nth(1).click();assert.equal(await page.locator('#edit-def').isVisible(),false);assert.equal(await page.locator('#pendulum-toggle').isVisible(),false);assert.equal(await page.locator('#level-label').innerText(),'Valore Link');await page.locator('#close-editor').click();
  await page.locator('#preview button').nth(2).click();assert.equal(await page.locator('#pendulum-fields').isVisible(),false);await page.locator('#edit-pendulum').check();assert.equal(await page.locator('#pendulum-fields').isVisible(),true);await fits(page,'#apply-edit');await page.locator('#close-editor').click();
  await page.locator('#decklist_input').fill('1 Dark Magician');assert.equal(await page.locator('#preview button').first().isDisabled(),true);await generate(page,'1 Dark Magician');
  const pending=page.waitForEvent('download');await page.locator('#download').click();const pdf=await pending;assert.equal((await fs.readFile(await pdf.path())).subarray(0,5).toString(),'%PDF-');
  // Many entries must retain a reachable route to download on a small screen.
  await generate(page,Array(16).fill('1 Dark Magician').join('\n'));await page.locator('#preview img').first().scrollIntoViewIfNeeded();await page.locator('#download-shortcut').waitFor({state:'visible'});await fits(page,'#download-shortcut');await page.locator('#download-shortcut').click();await fits(page,'#download');await page.close();
  for(const language of ['it','en','de','es','fr']){
   const page=await browser.newPage({locale:language,isMobile:true,hasTouch:true,viewport:{width:320,height:740}});page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.goto('http://127.0.0.1:8765/');await ready(page);await initialMobileFlow(page);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('[data-ui-language=en]').tap();await page.locator(`[data-ui-language=${language}]`).tap();assert.equal(await page.locator('#language').inputValue(),'en');
   await generate(page,'1 Dark Magician');await page.locator('#preview button').tap();await fits(page,'#apply-edit');await fits(page,'#close-editor-top');
   await page.setViewportSize({width:740,height:320});await fits(page,'#apply-edit');await fits(page,'#close-editor-top');assert.ok(await page.evaluate(()=>document.querySelector('#editor').scrollWidth<=document.querySelector('#editor').clientWidth));await page.locator('#close-editor').click();await page.close();
  }
  assert.deepEqual(errors,[]);console.log('UI regressions, zoom, live editor, print geometry, multipage PDF, long-deck download and five-language mobile/landscape checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
