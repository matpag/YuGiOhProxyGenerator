const {launchTestBrowser}=require('./helpers/test-data.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('node:http');
const phase=process.argv[2]==='before'?'before':'after',root=path.resolve('app');
const directory=path.resolve('docs/validation/quick-guide',phase);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
 '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.otf':'font/otf','.woff2':'font/woff2'};
(async()=>{
 await fs.mkdir(directory,{recursive:true});
 const server=createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await launchTestBrowser(chromium,{headless:true,channel:'msedge'});
  const errors=[],measurements=[],messages=JSON.parse(await fs.readFile('app/dictionaries/ui.json','utf8')).messages;
  const widths=phase==='before'?[1440,390,320]:[1440,1024,768,760,390,320,740];
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:width===740?320:900},isMobile:width<=760,hasTouch:width<=760,locale:'it-IT'});
   page.on('pageerror',error=>errors.push(error.message));
   const url=process.env.APP_URL||`http://127.0.0.1:${server.address().port}/`,origin=new URL(url).origin;
   await page.route('https://**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   await page.goto(url);await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
   for(const language of phase==='before'?['it']:['it','en','de','es','fr']){
    await page.locator('[data-ui-language='+language+']').click();
    await page.evaluate(async()=>{await document.fonts.ready;for(const image of document.images){image.loading='eager';if(image.getAttribute('src'))await image.decode().catch(()=>{});}});
    if(phase==='after'){
     assert.equal(await page.locator('.quick-guide').count(),1);assert.equal(await page.locator('.quick-guide .howto').count(),1);
     assert.equal(await page.locator('.settings .howto').count(),0);assert.equal(await page.locator('.guide-steps li').count(),3);
     for(const key of ['helpStepList','helpStepLanguage','helpStepExport','fullInstructions'])
      assert.equal(await page.locator('[data-i18n='+key+']').innerText(),messages[language][key]);
     assert.equal(await page.locator('.howto').evaluate(element=>element.open),false);
     const guide=await page.locator('.quick-guide').boundingBox(),deck=await page.locator('.decklist').boundingBox(),settings=await page.locator('.settings').boundingBox();
     assert.ok(guide.y+guide.height<=deck.y);
     assert.ok(await page.locator('.quick-guide').evaluate(element=>Boolean(element.compareDocumentPosition(document.querySelector('.decklist'))&Node.DOCUMENT_POSITION_FOLLOWING)));
     if(width>760){assert.ok(Math.abs(deck.y-settings.y)<1);assert.ok(guide.width>deck.width+settings.width);}
     assert.equal(await page.locator('#language').inputValue(),'en');
     measurements.push({width,language,guide,deck,settings});
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${language}: overflow`);
    await page.screenshot({path:path.join(directory,`${width}-${language}.png`),fullPage:true,animations:'disabled',caret:'hide'});
   }
   await page.locator('[data-ui-language=it]').click();
   const summary=page.locator('.howto summary');await summary.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('.howto').evaluate(element=>element.open),true);
   assert.ok(await page.locator('[data-i18n=helpImport]').isVisible());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(directory,`${width}-expanded.png`),fullPage:true});
   if(phase==='after'){
    // The same disclosure node and keyboard focus survive a desktop/mobile resize.
    await page.setViewportSize({width:width>760?390:1440,height:900});
    assert.ok(await summary.evaluate(element=>element===document.activeElement));
    assert.equal(await page.locator('.howto').evaluate(element=>element.open),true);
    await page.keyboard.press('Enter');assert.equal(await page.locator('.howto').evaluate(element=>element.open),false);
    if(width===1440||width===390){
     await page.setViewportSize({width,height:900});await page.locator('#generate').click();
     await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
     assert.equal(await page.locator('#preview img').first().evaluate(img=>img.naturalWidth),697);
     const before=await page.locator('#preview img').first().getAttribute('src');
     await page.locator('[data-ui-language=fr]').click();assert.equal(await page.locator('#preview img').first().getAttribute('src'),before);
     assert.equal(await page.locator('#download').isDisabled(),false);
     await page.locator('#preview button').first().click();await page.locator('#editor').waitFor({state:'visible'});await page.locator('#close-editor').click();
     const pending=page.waitForEvent('download');await page.locator('#download').click();const download=await pending;
     const bytes=await fs.readFile(await download.path());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
     await fs.writeFile(path.join(directory,`preview-${width}.pdf`),bytes);
    }
   }
   await page.close();console.log(phase+': '+width+'px passed');
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(directory,'geometry.json'),JSON.stringify(measurements,null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
