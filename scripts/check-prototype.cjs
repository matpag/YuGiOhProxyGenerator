const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({locale:'it-IT',viewport:{width:1280,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await fs.mkdir('docs/validation/phase-3',{recursive:true});
 await page.goto('http://127.0.0.1:8765/html/index.html');
 await page.locator('#generate').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.getElementById('generate').disabled);
 for(const lang of ['en','it']){
   await page.locator('#language').selectOption(lang);await page.locator('#decklist_input').fill('12 46986414');
   await page.locator('#generate').click();
   await page.waitForFunction(()=>!document.getElementById('generate').disabled);
   const status=await page.locator('#status').innerText();console.log(lang,status);
   assert.match(status,/12 carte pronte/);
   const coverage=await page.locator('#preview img').evaluate(async img=>{
     await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let color=0,total=0;
     for(let i=0;i<data.length;i+=400){total++;if(Math.min(data[i],data[i+1],data[i+2])<220)color++;}return color/total;
   });assert.ok(coverage>.8,`Incomplete canvas in ${lang}: ${coverage}`);
   const bytes=await page.locator('#preview img').evaluate(async img=>Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())));
   await fs.writeFile(`docs/validation/phase-3/dark-magician-${lang}.png`,Buffer.from(bytes));
   await page.screenshot({path:`docs/validation/phase-3/ui-${lang}.png`,fullPage:true});
   const pending=page.waitForEvent('download',{timeout:15000});await page.locator('#download').click();
   const download=await pending;await download.saveAs(`docs/validation/phase-3/12-cards-${lang}.pdf`);
 }
 await page.route('https://**/*',route=>route.abort());
 await page.locator('#generate').click();await page.waitForFunction(()=>!document.getElementById('generate').disabled);
 assert.match(await page.locator('#status').innerText(),/12 carte pronte/);
 await page.locator('#decklist_input').fill('3 46986414\n0 46986414');await page.locator('#generate').click();
 await page.waitForFunction(()=>!document.getElementById('generate').disabled);
 assert.equal(await page.locator('#download').isDisabled(),true);assert.match(await page.locator('#status').innerText(),/Riga 2/);
 assert.deepEqual(errors,[]);
 console.log('EN/IT PNG, PDF, offline export preparation and invalid-input checks passed.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

