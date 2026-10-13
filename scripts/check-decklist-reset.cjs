const {launchTestBrowser}=require('./helpers/test-data.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const example='1 Dark Magician\n\n1 74677422\n\n1 Blue-Eyes White Dragon';
const directory='docs/validation/decklist-reset';
const ready=page=>page.waitForFunction(()=>!document.querySelector('#generate').disabled);
(async()=>{
 const browser=await launchTestBrowser(chromium,{headless:true,channel:'msedge'}),errors=[];
 const messages=JSON.parse(await fs.readFile('app/dictionaries/ui.json','utf8')).messages;
 const url=process.env.APP_URL||'http://127.0.0.1:8765/',origin=new URL(url).origin;
 try{
  await fs.mkdir(directory,{recursive:true});
  for(const width of [1440,390,320]){
   const page=await browser.newPage({locale:'it-IT',viewport:{width,height:900},isMobile:width<=760,hasTouch:width<=760});
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('https://**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   await page.goto(url);await ready(page);
   assert.equal(await page.locator('#decklist_input').inputValue(),example);
   assert.equal(await page.locator('.howto pre').textContent(),example);
   const clear=page.locator('#clear-decklist');
   for(const language of ['it','en','de','es','fr']){
    await page.locator('[data-ui-language='+language+']').click();
    assert.equal(await clear.getAttribute('aria-label'),messages[language].clearDecklist);
    assert.equal(await clear.getAttribute('title'),messages[language].clearDecklist);
    assert.equal(await clear.isDisabled(),false);
    assert.equal(await page.locator('#decklist_input').inputValue(),example);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   const bounds=await clear.boundingBox();assert.ok(bounds.width>=44&&bounds.height>=44);
   await page.locator('[data-ui-language=it]').click();
   await page.screenshot({path:`${directory}/example-${width}.png`,fullPage:true});
   await page.locator('[data-ui-language=fr]').click();
   // Freeze artwork loading to inspect the busy controls deterministically.
   let release,seen;const reached=new Promise(resolve=>seen=resolve);
   await page.route('**/api/artwork/74677422.jpg',async route=>{
    seen();await new Promise(resolve=>release=resolve);
    await route.fulfill({contentType:'image/jpeg',body:await fs.readFile('tests/fixtures/artwork/74677422.jpg')});
   });
   await page.locator('#generate').click();await reached;
   assert.equal(await clear.isDisabled(),true);assert.equal(await page.locator('#decklist_input').getAttribute('readonly'),'');
   release();await ready(page);
   assert.deepEqual(await page.locator('#preview img').evaluateAll(images=>images.map(img=>img.alt)),['Dark Magician','Red-Eyes Black Dragon','Blue-Eyes White Dragon']);
   assert.equal(await page.locator('#download').isDisabled(),false);
   await page.locator('#paper_size').selectOption('LETTER');
   await clear.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#decklist_input').inputValue(),'');assert.equal(await clear.isDisabled(),true);
   assert.equal(await page.locator('#decklist_input').evaluate(input=>input===document.activeElement),true);
   assert.equal(await page.locator('#download').isDisabled(),true);
   assert.equal(await page.locator('#paper_size').inputValue(),'LETTER');assert.equal(await page.locator('#language').inputValue(),'en');
   assert.equal(await page.locator('html').getAttribute('lang'),'fr');
   await page.locator('#generate').click();await ready(page);assert.equal(await page.locator('#status').innerText(),messages.fr.emptyDeck);
   // Clearing also cancels a pending file import, even with an already empty box.
   await page.evaluate(()=>{
    const original=File.prototype.text;
    File.prototype.text=function(){
     if(this.name==='slow.txt')return new Promise(resolve=>window.finishSlowImport=()=>{File.prototype.text=original;resolve('1 Dark Magician');});
     return original.call(this);
    };
   });
   await page.locator('#file').setInputFiles({name:'slow.txt',mimeType:'text/plain',buffer:Buffer.from('1 Dark Magician')});
   await page.waitForFunction(()=>Boolean(window.finishSlowImport));assert.equal(await clear.isDisabled(),false);
   await clear.click();assert.equal(await page.locator('#file').evaluate(input=>input.files.length),0);
   assert.equal(await page.locator('[data-file-name=file]').innerText(),messages.fr.noFile);
   await page.evaluate(()=>window.finishSlowImport());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
   assert.equal(await page.locator('#decklist_input').inputValue(),'');assert.equal(await clear.isDisabled(),true);
   await page.locator('#file').setInputFiles({name:'slow.txt',mimeType:'text/plain',buffer:Buffer.from('1 Dark Magician')});
   await page.waitForFunction(()=>document.querySelector('#decklist_input').value==='1 Dark Magician');
   await clear.click();assert.equal(await page.locator('#decklist_input').inputValue(),'');
   // Every offered print language can generate the full example using recorded API responses.
   await page.locator('#decklist_input').fill(example);
   for(const language of width===1440?['en','it','de','fr']:['en']){
    await page.locator('#language').selectOption(language);await page.locator('#generate').click();await ready(page);
    assert.equal(await page.locator('#preview img').count(),3,await page.locator('#status').innerText());
    assert.equal(await clear.isDisabled(),false);assert.equal(await page.locator('#download').isDisabled(),false);
   }
   const pending=page.waitForEvent('download');await page.locator('#download').click();
   const bytes=await fs.readFile(await(await pending).path());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
   await fs.writeFile(`${directory}/example-${width}.pdf`,bytes);
   await ready(page);const printLanguage=await page.locator('#language').inputValue();
   await clear.click();assert.equal(await page.locator('#language').inputValue(),printLanguage);
   assert.equal(await page.locator('#paper_size').inputValue(),'LETTER');
   await page.close();console.log(`${width}px: example, mocked API previews, localized reset, busy lock, file-import cancellation and PDF passed`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
