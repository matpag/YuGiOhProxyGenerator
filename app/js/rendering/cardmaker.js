import {appUrl} from '../paths.js';
const WIDTH=697,HEIGHT=1016;
let modules;
const cache=new Map();
function loadModules(){
  if(!modules)modules=new Promise((resolve,reject)=>{
    window.NCM_RESOURCES=appUrl('assets/templates/nexus');
    window.require.config({baseUrl:appUrl('vendor/cardmaker/src'),paths:{react:appUrl('vendor/runtime/react'),'react-dom':appUrl('vendor/runtime/react-dom'),'react-class':appUrl('vendor/runtime/create-react-class')}});
    window.require(['react','react-dom','tcg/ygo/Card','tcg/ygo/Template'],(React,ReactDOM,Card,Template)=>resolve({React,ReactDOM,Card,Template}),reject);
  });return modules;
}
async function artworkData(image){
  if(/^data:image\/(png|jpeg|webp);base64,/.test(image.image_url_cropped))return image.image_url_cropped;
  const local=appUrl(`assets/artwork/${image.id}.jpg`);
  const cache=await caches.open('proxy-artwork-v1');
  const key=appUrl(`cached-artwork/${image.id}`);
  let response=await cache.match(key);
  if(!response){
    try{
      response=await fetch(local);
      // The CDN omits CORS headers. Local hosts relay by ID; static hosts use wsrv.
      if(!response.ok){
        const loopback=['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);
        let source=appUrl(`api/artwork/${image.id}.jpg`);
        if(!loopback){
          if(!/^\d{1,12}$/.test(String(image.id)))throw new Error('Invalid artwork ID');
          const proxy=new URL('https://wsrv.nl/');
          proxy.searchParams.set('url',`https://images.ygoprodeck.com/images/cards_cropped/${image.id}.jpg`);
          // PNG preserves decoded pixels without resizing or JPEG recompression.
          proxy.searchParams.set('output','png');
          source=proxy.href;
        }
        response=await fetch(source,{signal:AbortSignal.timeout(15000)});
      }
    }catch{throw new Error(`Impossibile scaricare l’illustrazione ${image.id}. Controlla la connessione e riprova.`);}
    if(!response.ok){
      const detail=await response.json().catch(()=>null);
      throw new Error(detail?.error||`Illustrazione ${image.id} non disponibile`);
    }
    if(!response.headers.get('content-type')?.startsWith('image/'))throw new Error(`Illustrazione ${image.id}: risposta non valida`);
    await cache.put(key,response.clone());
  }
  const blob=await response.blob();
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
}
function waitForImages(host){
  return Promise.all([...host.querySelectorAll('img[src]')].filter(img=>img.getAttribute('src')).map(img=>new Promise((resolve,reject)=>{
    if(img.complete){img.naturalWidth?resolve():reject(new Error(`Immagine non caricata: ${img.src}`));return;}
    const timer=setTimeout(()=>reject(new Error(`Timeout caricamento: ${img.src}`)),15000);
    const done=()=>{clearTimeout(timer);resolve();},fail=()=>{clearTimeout(timer);reject(new Error(`Immagine non caricata: ${img.src}`));};
    img.addEventListener('load',done,{once:true});img.addEventListener('error',fail,{once:true});
  })));
}
function localizedAttribute(canvas,card,Template){
  if(card.language==='en')return;
  const ctx=canvas.getContext('2d');ctx.save();
  const factor=Math.min(WIDTH/Template.width,HEIGHT/Template.height);
  ctx.setTransform(factor,0,0,factor,(WIDTH-Template.width*factor)/2,(HEIGHT-Template.height*factor)/2);
  // Mask the English label inside the icon, then draw localized text unclipped.
  ctx.save();ctx.beginPath();ctx.arc(Template.attribute.left+20,Template.attribute.top+20,20,0,Math.PI*2);ctx.clip();
  const colors={dark:['#711a64','#b71931','#531354'],light:['#aa8514','#e0b526','#b08112'],earth:['#6b431b','#a87731','#654622'],fire:['#9c1c15','#db2d16','#9c271b'],water:['#123b8c','#1657b4','#123b8c'],wind:['#1c6236','#318451','#1b643d'],divine:['#ad7611','#deaa21','#9c7411'],spell:['#146e5d','#309c79','#155e4c'],trap:['#962b6c','#ae408e','#8e2769']}[card.attribute];const gradient=ctx.createLinearGradient(Template.attribute.left,Template.attribute.top,Template.attribute.left+40,Template.attribute.top+10);gradient.addColorStop(0,colors[0]);gradient.addColorStop(.5,colors[1]);gradient.addColorStop(1,colors[2]);
  ctx.fillStyle=gradient;ctx.fillRect(Template.attribute.left,Template.attribute.top,40,10);
  ctx.restore();
  ctx.fillStyle='white';ctx.font='700 7.5px "ITC Stone Serif Small Caps Bold"';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(card.attributeLabel,Template.attribute.left+20,Template.attribute.top+9);
  ctx.restore();
}
export async function renderCard(card,{artworkId,cacheResult=true}={}){
  if(!['Normal','Effect','Spell','Trap','Fusion','Ritual','Synchro','Xyz','Link'].includes(card.layout))throw new Error(`Layout ${card.layout} non ancora abilitato`);
  const image=card.artworks.find(x=>x.id===artworkId)||(!artworkId?card.artworks[0]:null);
  if(!image)throw new Error('Variante illustrazione non disponibile');
  const key=JSON.stringify({renderer:7,card,image:image.id});
  if(cache.has(key))return cache.get(key);
  const {React,ReactDOM,Card,Template}=await loadModules();
  const fontSpecs=[
    '400 46px "Matrix Regular Small Caps"',
    '400 13px "Matrix Book"',
    '700 16px "ITC Stone Serif Small Caps Bold"',
    'italic 400 13px "ITC Stone Serif LT"',
    '400 12px "ITC Stone Serif LT"',
    '700 18px "Matrix Bold Small Caps"',
    '400 16px "IDroid"'
  ];
  await Promise.all(fontSpecs.map(async spec=>{
    const faces=await document.fonts.load(spec,'ÀÈÉÌÒÙ àèéìòù 0123456789');
    if(!faces.length)throw new Error(`Font della carta non disponibile: ${spec}`);
  }));
  await document.fonts.ready;
  const artwork=await artworkData(image);
  const host=document.createElement('div');host.className='render-host';document.body.append(host);
  try{
    const instance=ReactDOM.render(React.createElement(Card,{layout:card.layout,pixelWidth:WIDTH,pixelHeight:HEIGHT,name:card.text.name,image:artwork,rarity:'Common',attribute:card.attribute[0].toUpperCase()+card.attribute.slice(1),level:card.rank??card.level,type:card.typeLine,effect:card.scale===null?card.text.description:card.text.monsterEffect,atk:String(card.atk??''),def:String(card.layout==='Link'?card.linkValue:(card.def??'')),serial:card.passcode,id:'',copyright:'PROXY',icon:card.icon||'None',pendulum:{enabled:card.scale!==null,effect:card.text.pendulumEffect||'',blue:String(card.scale??0),red:String(card.scale??0)},link:Object.fromEntries(card.linkMarkers.map(x=>[({'Top':'topCenter','Bottom':'bottomCenter','Left':'middleLeft','Right':'middleRight','Top-Left':'topLeft','Top-Right':'topRight','Bottom-Left':'bottomLeft','Bottom-Right':'bottomRight'})[x],true]))}),host);
    await waitForImages(host);
    const canvas=host.querySelector('canvas');canvas.proxyDiagnostics=[];
    await new Promise(resolve=>instance.forceUpdate(resolve));
    if(canvas.proxyDiagnostics.some(x=>x.fontSize<8))throw new Error('Il testo non entra nella carta con un corpo leggibile');
    localizedAttribute(canvas,card,Template);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG non esportabile')),'image/png'));
    const result={pngBytes:new Uint8Array(await blob.arrayBuffer()),width:WIDTH,height:HEIGHT,url:URL.createObjectURL(blob),diagnostics:canvas.proxyDiagnostics,artworkId:image.id,transient:!cacheResult};
    if(cacheResult)cache.set(key,result);return result;
  }finally{ReactDOM.unmountComponentAtNode(host);host.remove();}
}
