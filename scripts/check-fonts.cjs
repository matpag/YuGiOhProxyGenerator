const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();
  await page.route('https://**/*',route=>route.abort());
  await page.goto('http://127.0.0.1:8765/html/index.html');
  await page.waitForFunction(()=>!document.getElementById('generate').disabled);
  const fonts=await page.evaluate(async()=>{
   const manifest=await (await fetch('/assets/fonts/manifest.json')).json();
   const ctx=document.createElement('canvas').getContext('2d');const output=[];
   for(const font of manifest.fonts){
    const spec=`${font.style} ${font.css_weight} 32px "${font.family}"`;
    const faces=await document.fonts.load(spec,font.verified_characters);
    ctx.font=spec;const width=ctx.measureText(font.verified_characters).width;
    ctx.font=`${font.style} ${font.css_weight} 32px serif`;
    output.push({family:font.family,style:font.style,faces:faces.length,loaded:faces.every(face=>face.status==='loaded'),width,serifWidth:ctx.measureText(font.verified_characters).width});
   }return output;
  });
  assert.equal(fonts.length,9);
  for(const font of fonts){assert.equal(font.faces,1);assert.ok(font.loaded);assert.ok(Math.abs(font.width-font.serifWidth)>.05,`Fallback used for ${font.family}`);}
  await fs.mkdir('docs/validation/fonts',{recursive:true});
  await fs.writeFile('docs/validation/fonts/font-metrics.json',JSON.stringify(fonts,null,2)+'\n');
  await page.close();
  const missing=await browser.newPage();let blocked=false;
  await missing.route('https://**/*',route=>route.abort());
  await missing.route('**/assets/fonts/matrix-regular-small-caps.ttf',route=>{blocked=true;return route.abort();});
  await missing.goto('http://127.0.0.1:8765/html/index.html');
  await missing.waitForFunction(()=>!document.getElementById('generate').disabled);
  await missing.locator('#generate').click();
  await missing.waitForFunction(()=>!document.getElementById('generate').disabled);
  assert.ok(blocked);assert.equal(await missing.locator('#preview img').count(),0);
  assert.ok(await missing.locator('#download').isDisabled());assert.ok(await missing.locator('#save-project').isDisabled());
  assert.equal(await missing.locator('#status').evaluate(element=>element.classList.contains('error')),true);
  await fs.writeFile('docs/validation/fonts/missing-font.json',JSON.stringify({blockedFont:'matrix-regular-small-caps.ttf',previewCount:0,pdfDisabled:true,projectDisabled:true},null,2)+'\n');
  console.log('All nine local font faces load with real glyph metrics; a missing font blocks incomplete output.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
