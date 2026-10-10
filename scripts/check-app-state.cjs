const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const ready=page=>page.waitForFunction(()=>!document.querySelector('#generate').disabled);
const appOrigin=new URL(process.env.APP_URL||'http://127.0.0.1:8765/').origin;
const isolateRemote=route=>new URL(route.request().url()).origin===appOrigin?route.continue():route.abort();
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[];
 const messages=JSON.parse(await fs.readFile('app/dictionaries/ui.json','utf8')).messages;
 try{
  const page=await browser.newPage({locale:'it-IT',viewport:{width:390,height:844}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://**/*',isolateRemote);
  await page.goto(process.env.APP_URL||'http://127.0.0.1:8765/');await ready(page);
  assert.equal(await page.locator('#language').inputValue(),'en');
  const seen=deferred(),release=deferred(),settled=deferred();
  const remote=JSON.parse(await fs.readFile('tests/fixtures/remote-cards.json','utf8')).en.find(card=>card.id===31924889);
  await page.route('https://db.ygoprodeck.com/**',async route=>{
   seen.resolve();await release.promise;
   await route.fulfill({json:{data:[remote]}}).catch(()=>{});settled.resolve();
  });
  await page.locator('#decklist_input').fill('1 Arcanite Magician');await page.locator('#generate').click();await seen.promise;
  await page.locator('[data-ui-language=de]').click();
  assert.equal(await page.locator('#language').inputValue(),'en');assert.equal(await page.locator('#language').isDisabled(),true);
  assert.equal(await page.locator('#decklist_input').getAttribute('readonly'),'');assert.match(await page.locator('#status').innerText(),/wird vorbereitet/);
  await page.locator('#cancel').click();await ready(page);
  await page.locator('#decklist_input').fill('1 Dark Magician');await page.locator('#generate').click();await ready(page);
  const image=await page.locator('#preview img').getAttribute('src');release.resolve();await settled.promise;
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('1 Karten'));
  assert.equal(await page.locator('#preview img').getAttribute('src'),image);assert.equal(await page.locator('#download').isDisabled(),false);
  await page.locator('#decklist_input').fill('2 Dark Magician');assert.equal(await page.locator('#download').isDisabled(),true);
  await page.locator('#decklist_input').fill('1 Dark Magician');assert.equal(await page.locator('#download').isDisabled(),false);
  // Relabeling must retain the DOM node, keyboard focus and current sheet.
  await page.locator('#preview button').focus();const focused=await page.locator('#preview button').evaluate(element=>{window.originalEditButton=element;return true;});
  assert.ok(focused);
  await page.evaluate(()=>document.querySelector('[data-ui-language=fr]').click());
  assert.equal(await page.locator('#preview button').evaluate(element=>element===window.originalEditButton&&element===document.activeElement),true);
  await page.locator('#preview button').click();await page.locator('#edit-name').fill('Draft preserved');
  await page.locator('#edit-atk').fill('2700');await page.evaluate(()=>document.querySelector('[data-ui-language=es]').click());
  assert.equal(await page.locator('#edit-name').inputValue(),'Draft preserved');assert.equal(await page.locator('#edit-atk').inputValue(),'2700');
  assert.equal(await page.locator('#language').inputValue(),'en');await page.locator('#close-editor').click();
  await page.locator('#decklist_input').fill('12 Dark Magician');await page.locator('#generate').click();await ready(page);
  await page.locator('#view-pages').click();await page.locator('#next-page').click();const count=await page.locator('#paper-preview img').count();
  await page.locator('[data-ui-language=fr]').click();assert.equal(await page.locator('#paper-preview img').count(),count);assert.match(await page.locator('#page-number').innerText(),/2 sur 2/);
  await page.locator('#view-cards').click();await page.locator('#preview button').click();
  // A delayed upload must not be discarded when another draft field changes.
  await page.evaluate(()=>{
   const Original=window.FileReader;
   window.FileReader=class extends Original{readAsDataURL(blob){
    if(window.holdNextArtwork){window.holdNextArtwork=false;window.releaseArtwork=()=>super.readAsDataURL(blob);}
    else super.readAsDataURL(blob);
   }};
   window.holdNextArtwork=true;
  });
  await page.locator('#edit-artwork').setInputFiles('app/assets/artwork/70095154.jpg');
  assert.equal(await page.locator('#apply-edit').isDisabled(),true);await page.locator('#edit-name').fill('Artwork and text');
  await page.evaluate(()=>window.releaseArtwork());await page.waitForFunction(()=>!document.querySelector('#apply-edit').disabled);
  await page.locator('#apply-edit').click();await page.locator('#editor').waitFor({state:'hidden'});
  assert.equal(await page.locator('#preview img').getAttribute('alt'),'Artwork and text');
  // Exercise the retained project format to verify that the artwork really committed.
  await page.evaluate(()=>document.querySelector('#project-controls').hidden=false);
  const pending=page.waitForEvent('download');await page.locator('#save-project').click();
  const project=JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));
  assert.equal(project.items[0].artworkId,0);assert.ok(project.items[0].card.artworks[0].image_url_cropped.startsWith('data:image/jpeg;base64,'));
  // Closing an upload session must not affect a subsequently opened editor.
  await page.locator('#preview button').click();await page.evaluate(()=>window.holdNextArtwork=true);
  await page.locator('#edit-artwork').setInputFiles('app/assets/artwork/46986414.jpg');await page.locator('#close-editor').click();
  await page.locator('#preview button').click();await page.locator('#edit-name').fill('New session');await page.evaluate(()=>window.releaseArtwork());
  await page.waitForFunction(()=>!document.querySelector('#apply-edit').disabled);assert.equal(await page.locator('#edit-name').inputValue(),'New session');
  await page.locator('#close-editor').click();await page.evaluate(()=>document.querySelector('#project-controls').hidden=true);
  // Every public paper selector must reach the PDF export through shared state.
  await fs.mkdir('docs/validation/state-refactor',{recursive:true});
  for(const paper of ['A4','LETTER','A3']){
   await page.locator('#paper_size').selectOption(paper);
   const exported=page.waitForEvent('download');await page.locator('#download').click();
   const pdf=await exported;assert.equal(pdf.suggestedFilename(),'proxy-en.pdf');
   await pdf.saveAs('docs/validation/state-refactor/paper-'+paper+'.pdf');
   await page.waitForFunction(()=>!document.querySelector('#download').disabled);
  }
  // Errors retain their codes and row context through every UI translation.
  await page.locator('#decklist_input').fill('0 Dark Magician\n0 Dark Hole');await page.locator('#generate').click();await ready(page);
  for(const [language,prefix] of [['it','Riga'],['en','Line'],['de','Zeile'],['es','Línea'],['fr','Ligne']]){
   await page.locator('[data-ui-language='+language+']').click();
   const text=await page.locator('#status').innerText();assert.equal(text,[1,2].map(line=>messages[language]['error.row'].replace('{line}',line).replace('{message}',messages[language]['error.invalidQuantity'])).join('; '));
  }
  await page.reload();await ready(page);assert.equal(await page.locator('#language').inputValue(),'en');assert.equal(await page.locator('html').getAttribute('lang'),'fr');
  // Input/file/language changes made while repository initialization is pending survive readiness.
  const boot=await browser.newPage({locale:'it-IT'});boot.on('pageerror',error=>errors.push(error.message));
  const bootSeen=deferred(),bootRelease=deferred();
  await boot.route('https://**/*',isolateRemote);
  await boot.route('**/fixtures/cards-en.json',async route=>{
   bootSeen.resolve();await bootRelease.promise;await route.fulfill({contentType:'application/json',body:await fs.readFile('app/fixtures/cards-en.json')});
  });
  await boot.goto(process.env.APP_URL||'http://127.0.0.1:8765/');await bootSeen.promise;
  await boot.locator('#decklist_input').fill('1 Dark Hole');await boot.locator('#language').selectOption('it');
  await boot.locator('#file').setInputFiles({name:'startup.txt',mimeType:'text/plain',buffer:Buffer.from('2 Dark Magician')});
  await boot.waitForFunction(()=>document.querySelector('#decklist_input').value==='2 Dark Magician');
  assert.equal(await boot.locator('#generate').isDisabled(),true);bootRelease.resolve();await ready(boot);
  assert.equal(await boot.locator('#decklist_input').inputValue(),'2 Dark Magician');assert.equal(await boot.locator('#language').inputValue(),'it');
  await boot.locator('#generate').click();await ready(boot);assert.equal(await boot.locator('#preview img').getAttribute('alt'),'Mago Nero');await boot.close();
  // Startup failures remain visible and never enable incomplete generation.
  for(const [routePattern,expected] of [['**/dictionaries/ui.json','Interface translations unavailable'],['**/fixtures/cards-en.json',messages.it['error.network']]]){
   const broken=await browser.newPage({locale:'it-IT'});broken.on('pageerror',error=>errors.push(error.message));
   await broken.route('https://**/*',isolateRemote);await broken.route(routePattern,route=>route.fulfill({status:503,json:{}}));
   await broken.goto(process.env.APP_URL||'http://127.0.0.1:8765/');await broken.locator('#status.error').waitFor();
   assert.equal(await broken.locator('#generate').isDisabled(),true);assert.equal(await broken.locator('#status').innerText(),expected);await broken.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Async cancellation/replacement, source restoration, focus, editor drafts/uploads, sheet state, project artwork and structured multilingual errors and slow/failed startup passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
