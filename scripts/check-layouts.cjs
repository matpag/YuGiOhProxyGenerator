const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');const assert=require('node:assert/strict');
const validationDirectory=process.env.PROXY_VALIDATION_DIR||'docs/validation/phase-5';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({locale:'it-IT',viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});page.on('console',m=>{if(m.text().startsWith('SAMPLE'))console.log(m.text())});
 await fs.mkdir(validationDirectory,{recursive:true});
 await page.goto('http://127.0.0.1:8765/html/index.html');await page.waitForFunction(()=>!document.getElementById('generate').disabled);
 await page.route('https://**/*',route=>route.abort());
 const result=await page.evaluate(async()=>{
   const {normalizeCard}=await import('/js/model/card.js'),{localizeCard}=await import('/js/localization/resolve.js'),{renderCard}=await import('/js/rendering/cardmaker.js');
   const [en,it,dictionary,overrides]=await Promise.all(['/fixtures/cards-en.json','/fixtures/cards-it.json','/dictionaries/tcg.json','/text-overrides/cards.json'].map(async u=>(await fetch(u)).json()));
   const output=[];
   for(const raw of en){
     const model=normalizeCard(raw,it.find(c=>c.id===raw.id));
     for(const lang of ['en','it']){
       try{
         console.log('SAMPLE start',model.passcode,lang);const card=localizeCard(model,lang,dictionary,overrides),render=await renderCard(card);console.log('SAMPLE done',model.passcode,lang);
         const img=new Image();img.src=render.url;await img.decode();const c=document.createElement('canvas');c.width=render.width;c.height=render.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let colored=0,total=0;
         for(let i=0;i<data.length;i+=400){total++;if(Math.min(data[i],data[i+1],data[i+2])<220)colored++;}
         output.push({id:card.passcode,language:lang,name:card.text.name,layout:card.layout,coverage:colored/total,diagnostics:render.diagnostics,png:c.toDataURL('image/png').split(',')[1]});
       }catch(error){output.push({id:model.passcode,language:lang,error:error.message});}
     }
   }return output;
 });
 for(const r of result){
   console.log(r.id,r.language,r.layout||'',r.error||r.coverage,r.diagnostics?.length||0);
   if(r.png){await fs.writeFile(`${validationDirectory}/${r.id}-${r.language}.png`,Buffer.from(r.png,'base64'));delete r.png;}
 }
 await fs.writeFile(`${validationDirectory}/results.json`,JSON.stringify(result,null,2));
 assert.equal(result.length,22);assert.ok(result.every(r=>!r.error&&r.coverage>(r.layout==='Synchro'?.6:.7)));assert.deepEqual(errors,[]);
 await page.locator('#decklist_input').fill('3 Cyber Dragon\n2 Pot of Greed\n2 Mirror Force\n1 Number 39: Utopia\n1 Decode Talker\n1 Odd-Eyes Pendulum Dragon\n1 Stardust Dragon');
 await page.locator('#generate').click();await page.waitForFunction(()=>!document.getElementById('generate').disabled);
 assert.match(await page.locator('#status').innerText(),/11 carte pronte/);
 await page.screenshot({path:`${validationDirectory}/mixed-deck.png`,fullPage:true});
 const pending=page.waitForEvent('download');await page.locator('#download').click();await (await pending).saveAs(`${validationDirectory}/mixed-deck-it.pdf`);
 await browser.close();console.log('All 22 sample renders and mixed-layout PDF passed offline.');
})().catch(e=>{console.error(e);process.exit(1)})
