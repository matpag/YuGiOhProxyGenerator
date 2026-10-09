const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1280,height:900}});
 await fs.mkdir('docs/validation/phase-6',{recursive:true});
 await page.goto('http://127.0.0.1:8765/html/index.html');await page.waitForFunction(()=>!document.getElementById('generate').disabled);
 await page.locator('#generate').click();await page.waitForFunction(()=>!document.getElementById('generate').disabled);
 await page.getByRole('button',{name:'Modifica carta',exact:true}).click();
 await page.locator('#edit-name').fill('Mago di prova');await page.locator('#edit-atk').fill('2600');
 await page.screenshot({path:'docs/validation/phase-6/editor.png'});
 await page.locator('#apply-edit').click();await page.locator('#editor').waitFor({state:'hidden'});
 assert.equal(await page.locator('#preview img').getAttribute('alt'),'Mago di prova');
 let pending=page.waitForEvent('download');await page.locator('#save-project').click();await (await pending).saveAs('docs/validation/phase-6/custom-project.json');
 await page.locator('#language').selectOption('en');assert.equal(await page.locator('#download').isDisabled(),true);
 await page.locator('#project-file').setInputFiles('docs/validation/phase-6/custom-project.json');
 await page.waitForFunction(()=>!document.getElementById('download').disabled);
 assert.equal(await page.locator('#language').inputValue(),'it');assert.equal(await page.locator('#preview img').getAttribute('alt'),'Mago di prova');
 pending=page.waitForEvent('download');await page.locator('#download').click();await (await pending).saveAs('docs/validation/phase-6/custom-project.pdf');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/validation/phase-6/mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await browser.close();console.log('Editing, JSON round-trip, PDF and mobile width checks passed.');
})().catch(e=>{console.error(e);process.exit(1)})
