const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const baseline=JSON.parse(require('node:fs').readFileSync('docs/research/evidence/typography-references.json','utf8'));
const factor=Math.min(697/baseline.logical_canvas[0],1016/baseline.logical_canvas[1]);
const offsetX=(697-baseline.logical_canvas[0]*factor)/2;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();
  await page.route('https://**/*',route=>route.abort());
  await page.goto('http://127.0.0.1:8765/html/index.html');
  await page.waitForFunction(()=>!document.getElementById('generate').disabled);
  const results=await page.evaluate(async()=>{
   const {normalizeCard}=await import('/js/model/card.js'),{localizeCard}=await import('/js/localization/resolve.js'),{renderCard}=await import('/js/rendering/cardmaker.js');
   const [en,it,dictionary,overrides]=await Promise.all(['/fixtures/cards-en.json','/fixtures/cards-it.json','/dictionaries/tcg.json','/text-overrides/cards.json'].map(async u=>(await fetch(u)).json()));
   const original=CanvasRenderingContext2D.prototype.fillText;
   let draws=[];
   CanvasRenderingContext2D.prototype.fillText=function(text,x,y){
    const t=this.getTransform(),m=this.measureText(text);
    draws.push({text,font:this.font,baseline:t.f,originX:t.e,width:m.width*t.a,height:(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)*t.d,left:t.e+m.actualBoundingBoxLeft*-t.a,top:t.f-m.actualBoundingBoxAscent*t.d,bottom:t.f+m.actualBoundingBoxDescent*t.d,scaleX:t.a,scaleY:t.d});
    return original.apply(this,arguments);
   };
   try{
    const output=[];
    for(const id of [46986414,89631139,70095154,1861629,16178681,55144522,44095762]){
     const card=localizeCard(normalizeCard(en.find(c=>c.id===id),it.find(c=>c.id===id)),'it',dictionary,overrides);
     // Previously exported projects contain spaces and may include their own brackets.
     const versions=card.family==='monster'?[card.typeLine,`[ ${card.typeLine.replaceAll('/',' / ')} ]`]:[card.typeLine];
     for(const typeLine of versions){
      draws=[];await renderCard({...card,typeLine});
      const title=draws.filter(d=>d.text===card.text.name).at(-1);
      const type=draws.filter(d=>d.text.startsWith('[')).at(-1);
      output.push({name:card.text.name,layout:card.layout,input:typeLine,title,type,expectedType:`[${card.typeLine}]`});
     }
    }
    for(const [icon,id] of [['Continuous',55144522],['Counter',44095762],['Quick-play',55144522]]){
     const card=localizeCard(normalizeCard(en.find(c=>c.id===id),it.find(c=>c.id===id)),'it',dictionary,overrides);
     draws=[];await renderCard({...card,icon});
     output.push({icon,expectedParts:[`[${card.typeLine}`,']'],parts:draws.filter(d=>d.text.startsWith('[')||d.text===']').map(d=>d.text)});
    }
    return output;
   }finally{CanvasRenderingContext2D.prototype.fillText=original;}
  });
  await fs.mkdir('docs/validation/typography',{recursive:true});
  await fs.writeFile('docs/validation/typography/render-metrics.json',JSON.stringify(results,null,2)+'\n');
  const samples=results.filter(r=>r.title);
  assert.equal(samples.length,12);
  for(const r of samples){
   assert.equal(r.type.text,r.expectedType,'Spacing changed across localization or project import');
   assert.ok(r.title.height>=34&&r.title.height<=47,'Title height should match the Nexus baseline');
   assert.ok(r.title.left>=44&&r.title.left+r.title.width<=586,'Title must stay in the name area before the attribute');
   assert.ok(r.title.top>=53&&r.title.bottom<=106,'Title must stay inside the header');
  }
  for(const r of samples){
   assert.ok(Math.abs(r.title.originX-(baseline.title_style.left*factor+offsetX))<.1,'Title left position differs from Nexus');
   assert.ok(Math.abs(r.title.baseline-(baseline.title_style.baseline*factor+(1016-baseline.logical_canvas[1]*factor)/2))<.1,'Title baseline differs from Nexus');
   assert.ok(r.title.font.startsWith(`${baseline.title_style.font_size}px `),'Title body differs from Nexus');
  }
  const magician=samples.find(r=>r.name==='Mago Nero');
  assert.ok(Math.abs(magician.title.width-261)<8,'Mago Nero should match the Nexus sample width at 697 pixels');
  const short=samples.find(r=>r.name==='Cyber Drago'),long=samples.find(r=>r.name==='Drago Pendulum Occhi Diversi');
  assert.ok(long.title.scaleX<long.title.scaleY,'Long names should compress horizontally');
  assert.ok(Math.abs(long.title.scaleY-short.title.scaleY)<.001,'Long names must preserve vertical scale');
  for(const r of results.filter(r=>r.icon))assert.deepEqual([...new Set(r.parts)],r.expectedParts,'Icon placement must not add punctuation spaces');
  console.log('Title dimensions, long names, compact type lines, legacy projects and three backrow icons passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
