const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve('app');
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
 const server=createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(!pathname.startsWith('/YuGiOhProxyGenerator/')){res.writeHead(404);res.end();return;}
   const file=path.resolve(root,pathname.slice('/YuGiOhProxyGenerator/'.length)||'index.html');
   if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({locale:'it-IT'});const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.route('https://**/*',route=>route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/YuGiOhProxyGenerator/`);
  await page.waitForFunction(()=>document.getElementById('generate')&&!document.getElementById('generate').disabled);
  assert.ok(page.url().endsWith('/YuGiOhProxyGenerator/'));
  for(const lang of ['en','it']){
   await page.locator('#language').selectOption(lang);
   await page.locator('#decklist_input').fill('3 Dark Magician');await page.locator('#generate').click();
   await page.waitForFunction(()=>!document.getElementById('generate').disabled);
   assert.match(await page.locator('#status').innerText(),/3 carte pronte/);
   assert.equal(await page.locator('#preview img').count(),1);
   assert.equal(await page.locator('#preview img').first().evaluate(img=>img.naturalWidth),697);
   const pending=page.waitForEvent('download');await page.locator('#download').click();const download=await pending;
   const bytes=await readFile(await download.path());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
   console.log(`${lang}: subpath assets, local fonts/artwork, PNG and PDF passed without external requests`);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
