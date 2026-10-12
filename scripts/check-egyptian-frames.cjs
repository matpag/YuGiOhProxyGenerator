const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const url=process.env.APP_URL||'http://127.0.0.1:8765/';
const ready=page=>page.waitForFunction(()=>!document.querySelector('#generate').disabled);
const directory='docs/validation/egyptian-gods';
(async()=>{
 const manifest=JSON.parse(await fs.readFile('app/assets/templates/frames/egyptian-gods-manifest.json','utf8'));
 const palette=JSON.parse(await fs.readFile('app/assets/templates/frames/egyptian-gods-palette.json','utf8'));
 const messages=JSON.parse(await fs.readFile('app/dictionaries/ui.json','utf8')).messages;
 const expectedRgb=target=>{const luma=target.rgb.reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);return target.rgb.map(value=>luma+(value-luma)*(target.saturation??1));};
 for(const asset of manifest.assets){for(const [file,hash] of [[asset.file,asset.sha256],[asset.sourceFile,asset.sourceSha256]])assert.equal(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'),hash);}
 const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[];
 try{
  await fs.mkdir(directory+'/cards',{recursive:true});
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://**/*',request=>new URL(request.request().url()).origin===new URL(url).origin?request.continue():request.abort());
  await page.goto(url);await ready(page);
  const results=await page.evaluate(async palette=>{
   const relative=file=>new URL(file,location.href).href;
   const json=async file=>(await fetch(relative(file))).json();
   const module=async file=>import(relative(file));
   const [{normalizeCard},{localizeCard},{editCard},{renderCard},en,it,dictionary]=await Promise.all([module('js/model/card.js'),module('js/localization/resolve.js'),module('js/model/project.js'),module('js/rendering/cardmaker.js'),json('fixtures/cards-en.json'),json('fixtures/cards-it.json'),json('dictionaries/tcg.json')]);
   const decoded=async source=>{const image=new Image();image.src=source;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);return {canvas,pixels:context.getImageData(0,0,canvas.width,canvas.height).data};};
   const base=await decoded(relative('assets/templates/frames/Normal.png')),assets=[];
   const masks=[...Object.values(palette.masks).flat(),...palette.outer_edge.patches.map(patch=>patch.rect)];
   const colored=(x,y)=>masks.some(([rx,ry,w,h])=>x>=rx&&x<rx+w&&y>=ry&&y<ry+h);
   const mean=(pixels,regions)=>{const rgb=[];for(const [x1,y1,x2,y2] of regions)for(let y=y1;y<y2;y++)for(let x=x1;x<x2;x++){const k=(y*421+x)*4;rgb.push(Array.from(pixels.slice(k,k+3)));}const light=rgb.map(v=>v[0]*.2126+v[1]*.7152+v[2]*.0722).sort((a,b)=>a-b);const low=light[Math.floor(light.length*.15)],high=light[Math.floor(light.length*.9)],valid=rgb.filter(v=>{const y=v[0]*.2126+v[1]*.7152+v[2]*.0722;return y>=low&&y<=high;});return [0,1,2].map(n=>valid.reduce((sum,v)=>sum+v[n],0)/valid.length);};
   for(const code of Object.keys(palette.frames)){
    const frame=await decoded(relative('assets/templates/frames/'+code+'.png'));let alphaDifference=0,neutralDifference=0;
    for(let y=0;y<614;y++)for(let x=0;x<421;x++){const k=(y*421+x)*4;alphaDifference=Math.max(alphaDifference,Math.abs(frame.pixels[k+3]-base.pixels[k+3]));if(!colored(x,y))for(let n=0;n<4;n++)neutralDifference=Math.max(neutralDifference,Math.abs(frame.pixels[k+n]-base.pixels[k+n]));}
    const measurement={};for(const name of ['body','panel'])measurement[name]=mean(frame.pixels,palette.measurement_regions[name]);
    // The body must meet the dark outer border without the Normal frame's gold hairline.
    const probes=[...[20,100,200,350].map(x=>[x,13,x,16]),...[75,150,300,550].map(y=>[11,y,15,y]),...[75,150,300,550].map(y=>[408,y,405,y]),...[20,100,200,350].map(x=>[x,600,x,598]),[11,13,15,15],[408,13,405,15],[11,601,15,598],[408,601,405,598]];
    const outerEdgeDifference=Math.max(...probes.flatMap(([x,y,bx,by])=>[0,1,2].map(n=>Math.abs(frame.pixels[(y*421+x)*4+n]-frame.pixels[(by*421+bx)*4+n]))));
    const bottomPanelDifference=Math.max(...[40,100,160,200,310,365].flatMap(x=>[0,1,2].map(n=>Math.abs(frame.pixels[(577*421+x)*4+n]-frame.pixels[(576*421+x)*4+n]))));
    // The Normal frame's corner ornaments must remain intact, with no new
    // black clipping in the adjacent neutral bevels.
    const ornaments=[[25,459,5,6],[391,459,5,6],[25,576,5,5],[391,576,5,5],[30,459,361,2]];
    let panelCornerDifference=0,panelShadowClippedPixels=0;
    for(const [rx,ry,w,h] of ornaments)for(let y=ry;y<ry+h;y++)for(let x=rx;x<rx+w;x++){const k=(y*421+x)*4;for(let n=0;n<4;n++)panelCornerDifference=Math.max(panelCornerDifference,Math.abs(frame.pixels[k+n]-base.pixels[k+n]));}
    for(const [rx,ry,w,h] of [[30,461,8,7],[383,461,8,7],[30,573,8,8],[383,573,8,8]])for(let y=ry;y<ry+h;y++)for(let x=rx;x<rx+w;x++){const k=(y*421+x)*4;const source=Array.from(base.pixels.slice(k,k+3));if(source.every(value=>value>50)&&Math.abs(source[0]-source[1])<25&&[0,1,2].some(n=>frame.pixels[k+n]===0))panelShadowClippedPixels++;}
    assets.push({code,width:frame.canvas.width,height:frame.canvas.height,alphaDifference,neutralDifference,outerEdgeDifference,bottomPanelDifference,panelCornerDifference,panelShadowClippedPixels,measurement});
   }
   const image=document.createElement('canvas');image.width=image.height=4;const ctx=image.getContext('2d');ctx.fillStyle='#28598b';ctx.fillRect(0,0,4,4);const artwork=image.toDataURL();
   const raw=en.find(card=>card.id===46986414),localized=it.find(card=>card.id===46986414),renders=[];
   const factor=1016/614,offset=(697-421*factor)/2;
   const drawImage=CanvasRenderingContext2D.prototype.drawImage;let draws=[],Border,originalBorderRender,controlFrame=false;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image.src)draws.push({src:image.src,args});return drawImage.call(this,image,...args);};
   try{
    for(const language of ['en','it'])for(const layout of ['Normal','Effect']){
     const original=localizeCard(normalizeCard(raw,localized,language),language,dictionary);
     const fields={name:'Frame validation',description:'Text and artwork keep the selected card layout.',layout,attribute:'divine',race:'divine_beast',atk:'4000',def:'4000',level:'10',pendulum:false,scale:'4',pendulumText:'',artwork,specialFrame:''};
     const card=editCard(original,fields,language,dictionary);
     await renderCard({...card,frameValidationWarmup:true});
     if(!Border){
      Border=await new Promise((resolve,reject)=>window.require(['tcg/ygo/layout/component/Border'],resolve,reject));originalBorderRender=Border.prototype.render;
      Border.prototype.render=function(){
       if(!controlFrame)return originalBorderRender.call(this);
       const props=this.props;this.props={...props,value:'Normal'};
       try{return originalBorderRender.call(this);}finally{this.props=props;}
      };
     }
     // Reference the common Nexus Normal bevels while keeping the same layout,
     // text style and every other renderer input in both controls.
     let baseline;controlFrame=true;
     try{baseline=await decoded((await renderCard({...card,frameValidationBaseline:true})).url);}finally{controlFrame=false;}
     for(const code of Object.keys(palette.frames)){
      draws=[];const special=await renderCard({...card,specialFrame:code});const rendering=await decoded(special.url);let outsidePixels=0,maxOutside=0,examples=[],bounds=[697,1016,-1,-1];
      for(let y=0;y<1016;y++)for(let x=0;x<697;x++){
       const nx=(x-offset)/factor,ny=y/factor;
       if(masks.some(([rx,ry,w,h])=>nx>=rx-1&&nx<=rx+w+1&&ny>=ry-1&&ny<=ry+h+1))continue;
       const k=(y*697+x)*4;let diff=0;for(let n=0;n<4;n++)diff=Math.max(diff,Math.abs(rendering.pixels[k+n]-baseline.pixels[k+n]));
       if(diff){outsidePixels++;maxOutside=Math.max(maxOutside,diff);bounds=[Math.min(bounds[0],x),Math.min(bounds[1],y),Math.max(bounds[2],x),Math.max(bounds[3],y)];if(examples.length<8)examples.push({x,y,actual:Array.from(rendering.pixels.slice(k,k+4)),baseline:Array.from(baseline.pixels.slice(k,k+4))});}
      }
      const repeated=await decoded((await renderCard({...card,specialFrame:code,frameValidationRepeat:true})).url);
      let repeatPixels=0;for(let k=0;k<rendering.pixels.length;k+=4)if([0,1,2,3].some(n=>rendering.pixels[k+n]!==repeated.pixels[k+n]))repeatPixels++;
      renders.push({code,layout,language,outsidePixels,maxOutside,examples,bounds,repeatPixels,diagnostics:special.diagnostics,draws:draws.filter(draw=>draw.src.includes('/assets/templates/frames/')),png:rendering.canvas.toDataURL().split(',')[1]});
     }
    }
   }finally{CanvasRenderingContext2D.prototype.drawImage=drawImage;if(Border)Border.prototype.render=originalBorderRender;}
   return {assets,renders};
  },palette);
  for(const asset of results.assets){assert.equal(asset.width,421);assert.equal(asset.height,614);assert.equal(asset.alphaDifference,0);assert.equal(asset.neutralDifference,0);assert.equal(asset.panelCornerDifference,0,asset.code+': the panel tint overlaps the Normal corner ornaments');assert.equal(asset.panelShadowClippedPixels,0,asset.code+': the inner bevel acquired black clipping');assert.ok(asset.bottomPanelDifference<20,asset.code+': an untinted strip remains below ATK/DEF ('+asset.bottomPanelDifference+')');assert.ok(asset.outerEdgeDifference<12,asset.code+': a separate outer hairline remains ('+asset.outerEdgeDifference+')');for(const name of ['body','panel'])for(let n=0;n<3;n++)assert.ok(Math.abs(asset.measurement[name][n]-expectedRgb(palette.frames[asset.code].target[name])[n])<1.5,'Frame color departed from the calibrated palette');}
  for(const render of results.renders){assert.equal(render.outsidePixels,0,JSON.stringify({...render,png:undefined,draws:render.draws.slice(0,1)}));assert.equal(render.repeatPixels,0,"Repaints must yield the same pixels, including the first column");assert.deepEqual(render.diagnostics,[]);assert.deepEqual(render.draws[0].args,[0,0,421,614]);await fs.writeFile(`${directory}/cards/${render.code}-${render.layout}-${render.language}.png`,Buffer.from(render.png,'base64'));delete render.png;}
  await fs.writeFile(directory+'/render-checks.json',JSON.stringify(results,null,2)+'\n');await page.close();
  for(const lang of ['it','en','de','es','fr']){
   const page=await browser.newPage({locale:lang,viewport:{width:320,height:740},isMobile:true,hasTouch:true,acceptDownloads:true});page.on('pageerror',error=>errors.push(error.message));
   await page.route('https://**/*',request=>new URL(request.request().url()).origin===new URL(url).origin?request.continue():request.abort());
   await page.goto(url);await ready(page);await page.locator('#decklist_input').fill('1 Dark Magician\n1 Dark Magician\n1 Dark Magician');await page.locator('#generate').tap();await ready(page);
   for(const [index,code] of ['slifer','obelisk','ra'].entries()){
    await page.locator('#preview button').nth(index).tap();assert.equal(await page.locator('#frame-label').innerText(),messages[lang].frameChoice);assert.equal(await page.locator('#edit-frame').isVisible(),true);
    const previous=await page.locator('#edit-preview-img').getAttribute('src');await page.locator('#editor-preview-details').evaluate(element=>element.open=true);await page.locator('#edit-frame').selectOption(code);await page.waitForFunction(source=>document.querySelector('#edit-preview-img').src!==source&&!document.querySelector('#edit-preview-status').textContent,previous);
    await page.locator('#apply-edit').tap();await page.locator('#editor').waitFor({state:'hidden'});
    await page.locator('#preview button').nth(index).tap();assert.equal(await page.locator('#edit-frame').inputValue(),code);await page.locator('#close-editor').tap();
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const selected=await page.locator('#preview img').evaluateAll(images=>images.map(image=>image.src));assert.equal(new Set(selected).size,3);
   await page.locator('[data-ui-language=en]').tap();assert.deepEqual(await page.locator('#preview img').evaluateAll(images=>images.map(image=>image.src)),selected);await page.locator(`[data-ui-language=${lang}]`).tap();
   await page.locator('#view-pages').tap();assert.equal(await page.locator('#paper-preview img').count(),3);const pending=page.waitForEvent('download');await page.locator('#download').tap();const download=await pending;await download.saveAs(`${directory}/frames-${lang}.pdf`);
   await page.locator('#view-cards').tap();await page.locator('#preview button').first().tap();await page.locator('#edit-layout').selectOption('Fusion');assert.equal(await page.locator('#edit-frame').isVisible(),false);await page.locator('#edit-layout').selectOption('Normal');assert.equal(await page.locator('#edit-frame').inputValue(),'');await page.locator('#edit-pendulum').check();assert.equal(await page.locator('#edit-frame').isVisible(),false);await page.locator('#edit-pendulum').uncheck();assert.equal(await page.locator('#edit-frame').isVisible(),true);
   await page.locator('#edit-frame').selectOption('slifer');await page.setViewportSize({width:740,height:320});const button=await page.locator('#apply-edit').boundingBox();assert.ok(button.y>=-1&&button.y+button.height<=321);assert.ok(await page.evaluate(()=>document.querySelector('#editor').scrollWidth<=document.querySelector('#editor').clientWidth));await page.screenshot({path:`${directory}/editor-${lang}-landscape.png`});await page.locator('#close-editor').tap();await page.close();
  }
  assert.deepEqual(errors,[]);console.log('Three frames: no outer gold hairline or untinted bottom panel strip, intact Nexus corner ornaments and unclipped inner bevels, measured colors, exact alpha/neutral pixels, 12 EN/IT renders, five-language mobile editing and PDFs passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
