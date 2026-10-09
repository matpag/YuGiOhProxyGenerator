const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,channel:'msedge'}),p=await b.newPage();
 await p.goto('http://127.0.0.1:8765/html/index.html');await p.waitForFunction(()=>!document.getElementById('generate').disabled);
 await p.locator('#generate').click();await p.waitForFunction(()=>!document.getElementById('generate').disabled);
 await p.getByRole('button',{name:'Modifica carta',exact:true}).click();
 await p.locator('#edit-artwork').setInputFiles('app/assets/artwork/70095154.jpg');await p.waitForFunction(()=>!document.getElementById('apply-edit').disabled);
 await p.locator('#apply-edit').click();await p.locator('#editor').waitFor({state:'hidden'});assert.equal(await p.locator('#download').isDisabled(),false);
 await p.locator('#decklist_input').fill('Some Missing Card');
 await p.route('https://db.ygoprodeck.com/**',route=>new Promise(resolve=>setTimeout(()=>{route.abort().catch(()=>{});resolve()},2500)));
 await p.locator('#generate').click();await p.locator('#cancel').click();await p.waitForFunction(()=>!document.getElementById('generate').disabled);
 assert.match(await p.locator('#status').innerText(),/annullata/);assert.equal(await p.locator('#download').isDisabled(),true);
 await b.close();console.log('Custom artwork and cancellation checks passed.');
})().catch(e=>{console.error(e);process.exit(1)})
