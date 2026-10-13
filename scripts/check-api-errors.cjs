const {launchTestBrowser}=require('./helpers/test-data.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createServer}=require('node:http'),path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve('app'),messages=JSON.parse(await fs.readFile('app/dictionaries/ui.json','utf8')).messages;
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.otf':'font/otf'};
 const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await launchTestBrowser(chromium,{headless:true,channel:'msedge'});
  const page=await browser.newPage({locale:'it-IT',viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
  const query='DefinitelyUnknownCardCodex20261012';
  // Replay the real API's not-found JSON, captured during the initial review.
  const actual={status:400,body:JSON.stringify({error:'No card matching your query was found in the database.'})};
  let mode='missing';
  await page.route('https://db.ygoprodeck.com/api/v7/cardinfo.php?**',route=>{
   if(mode==='abort')return route.abort('failed');
   if(mode==='html')return route.fulfill({status:503,contentType:'text/html',body:'<html>Service unavailable</html>'});
   if(mode==='missing')return route.fulfill({status:actual?.status||400,contentType:'application/json',body:actual?.body||JSON.stringify({error:'No card matching your query was found in the database.'})});
   return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Server unavailable'})});
  });
  await page.goto(process.env.APP_URL||`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  for(const lang of ['it','en','de','es','fr']){
   await page.locator('[data-ui-language='+lang+']').click();await page.locator('#decklist_input').fill('3 Dark Magician\n1 '+query);
   await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
   const message=await page.locator('#status').innerText();
   const expected=messages[lang]['error.rowCard'].replace('{line}','2').replace('{card}',query).replace('{message}',messages[lang]['error.cardNotFound']);
   assert.equal(message,expected);assert.equal(await page.locator('#download').isDisabled(),true);
   assert.equal(await page.locator('#status').getAttribute('role'),'status');results.push({mode,language:lang,message});console.log(lang,message);
  }
  for(const next of ['abort','json503','html']){
   mode=next;
   await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
   // Changing UI language must immediately translate the current error, without a new API request.
   for(const lang of ['it','en','de','es','fr']){
    await page.locator('[data-ui-language='+lang+']').click();
    const message=await page.locator('#status').innerText();
    const expected=messages[lang]['error.rowCard'].replace('{line}','2').replace('{card}',query).replace('{message}',messages[lang]['error.network']);
    assert.equal(message,expected);assert.equal(await page.locator('#download').isDisabled(),true);
    assert.equal(await page.locator('#language').inputValue(),'en');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    results.push({mode,language:lang,message});console.log(next,lang,message);
   }
  }
  await page.locator('#decklist_input').fill('3 Dark Magician');await page.locator('#generate').click();
  await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert.equal(await page.locator('#download').isDisabled(),false);
  assert.equal(await page.locator('#status').evaluate(element=>element.classList.contains('error')),false);
  assert.deepEqual(errors,[]);
  await fs.mkdir('docs/validation/error-review',{recursive:true});
  await fs.writeFile('docs/validation/error-review/results.json',JSON.stringify({actual,results,unhandledErrors:errors},null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
