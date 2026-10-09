const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
const browser=await chromium.launch({headless:true,channel:"msedge"});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const cards=JSON.parse(await fs.readFile('app/fixtures/cards-en.json','utf8'));
await page.route('**/api/v7/cardinfo.php?*',async route=>{
 const u=new URL(route.request().url());
 const key=u.searchParams.get('id')||u.searchParams.get('name');
 const card=cards.find(c=>String(c.id)===key||c.name===key);
 await route.fulfill({status:card?200:400,contentType:'application/json',body:JSON.stringify(card?{data:[card]}:{error:'Card not found'})});
});
await page.route('https://images.ygoprodeck.com/**',route=>route.fulfill({path:path.resolve('app/assets/reference/46986414.jpg'),contentType:'image/jpeg'}));
await page.goto('http://127.0.0.1:8765/baseline/html/index.html');
await page.locator('#decklist_input').fill('12 Dark Magician');
await fs.mkdir('docs/validation/phase-1',{recursive:true});
await page.screenshot({path:'docs/validation/phase-1/original-ui.png',fullPage:true});
const pending=page.waitForEvent('download');
await page.getByRole('button',{name:/Generate Proxies/}).click();
const download=await pending;
await download.saveAs('docs/validation/phase-1/original-12-cards.pdf');
console.log('Original UI and 12-copy PDF exported.');
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});


