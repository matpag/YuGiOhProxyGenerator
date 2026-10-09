const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const origin='https://static-proxy.test',prefix='/YuGiOhProxyGenerator/';
const deck='3 Dark Magician\n1 Arcanite Magician\n1 Dark Hole\n1 Mirror Force';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.otf':'font/otf','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({locale:'it-IT'}),errors=[],direct=[],relays=[],proxyCalls=[];
  const fixture=JSON.parse(await fs.readFile('tests/fixtures/remote-cards.json','utf8'));
  // A tiny substitute image keeps the replay deterministic; real pixels are checked separately.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
  let offline=false,proxyUnavailable=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(origin+'/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname.includes('/api/artwork/'))relays.push(pathname);
   const root=path.resolve('app'),file=path.resolve(root,pathname.slice(prefix.length)||'index.html');
   if(!pathname.startsWith(prefix)||!file.startsWith(root+path.sep))return route.fulfill({status:404});
   try{return await route.fulfill({body:await fs.readFile(file),contentType:mime[path.extname(file)]||'application/octet-stream'});}
   catch{return route.fulfill({status:404});}
  });
  await page.route('https://db.ygoprodeck.com/**',route=>{
   if(offline)return route.abort();
   const u=new URL(route.request().url()),lang=u.searchParams.get('language')||'en';
   const card=fixture[lang].find(c=>u.searchParams.get('id')===String(c.id)||u.searchParams.get('name')===c.name);
   return route.fulfill({status:card?200:400,headers:{'Access-Control-Allow-Origin':'*'},json:card?{data:[card]}:{error:'Card not found'}});
  });
  await page.route('https://images.ygoprodeck.com/**',route=>{direct.push(route.request().url());return route.abort();});
  await page.route('https://wsrv.nl/**',route=>{
   proxyCalls.push(route.request().url());
   if(offline)return route.abort();
   if(proxyUnavailable)return route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},body:'Unavailable'});
   return route.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:png});
  });
  const ready=()=>page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  const generate=async text=>{await page.locator('#decklist_input').fill(text);await page.locator('#generate').click();await ready();return page.locator('#status').innerText();};
  await page.goto(origin+prefix);await ready();
  assert.match(await generate('1 Dark Hole'),/1 carte pronte in IT/,'Reported Dark Hole input failed on a static origin');
  assert.match(await page.locator('#preview').innerText(),/Buco Nero/);
  assert.equal(await page.locator('#preview img').first().evaluate(img=>img.naturalWidth),697);
  assert.match(await generate(deck),/6 carte pronte in IT/);assert.equal(await page.locator('#preview figure').count(),4);
  assert.deepEqual(direct,[]);assert.deepEqual(relays,[]);
  assert.deepEqual(proxyCalls.map(url=>{
   const u=new URL(url);assert.equal(u.searchParams.get('output'),'png');assert.equal([...u.searchParams].length,2);
   return u.searchParams.get('url');
  }).sort(),['https://images.ygoprodeck.com/images/cards_cropped/31924889.jpg','https://images.ygoprodeck.com/images/cards_cropped/53129443.jpg']);
  const download=page.waitForEvent('download');await page.locator('#download').click();
  assert.equal((await fs.readFile(await(await download).path())).subarray(0,5).toString(),'%PDF-');
  offline=true;const calls=proxyCalls.length;await page.reload();await ready();
  assert.match(await generate(deck),/6 carte pronte in IT/);assert.equal(proxyCalls.length,calls);
  // Clear only artwork, then check failure and retry after a reload clears the render cache.
  await page.evaluate(()=>caches.delete('proxy-artwork-v1'));
  offline=false;proxyUnavailable=true;await page.reload();await ready();
  assert.match(await generate('1 Dark Hole'),/Riga 1 \(Dark Hole\): Illustrazione 53129443 non disponibile/);
  assert.equal(await page.locator('#download').isDisabled(),true);
  assert.equal(await page.evaluate(async()=>Boolean(await(await caches.open('proxy-artwork-v1')).match('/YuGiOhProxyGenerator/cached-artwork/53129443'))),false);
  proxyUnavailable=false;assert.match(await generate('1 Dark Hole'),/1 carte pronte in IT/);
  await page.locator('#language').selectOption('en');assert.match(await generate('1 Dark Hole'),/1 carte pronte in EN/);
  assert.match(await page.locator('#preview').innerText(),/Dark Hole/);assert.deepEqual(errors,[]);
  console.log('Static origin: Dark Hole EN/IT, six-card deck, PNG/PDF, offline cache, service failure and retry passed without CDN or local relay requests.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
