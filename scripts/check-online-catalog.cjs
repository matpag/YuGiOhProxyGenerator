// Exercise the real production repository: no preinstalled catalog or test helper.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const url=process.env.APP_URL||'http://127.0.0.1:8765/';
const live=process.env.LIVE_API==='1',directory='docs/validation/catalog-network/'+(live?'live':'replay');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({locale:'it-IT',viewport:{width:320,height:740},isMobile:true,hasTouch:true}),errors=[],calls=[],images=[],bundled=[];
  const messages=JSON.parse(await fs.readFile('app/dictionaries/ui.json','utf8')).messages;
  const records=Object.fromEntries(await Promise.all(['en','it','de','fr'].map(async language=>[language,JSON.parse(await fs.readFile('tests/fixtures/cards-'+language+'.json','utf8'))])));
  let online=false;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/\/(fixtures\/|text-overrides\/|assets\/(artwork|reference)\/)/.test(new URL(request.url()).pathname))bundled.push(request.url());});
  await page.route('https://db.ygoprodeck.com/api/v7/cardinfo.php?**',async route=>{
   const request=new URL(route.request().url()),language=request.searchParams.get('language')||'en';
   calls.push({language,name:request.searchParams.get('name'),id:request.searchParams.get('id'),online});
   if(!online)return route.abort();
   if(live)return route.continue();
   const card=records[language].find(card=>request.searchParams.has('id')?Number(request.searchParams.get('id'))===card.id:card.name===request.searchParams.get('name'));
   return route.fulfill({status:card?200:400,json:card?{data:[card]}:{error:'Card not found'},headers:{'Access-Control-Allow-Origin':'*'}});
  });
  const image=async(route,id)=>{
   images.push({id,online});if(!online)return route.abort();if(live)return route.continue();
   return route.fulfill({contentType:'image/jpeg',body:await fs.readFile('tests/fixtures/artwork/'+id+'.jpg'),headers:{'Access-Control-Allow-Origin':'*'}});
  };
  await page.route('**/api/artwork/*.jpg',route=>image(route,new URL(route.request().url()).pathname.match(/(\d+)\.jpg$/)[1]));
  await page.route('https://wsrv.nl/**',route=>image(route,new URL(route.request().url()).searchParams.get('url').match(/(\d+)\.jpg$/)[1]));
  await page.goto(url);const ready=()=>page.waitForFunction(()=>!document.querySelector('#generate').disabled);await ready();
  assert.equal(calls.length,0,'Startup must not preload a card catalog');
  for(const language of ['en','it','de','es','fr']){
   await page.locator('[data-ui-language='+language+']').click();
   assert.equal(await page.locator('[data-i18n=helpLayouts]').textContent(),messages[language].helpLayouts);
   assert.ok(!/offline|senza rete|sin conexión|hors ligne/.test(messages[language].helpLayouts));
  }
  await page.locator('[data-ui-language=it]').click();
  const generate=async list=>{await page.locator('#decklist_input').fill(list);await page.locator('#generate').click();await ready();return page.locator('#status').innerText();};
  assert.match(await generate('1 Dark Magician'),/Riga 1 \(Dark Magician\): Servizio dati non disponibile/);
  assert.equal(calls.length,1);assert.equal(await page.locator('#download').isDisabled(),true);
  online=true;const deck='1 Dark Magician\n1 Pot of Greed\n1 Mirror Force';
  assert.match(await generate(deck),/3 carte pronte in EN/);assert.equal(await page.locator('#preview img').count(),3);
  await page.locator('#language').selectOption('it');
  assert.match(await generate('1 Dark Magician'),/1 carte pronte in IT/);
  assert.equal(await page.locator('#preview img').getAttribute('alt'),'Mago Nero');
  assert.deepEqual(calls.filter(call=>call.online).map(call=>call.language),['en','en','en','it']);
  const before=await page.locator('#preview img').getAttribute('src'),count=calls.length;
  await page.locator('[data-ui-language=fr]').click();assert.equal(await page.locator('#preview img').getAttribute('src'),before);assert.equal(calls.length,count);
  await page.locator('[data-ui-language=it]').click();await page.locator('#language').selectOption('en');assert.match(await generate(deck),/3 carte pronte in EN/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await fs.mkdir(directory,{recursive:true});const pending=page.waitForEvent('download');await page.locator('#download').click();await(await pending).saveAs(path.join(directory,'deck-en.pdf'));await ready();
  // Keep downloaded-cache reuse, while a fresh unvisited example still needs API access.
  online=false;const requests=calls.length,artworks=images.length;await page.reload();await ready();
  assert.match(await generate(deck),/3 carte pronte in EN/);assert.equal(calls.length,requests);assert.equal(images.length,artworks);
  assert.match(await generate('1 Blue-Eyes White Dragon'),/Riga 1 \(Blue-Eyes White Dragon\): Servizio dati non disponibile/);
  assert.equal(await page.locator('#download').isDisabled(),true);
  assert.deepEqual(bundled,[]);assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(directory,'requests.json'),JSON.stringify({live,calls,images,bundled,errors},null,2)+'\n');
  console.log((live?'Live YGOProDeck':'Recorded API')+': fresh examples require network; selected print translation only; mobile previews/PDF; downloaded-cache reuse; no bundled samples or startup catalog.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
