const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const messages=JSON.parse(await fs.readFile('app/dictionaries/ui.json','utf8')).messages;
 const dict=JSON.parse(await fs.readFile('app/dictionaries/tcg.json','utf8'));
 const names={en:'Dark Magician',it:'Mago Nero',de:'Dunkler Magier',fr:'Magicien Sombre'};
 const errors=[];
 const ready=page=>page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 try{
  await fs.mkdir('docs/validation/multi5',{recursive:true});
  for(const [locale,expected] of [['it-IT','it'],['en-US','en'],['de-DE','de'],['es-ES','es'],['fr-CA','fr'],['ja-JP','en']]){
   const page=await browser.newPage({locale,viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://**/*',route=>route.abort());
   await page.goto('http://127.0.0.1:8765/');await ready(page);
   assert.equal(await page.locator('html').getAttribute('lang'),expected);
   assert.equal(await page.locator(`[data-ui-language=${expected}]`).getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('.title').innerText(),/\[MULTI5\]/);
   assert.equal(await page.locator('#language').inputValue(),'it','Browser UI language must not change the print default');
   assert.deepEqual(await page.locator('#language option').evaluateAll(options=>options.map(o=>o.value)),['en','it','de','fr']);
   assert.equal(await page.locator('#project-controls').isVisible(),false);
   assert.equal(await page.locator('#save-project').isVisible(),false);assert.equal(await page.locator('#project-file').isVisible(),false);
   assert.equal(await page.locator('[data-file-name=file]').innerText(),messages[expected].noFile);
   assert.equal(await page.locator('[data-file-input=file]').innerText(),messages[expected].chooseFile);
   assert.equal(await page.locator('.ui-languages img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)),true);
   if(locale==='ja-JP'){await page.close();continue;}
   for(const printLanguage of Object.keys(names)){
    await page.locator('#language').selectOption(printLanguage);await page.locator('#generate').click();await ready(page);
    assert.equal(await page.locator('#preview img').getAttribute('alt'),names[printLanguage]);
    assert.equal(await page.locator('#status').innerText(),messages[expected].cardsReady.replace('{count}','3').replace('{language}',printLanguage.toUpperCase()));
    const before=await page.locator('#preview img').getAttribute('src');
    for(const uiLanguage of ['en','it','de','es','fr']){
     await page.locator(`[data-ui-language=${uiLanguage}]`).click();
     assert.equal(await page.locator('#generate').innerText(),messages[uiLanguage].generate);
     assert.equal(await page.locator('#download').innerText(),messages[uiLanguage].download);
     assert.equal(await page.locator('#preview button').innerText(),messages[uiLanguage].editCard);
     assert.equal(await page.locator('#language').inputValue(),printLanguage);
     assert.equal(await page.locator('#preview img').getAttribute('src'),before);
     assert.equal(await page.locator('#download').isDisabled(),false);
    }
    await page.locator(`[data-ui-language=${expected}]`).click();
   }
   const preview=await page.locator('.preview-section').boundingBox(),download=await page.locator('#download').boundingBox();
   assert.ok(preview.y+preview.height<=download.y,'Print preview must be above the PDF download');
   const pending=page.waitForEvent('download');await page.locator('#download').click();const pdf=await pending;
   assert.equal((await fs.readFile(await pdf.path())).subarray(0,5).toString(),'%PDF-');
   await page.locator('[data-ui-language=de]').click();
   await page.locator('#preview button').click();await page.locator('#edit-name').fill('Edited name');
   assert.equal(await page.locator('#edit-name').inputValue(),'Edited name');
   assert.equal(await page.locator('#edit-attribute option:checked').innerText(),dict.attributes.dark.de);
   assert.equal(await page.locator('#language').inputValue(),'fr');
   assert.equal(await page.locator('#edit-layout').inputValue(),'Normal');
   await page.locator('#apply-edit').click();await page.locator('#editor').waitFor({state:'hidden'});
   assert.equal(await page.locator('#preview img').getAttribute('alt'),'Edited name');
   assert.equal(await page.locator('#language').inputValue(),'fr');
   await page.locator('#generate').click();await ready(page);
   await page.locator(`[data-ui-language=${expected}]`).click();
   await page.screenshot({path:`docs/validation/multi5/ui-${expected}-desktop.png`,fullPage:true});
   await page.setViewportSize({width:390,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile page overflows');
   await page.screenshot({path:`docs/validation/multi5/ui-${expected}-mobile.png`,fullPage:true});
   await page.setViewportSize({width:320,height:740});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Small mobile page overflows');
   await page.locator('#decklist_input').fill('0 Dark Magician');await page.locator('#generate').click();await ready(page);
   assert.equal(await page.locator('#status').innerText(),messages[expected]['error.row'].replace('{line}','1').replace('{message}',messages[expected]['error.invalidQuantity']));
   await page.locator('[data-ui-language=es]').click();assert.match(await page.locator('#status').innerText(),/^Línea 1:/);
   await page.reload();await ready(page);assert.equal(await page.locator('html').getAttribute('lang'),'es');assert.equal(await page.locator('#language').inputValue(),'it');
   await page.close();console.log(`${locale}: browser default, independent UI/print matrix, editor, errors, PDF and mobile passed`);
  }
  // Non-sample card: request only the chosen API translation, never Spanish.
  const page=await browser.newPage({locale:'es-ES'});page.on('pageerror',e=>errors.push(e.message));
  const remote=JSON.parse(await fs.readFile('tests/fixtures/remote-cards.json','utf8'));
  const translations=JSON.parse(await fs.readFile('tests/fixtures/remote-translations.json','utf8')),calls=[];
  await page.route('https://db.ygoprodeck.com/**',route=>{
   const u=new URL(route.request().url()),lang=u.searchParams.get('language')||'en';calls.push(lang);
   const card=lang==='en'?remote.en.find(c=>c.id===31924889):translations[lang];
   return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},status:card?200:400,json:card?{data:[card]}:{error:'Not found'}});
  });
  await page.route('**/api/artwork/*.jpg',async route=>route.fulfill({body:await fs.readFile('app/assets/artwork/46986414.jpg'),contentType:'image/jpeg'}));
  await page.goto('http://127.0.0.1:8765/');await ready(page);
  for(const lang of ['de','fr']){
   await page.locator('#language').selectOption(lang);await page.locator('#decklist_input').fill('1 Arcanite Magician');await page.locator('#generate').click();await ready(page);
   assert.equal(await page.locator('#preview img').getAttribute('alt'),translations[lang].name);assert.match(await page.locator('#status').innerText(),/^1 cartas listas/);
  }
  assert.deepEqual(calls,['en','de','fr']);await page.close();assert.deepEqual(errors,[]);
  console.log('Remote DE/FR translation selection passed; Spanish remains UI-only and project controls stay hidden.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
