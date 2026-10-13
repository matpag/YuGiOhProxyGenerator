const {launchTestBrowser}=require('./helpers/test-data.cjs');
// Offline regression: compare old and optimized exports from the exact same PNGs.
// Optional real-deck fixture: run verify-pdf-lossless.py --prepare first.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createServer}=require('node:http');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const directory=path.resolve('docs/validation/pdf-lossless'),app=path.resolve('app');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json',
 '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.otf':'font/otf','.woff2':'font/woff2'};
(async()=>{
 await fs.mkdir(directory,{recursive:true});
 const server=createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(req.method==='POST'&&/^\/output\/[a-zA-Z0-9-]+\.pdf$/.test(pathname)){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    await fs.writeFile(path.join(directory,pathname.slice('/output/'.length)),Buffer.concat(chunks));
    res.end('saved');return;
   }
   if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<script src="/app/js/blob-stream.js"></script><script src="/app/js/pdfkit.standalone.js"></script>');return;}
   const base=pathname.startsWith('/app/')?app:pathname.startsWith('/fixture/')?directory:null;
   if(!base)throw new Error('Unknown path');
   const file=path.resolve(base,pathname.replace(/^\/(app|fixture)\//,''));
   if(!file.startsWith(base+path.sep))throw new Error('Invalid path');
   res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await launchTestBrowser(chromium,{headless:true,channel:'msedge'});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>console.log(message.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const hasDeck=await fs.access(path.join(directory,'deck.json')).then(()=>true,()=>false);
  const cases=['synthetic-A4','synthetic-LETTER','synthetic-A3','fallback',...(hasDeck?['deck']:[])];
  const results=[];
  for(const name of cases){
   const result=await page.evaluate(async name=>{
    const {createPdf,pageLayout}=await import('/app/js/printing/pdf.js');
    const bytesOf=async blob=>new Uint8Array(await blob.arrayBuffer());
    let items;
    if(name==='deck'){
     const entries=await (await fetch('/fixture/deck.json')).json();
     items=[];
     for(const entry of entries)items.push({entry:{quantity:entry.quantity},render:{pngBytes:await bytesOf(await (await fetch('/fixture/'+entry.file)).blob())}});
    }else{
     const canvas=document.createElement('canvas');canvas.width=127;canvas.height=83;
     const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(127,83);
     for(let i=0;i<pixels.data.length;i+=4){
      pixels.data[i]=(i*17)&255;pixels.data[i+1]=(i*37+20)&255;pixels.data[i+2]=(i*13+90)&255;
      pixels.data[i+3]=[0,1,127,254,255][(i/4)%5];
     }
     ctx.putImageData(pixels,0,0);
     const png=await bytesOf(await new Promise(resolve=>canvas.toBlob(resolve,'image/png')));
     ctx.fillStyle='#ff0044';ctx.fillRect(11,13,37,31);
     const changed=await bytesOf(await new Promise(resolve=>canvas.toBlob(resolve,'image/png')));
     items=[{entry:{quantity:8},render:{pngBytes:png}},{entry:{quantity:4},render:{pngBytes:png.slice()}},{entry:{quantity:1},render:{pngBytes:changed}}];
    }
    const paper=name.split('-')[1]||'A4',settings={paper,scale:1,margin:20,gap:0};
    // Baseline: the original exporter embeds every decklist entry separately.
    async function baseline(){
     const layout=pageLayout(settings),doc=new window.PDFDocument({size:layout.size,margin:0});
     const stream=doc.pipe(window.blobStream());
     const result=new Promise((resolve,reject)=>{stream.on('finish',()=>resolve(stream.toBlob('application/pdf')));stream.on('error',reject);doc.on('error',reject);});
     let index=0;
     for(const item of items){
      const bytes=item.render.pngBytes,image=doc.openImage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
      for(let copy=0;copy<item.entry.quantity;copy++){
       if(index&&index%layout.capacity===0)doc.addPage();const pos=index%layout.capacity;
       doc.image(image,layout.margin+(pos%layout.columns)*(layout.width+layout.gap),layout.margin+Math.floor(pos/layout.columns)*(layout.height+layout.gap),{width:layout.width,height:layout.height});index++;
      }
     }
     doc.end();return result;
    }
    console.log(name+': baseline export');
    const start=performance.now(),before=await baseline(),baselineMs=performance.now()-start;
    const native=window.CompressionStream;
    if(name==='fallback')window.CompressionStream=undefined;
    console.log(name+': optimized export');
    const next=performance.now();let after;
    try{after=await createPdf(items,settings);}finally{window.CompressionStream=native;}
    const optimizedMs=performance.now()-next;
    for(const [suffix,blob] of [['before',before],['after',after]]){
      const response=await fetch('/output/'+name+'-'+suffix+'.pdf',{method:'POST',body:blob});
      if(!response.ok)throw new Error('Cannot save comparison PDF');
    }
    return {beforeBytes:before.size,afterBytes:after.size,baselineMs,optimizedMs,copies:items.reduce((sum,i)=>sum+i.entry.quantity,0)};
   },name);
   const summary={name,...result};
   assert.ok(summary.afterBytes<summary.beforeBytes);results.push(summary);console.log(summary);
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(directory,'timings.json'),JSON.stringify(results,null,2));
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'it-IT'});
  phone.on('pageerror',e=>errors.push(e.message));
  await phone.route('https://**/*',route=>route.abort());
  await phone.goto(`http://127.0.0.1:${server.address().port}/app/index.html`);
  await phone.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await phone.locator('#decklist_input').fill('3 Dark Magician');
  await phone.locator('#generate').click();await phone.waitForFunction(()=>!document.querySelector('#generate').disabled);
  assert.equal(await phone.locator('#download').isDisabled(),false);
  const pending=phone.waitForEvent('download');await phone.locator('#download').click();
  const download=await pending;await download.saveAs(path.join(directory,'mobile-app.pdf'));
  assert.deepEqual(errors,[]);console.log('Touch viewport: application preview and optimized PDF download passed.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
