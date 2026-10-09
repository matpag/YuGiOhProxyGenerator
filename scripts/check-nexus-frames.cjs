const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const manifest=JSON.parse(await fs.readFile('app/assets/templates/nexus/manifest.json','utf8'));
 for(const asset of manifest.assets)assert.equal(crypto.createHash('sha256').update(await fs.readFile(asset.file)).digest('hex'),asset.sha256);
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  await page.goto('http://127.0.0.1:8765/html/index.html');await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  const results=await page.evaluate(async()=>{
   const {normalizeCard}=await import('/js/model/card.js'),{localizeCard}=await import('/js/localization/resolve.js'),{editCard}=await import('/js/model/project.js'),{renderCard}=await import('/js/rendering/cardmaker.js');
   const [en,it,dictionary,overrides,manifest]=await Promise.all(['/fixtures/cards-en.json','/fixtures/cards-it.json','/dictionaries/tcg.json','/text-overrides/cards.json','/assets/templates/nexus/manifest.json'].map(async u=>(await fetch(u)).json()));
   const original=localizeCard(normalizeCard(en.find(c=>c.id===46986414),it.find(c=>c.id===46986414)),'en',dictionary,overrides);
   const image=document.createElement('canvas');image.width=4;image.height=4;image.getContext('2d').fillStyle='#fff';image.getContext('2d').fillRect(0,0,4,4);const artwork=image.toDataURL();
   const drawImage=CanvasRenderingContext2D.prototype.drawImage;let draws=[];
   CanvasRenderingContext2D.prototype.drawImage=function(img,...args){if(img.src)draws.push({src:img.src,args});return drawImage.call(this,img,...args);};
   const output=[];
   try{
    for(const layout of ['Normal','Effect','Fusion','Ritual','Synchro','Xyz','Link','Spell','Trap']){
     for(const pendulum of [false,...(['Normal','Effect','Fusion','Ritual','Synchro','Xyz'].includes(layout)?[true]:[])]){
      const card=editCard(original,{name:`Frame ${layout}`,description:'A modern card designer.',layout,attribute:'dark',race:'cyberse',atk:'0',def:'0',level:'4',pendulum,scale:'5',pendulumText:'Pendulum validation text.',artwork},'en',dictionary);
      draws=[];const render=await renderCard(card);const renderedDraws=draws.slice();
      const img=new Image();img.src=render.url;await img.decode();const c=document.createElement('canvas');c.width=render.width;c.height=render.height;c.getContext('2d').drawImage(img,0,0);
      const source=new Image();const suffix=pendulum?'.pendulum':'';source.src=`/assets/templates/nexus/tcg/ygo/border/${layout}${suffix}.png`;await source.decode();
      const ref=document.createElement('canvas');ref.width=c.width;ref.height=c.height;const ctx=ref.getContext('2d');const g=manifest.geometry,s=Math.min(c.width/g.width,c.height/g.height),ox=(c.width-g.width*s)/2,oy=(c.height-g.height*s)/2;ctx.setTransform(s,0,0,s,ox,oy);ctx.drawImage(source,0,0,g.width,g.height);
      const actual=c.getContext('2d').getImageData(0,0,c.width,c.height).data,expected=ctx.getImageData(0,0,c.width,c.height).data;
      let maxDifference=0,compared=0;
      // Exterior strips are fully opaque and untouched by text, artwork or icons.
      for(let y=10;y<c.height-10;y+=5)for(const x of [8,12,c.width-9,c.width-13]){const k=(y*c.width+x)*4;if(expected[k+3]!==255)continue;compared++;for(let n=0;n<3;n++)maxDifference=Math.max(maxDifference,Math.abs(actual[k+n]-expected[k+n]));}
      output.push({layout,pendulum,compared,maxDifference,diagnostics:render.diagnostics,draws:renderedDraws,png:c.toDataURL('image/png').split(',')[1]});
     }
    }
   }finally{CanvasRenderingContext2D.prototype.drawImage=drawImage;}
   return output;
  });
  assert.equal(results.length,15);assert.deepEqual(errors,[]);
  await fs.mkdir('docs/validation/nexus-frames/variants',{recursive:true});
  for(const r of results){
   assert.ok(r.compared>100);assert.ok(r.maxDifference<=1,`Wrong frame pixels: ${r.layout} ${r.pendulum}`);
   assert.deepEqual(r.diagnostics,[]);
   const frame=r.draws.find(d=>d.src.includes('/border/'));assert.ok(frame.src.includes('/assets/templates/nexus/'));assert.deepEqual(frame.args,[0,0,421,614]);
   const art=r.draws.find(d=>d.src.startsWith('data:image'));const area=manifest.geometry.artwork[r.pendulum?'pendulum':'regular'];assert.deepEqual(art.args,[area.left,area.top,area.width,area.height]);
   assert.ok(r.draws.every(d=>!d.src.includes('/vendor/cardmaker/res/')),'A legacy template is still being loaded');
   await fs.writeFile(`docs/validation/nexus-frames/variants/${r.layout}${r.pendulum?'.pendulum':''}.png`,Buffer.from(r.png,'base64'));delete r.png;
  }
  await fs.writeFile('docs/validation/nexus-frames/frame-checks.json',JSON.stringify(results,null,2)+'\n');
  console.log('All 42 Nexus assets match their recorded hashes; 15 frame variants render exact exterior pixels with aligned artwork, offline.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
