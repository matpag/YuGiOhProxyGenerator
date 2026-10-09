const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const deck='3 Dark Magician\n1 Arcanite Magician\n1 Dark Hole\n1 Mirror Force';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[],directImages=[],relays=[];
  page.on('pageerror',e=>errors.push(e.message));
  const fixture=JSON.parse(await fs.readFile('tests/fixtures/remote-cards.json','utf8'));
  const jpeg=await fs.readFile('app/assets/artwork/46986414.jpg');
  // Real saved API responses; a CDN without CORS is represented by blocked browser requests.
  await page.route('https://db.ygoprodeck.com/**',route=>{
   const u=new URL(route.request().url()),language=u.searchParams.get('language')||'en';
   const card=fixture[language].find(c=>u.searchParams.get('id')===String(c.id)||u.searchParams.get('name')===c.name);
   return route.fulfill({status:card?200:400,json:card?{data:[card]}:{error:'Card not found'}});
  });
  await page.route('https://images.ygoprodeck.com/**',route=>{directImages.push(route.request().url());return route.abort();});
  await page.route('**/api/artwork/*.jpg',route=>{relays.push(route.request().url());return route.fulfill({contentType:'image/jpeg',body:jpeg});});
  await page.goto('http://127.0.0.1:8765/html/index.html');await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.locator('#decklist_input').fill(deck);await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert.match(await page.locator('#status').innerText(),/6 carte pronte in IT/,`Exact reported deck failed: ${await page.locator('#status').innerText()}`);
  assert.equal(await page.locator('#preview figure').count(),4);assert.deepEqual(directImages,[]);
  assert.deepEqual(relays.map(u=>new URL(u).pathname).sort(),['/api/artwork/31924889.jpg','/api/artwork/53129443.jpg']);
  const download=page.waitForEvent('download');await page.locator('#download').click();
  await fs.mkdir('_upstream/research/remote-artwork',{recursive:true});await (await download).saveAs('_upstream/research/remote-artwork/replayed-deck-it.pdf');
  // A reload drops memory caches; persistent metadata and artwork must still work without network.
  await page.unroute('https://db.ygoprodeck.com/**');await page.unroute('**/api/artwork/*.jpg');
  await page.route('https://db.ygoprodeck.com/**',route=>route.abort());await page.route('**/api/artwork/*.jpg',route=>route.abort());
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.locator('#decklist_input').fill(deck);await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert.match(await page.locator('#status').innerText(),/6 carte pronte in IT/);
  // Failed relay responses identify the line/card and must never enter Cache Storage.
  await page.evaluate(async()=>{await caches.delete('proxy-artwork-v1')});
  await page.unroute('**/api/artwork/*.jpg');await page.route('**/api/artwork/*.jpg',route=>route.fulfill({status:502,json:{error:'Servizio illustrazioni non disponibile. Riprova.'}}));
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.locator('#decklist_input').fill('1 Arcanite Magician');await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert.match(await page.locator('#status').innerText(),/Riga 1 \(Arcanite Magician\): Servizio illustrazioni/);
  assert.equal(await page.locator('#download').isDisabled(),true);
  assert.equal(await page.evaluate(async()=>Boolean(await(await caches.open('proxy-artwork-v1')).match('/cached-artwork/31924889'))),false);
  assert.deepEqual(errors,[]);
  console.log('Exact six-card deck, four Italian previews, PDF, offline reload and relay failure handling passed without direct CDN fetches.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
