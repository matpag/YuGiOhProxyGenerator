// Recorded responses belong to tests only; production always uses YGOProDeck.
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../../tests/fixtures');
let records;
async function data(){
 if(!records)records=Promise.all(['en','it','de','fr'].map(async language=>[language,JSON.parse(await fs.readFile(path.join(root,'cards-'+language+'.json'),'utf8'))])).then(Object.fromEntries);
 return records;
}
async function installTestData(page){
 const cards=await data();
 await page.route('**/__test__/fixtures/**',async route=>{
  const file=new URL(route.request().url()).pathname.split('/').pop();
  if(!/^(cards-(en|it|de|fr)|text-overrides)\.json$/.test(file))return route.fallback();
  await route.fulfill({contentType:'application/json',body:await fs.readFile(path.join(root,file))});
 });
 await page.route('https://db.ygoprodeck.com/api/v7/cardinfo.php?**',async route=>{
  const url=new URL(route.request().url()),language=url.searchParams.get('language')||'en';
  const card=(cards[language]||[]).find(card=>url.searchParams.has('id')?Number(url.searchParams.get('id'))===card.id:card.name.toLowerCase()===(url.searchParams.get('name')||'').toLowerCase());
  if(!card)return route.fallback();
  return route.fulfill({json:{data:[card]},headers:{'Access-Control-Allow-Origin':'*'}});
 });
 const image=async(route,id)=>{
  if(!/^\d+$/.test(id||''))return route.fallback();
  let bytes;try{bytes=await fs.readFile(path.join(root,'artwork',id+'.jpg'));}catch{return route.fallback();}
  return route.fulfill({contentType:'image/jpeg',body:bytes,headers:{'Access-Control-Allow-Origin':'*'}});
 };
 await page.route('**/api/artwork/*.jpg',route=>image(route,new URL(route.request().url()).pathname.match(/(\d+)\.jpg$/)?.[1]));
 await page.route('https://wsrv.nl/**',route=>image(route,new URL(route.request().url()).searchParams.get('url')?.match(/(\d+)\.jpg$/)?.[1]));
}
async function launchTestBrowser(chromium,options){
 const browser=await chromium.launch(options),newPage=browser.newPage.bind(browser);
 browser.newPage=async(...args)=>{
  const page=await newPage(...args),goto=page.goto.bind(page);let installed=false;
  // Install after the test's general network blocker, but before navigation.
  page.goto=async(...args)=>{if(!installed){await installTestData(page);installed=true;}return goto(...args);};
  return page;
 };
 return browser;
}
module.exports={installTestData,launchTestBrowser};
