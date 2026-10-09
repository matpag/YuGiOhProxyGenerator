const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({locale:'it-IT'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/');await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.route('https://**/*',route=>route.abort());
  const result=await page.evaluate(async()=>{
   const {normalizeCard}=await import('/js/model/card.js'),{localizeCard}=await import('/js/localization/resolve.js'),{renderCard}=await import('/js/rendering/cardmaker.js');
   const [en,de,fr,dictionary]=await Promise.all(['/fixtures/cards-en.json','/fixtures/cards-de.json','/fixtures/cards-fr.json','/dictionaries/tcg.json'].map(async url=>(await fetch(url)).json()));
   const output=[];
   for(const [language,translations] of [['de',de],['fr',fr]])for(const raw of en){
    try{
     const card=localizeCard(normalizeCard(raw,translations.find(c=>c.id===raw.id),language),language,dictionary);
     const render=await renderCard(card);
     const img=new Image();img.src=render.url;await img.decode();const canvas=document.createElement('canvas');canvas.width=render.width;canvas.height=render.height;canvas.getContext('2d').drawImage(img,0,0);
     output.push({language,id:raw.id,name:card.text.name,layout:card.layout,width:render.width,height:render.height,diagnostics:render.diagnostics,png:canvas.toDataURL('image/png').split(',')[1]});
    }catch(e){output.push({language,id:raw.id,error:e.message});}
   }
   return output;
  });
  const dir='docs/validation/multi5/cards';await fs.mkdir(dir,{recursive:true});
  for(const r of result){
   if(r.id===16178681)assert.match(r.error,/pendulumEffect non tradotta/);
   else{assert.equal(r.error,undefined,JSON.stringify(r));assert.equal(r.width,697);assert.equal(r.height,1016);await fs.writeFile(`${dir}/${r.id}-${r.language}.png`,Buffer.from(r.png,'base64'));delete r.png;}
  }
  assert.equal(result.filter(r=>!r.error).length,20);assert.deepEqual(errors,[]);
  await fs.writeFile(dir+'/results.json',JSON.stringify(result,null,2)+'\n');
  console.log('20 DE/FR sample PNGs passed offline across supported layouts; untranslated API Pendulum sections correctly rejected.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
