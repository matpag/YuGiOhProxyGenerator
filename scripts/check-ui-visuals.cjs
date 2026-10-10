const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const phase=process.argv[2]||'after';
const directory=path.resolve('docs/validation/state-refactor',phase);
const ready=page=>page.waitForFunction(()=>!document.querySelector('#generate').disabled);
const samples=[];
async function capture(page,name){
 await page.evaluate(async()=>{
  await document.fonts.ready;
  document.activeElement?.blur();
  for(const image of document.querySelectorAll('img')){
   image.loading='eager';
   if(image.getAttribute('src'))await image.decode().catch(()=>{});
  }
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:path.join(directory,name+'.png'),fullPage:true,animations:'disabled',caret:'hide'});
 const snapshot=await page.evaluate(async()=>{
  const selectors=['header','.workspace','.howto','.decklist','.settings','.preview-section','#download-actions','footer','#editor','#editor-form','#monster-fields','#pendulum-fields'];
  const geometry=Object.fromEntries(selectors.map(selector=>{
   const element=document.querySelector(selector),rect=element.getBoundingClientRect();
   return [selector,{x:rect.x,y:rect.y,width:rect.width,height:rect.height,visible:Boolean(rect.width&&rect.height)}];
  }));
  const controls=Object.fromEntries(['generate','cancel','download','save-project','language','decklist_input','apply-edit'].map(id=>{
   const element=document.getElementById(id);return [id,{disabled:element.disabled||false,hidden:element.hidden,readOnly:element.readOnly||false}];
  }));
  const cards=await Promise.all([...document.querySelectorAll('#preview img')].map(async image=>{
   const data=await (await fetch(image.src)).arrayBuffer();
   const digest=await crypto.subtle.digest('SHA-256',data);
   return {name:image.alt,hash:[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')};
  }));
  return {geometry,controls,cards,status:document.getElementById('status').textContent,printSummary:document.getElementById('print-summary').textContent,previewSummary:document.getElementById('preview-summary').textContent,uiLanguage:document.documentElement.lang,printLanguage:document.getElementById('language').value,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.equal(snapshot.overflow,false,name+' must fit the viewport');
 samples.push({name,...snapshot});
}
(async()=>{
 await fs.mkdir(directory,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge',args:process.env.VISUAL_DISABLE_GPU?['--disable-gpu']:[]}),errors=[];
 try{
  for(const [width,height] of [[1440,1000],[390,844],[320,740],[740,320]]){
   const page=await browser.newPage({locale:'it-IT',viewport:{width,height},isMobile:width<761,hasTouch:width<761});
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('https://**/*',route=>route.abort());
   await page.goto(process.env.APP_URL||'http://127.0.0.1:8765/');await ready(page);
   for(const language of ['it','en','de','es','fr']){
    await page.locator('[data-ui-language='+language+']').click();await capture(page,'initial-'+width+'-'+language);
   }
   await page.locator('[data-ui-language=it]').click();
   await page.locator('.howto').evaluate(element=>element.open=true);await capture(page,'help-'+width);
   await page.locator('.howto').evaluate(element=>element.open=false);
   await page.locator('#language').selectOption('it');
   await page.locator('#decklist_input').fill('1 Pot of Greed\n1 Decode Talker\n10 Dark Magician');
   await page.locator('#generate').click();await ready(page);
   assert.equal(await page.locator('#preview figure').count(),3);await capture(page,'cards-'+width);
   await page.locator('#view-pages').click();await capture(page,'pages-'+width);
   await page.locator('#next-page').click();await capture(page,'page2-'+width);
   await page.locator('#view-cards').click();
   await page.locator('#preview button').nth(2).click();await capture(page,'editor-monster-'+width);
   await page.locator('#close-editor').click();
   await page.locator('#preview button').first().click();await capture(page,'editor-spell-'+width);
   await page.locator('#close-editor').click();
   await page.locator('#preview button').nth(1).click();await capture(page,'editor-link-'+width);
   await page.locator('#close-editor').click();
   await page.locator('.advanced').evaluate(element=>element.open=true);
   await page.locator('#margin_document').fill('300');await capture(page,'invalid-layout-'+width);
   await page.locator('#margin_document').fill('7');await page.locator('.advanced').evaluate(element=>element.open=false);
   await page.locator('#decklist_input').fill('1 Dark Magician');await capture(page,'stale-'+width);
   await page.locator('#decklist_input').fill('0 Dark Magician');
   await page.locator('#generate').click();await ready(page);await capture(page,'error-'+width);
   await page.close();
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(directory,'snapshots.json'),JSON.stringify(samples,null,2)+'\n');
  if(phase==='after'||phase==='after-software'){
   const baseline=JSON.parse(await fs.readFile(path.resolve('docs/validation/state-refactor',phase==='after-software'?'before-software':'before','snapshots.json'),'utf8'));
   assert.deepEqual(samples,baseline,'UI geometry, controls, messages and rendered card pixels must match the baseline');
  }
  console.log(samples.length+' visual scenarios captured in '+directory+'; UI, controls and card pixels '+(phase.startsWith('after')?'match the baseline':'recorded before refactoring')+'.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
