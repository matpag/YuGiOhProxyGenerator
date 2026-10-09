const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  await page.goto('http://127.0.0.1:8765/html/index.html');await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  const profile=JSON.parse(await fs.readFile('docs/research/evidence/frame-color-profile.json','utf8'));
  const result=await page.evaluate(async({profile})=>{
   const {normalizeCard}=await import('/js/model/card.js'),{localizeCard}=await import('/js/localization/resolve.js'),{renderCard}=await import('/js/rendering/cardmaker.js');
   const [en,it,dictionary,overrides]=await Promise.all(['/fixtures/cards-en.json','/fixtures/cards-it.json','/dictionaries/tcg.json','/text-overrides/cards.json'].map(async u=>(await fetch(u)).json()));
   window.require.config({baseUrl:'/vendor/cardmaker/src'});
   const frameColor=await new Promise((resolve,reject)=>window.require(['tcg/ygo/FrameColor'],resolve,reject));
   const calibratedFilter=frameColor.filter;
   const drawImage=CanvasRenderingContext2D.prototype.drawImage,fillText=CanvasRenderingContext2D.prototype.fillText;
   const leaked=[];CanvasRenderingContext2D.prototype.drawImage=function(img,...args){if(this.filter!=='none'&&!img.src?.includes('/border/'))leaked.push({type:'image',filter:this.filter});return drawImage.call(this,img,...args);};
   CanvasRenderingContext2D.prototype.fillText=function(...args){if(this.filter!=='none')leaked.push({type:'text',filter:this.filter});return fillText.call(this,...args);};
   const pixels=async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=697;c.height=1016;c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.getContext('2d').getImageData(0,0,c.width,c.height).data;};
   const encoded=render=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([render.pngBytes],{type:'image/png'}));});
   const output=[];const scale=1016/614,ox=(697-421*scale)/2;
   const regions=profile.filter_regions.map(([x,y,w,h])=>[x*scale+ox-1,y*scale-1,(x+w)*scale+ox+1,(y+h)*scale+1]);
   try{
    for(const raw of en)for(const language of ['en','it']){
     const card=localizeCard(normalizeCard(raw,it.find(c=>c.id===raw.id)),language,dictionary,overrides);
     // Warm image decoding so both controls have identical resource timing.
     if(language==='en')await renderCard({...card,colorValidationWarmup:true});
     let baseline;frameColor.filter=()=>null;
     try{baseline=await renderCard({...card,colorValidationBaseline:true});}finally{frameColor.filter=calibratedFilter;}
     const render=await renderCard(card);
     const a=await pixels(render.url),b=await pixels(baseline.url);let changed=0,outside=0,maxOutside=0;const examples=[];
     for(let y=0;y<1016;y++)for(let x=0;x<697;x++){const k=(y*697+x)*4;let diff=0;for(let n=0;n<4;n++)diff=Math.max(diff,Math.abs(a[k+n]-b[k+n]));if(!diff)continue;changed++;if(!regions.some(([x1,y1,x2,y2])=>x>=x1&&x<=x2&&y>=y1&&y<=y2)){outside++;maxOutside=Math.max(diff,maxOutside);if(examples.length<3)examples.push({x,y,diff,a:Array.from(a.slice(k,k+4)),b:Array.from(b.slice(k,k+4))});}}
     output.push({id:card.passcode,language,layout:card.layout,pendulum:card.scale!==null,changedPixels:changed,outsidePixels:outside,maxOutside,examples,diagnostics:render.diagnostics,png:await encoded(render),beforePng:language==='en'?await encoded(baseline):null});
    }
   }finally{CanvasRenderingContext2D.prototype.drawImage=drawImage;CanvasRenderingContext2D.prototype.fillText=fillText;}
   return {samples:output,leaked};
  },{profile});
  assert.deepEqual(errors,[]);assert.deepEqual(result.leaked,[]);assert.equal(result.samples.length,22);
  await fs.mkdir('docs/validation/frame-colors/after',{recursive:true});
  await fs.mkdir('docs/validation/frame-colors/before',{recursive:true});
  for(const s of result.samples){
   assert.deepEqual(s.diagnostics,[]);assert.equal(s.outsidePixels,0,`Filter escaped frame mask: ${s.id} ${s.language}`);
   const adjusted=profile.brightness[s.layout]&&!s.pendulum;
   assert.ok(adjusted?s.changedPixels>10000:s.changedPixels===0,`Unexpected correction: ${s.layout} ${s.pendulum}`);
   await fs.writeFile(`docs/validation/frame-colors/after/${s.id}-${s.language}.png`,Buffer.from(s.png,'base64'));delete s.png;
   if(s.beforePng)await fs.writeFile(`docs/validation/frame-colors/before/${s.id}-en.png`,Buffer.from(s.beforePng,'base64'));delete s.beforePng;
  }
  await fs.writeFile('docs/validation/frame-colors/pixel-checks.json',JSON.stringify(result,null,2)+'\n');
  console.log('22 EN/IT cards: correction stays inside the colored frame; artwork, text panels and other frames are pixel-identical. Filters never leak to text or icons.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
