import {appUrl} from './paths.js';
import {setupEditor} from './editor.js';
import {parseDecklist} from './decklist/parse.js';
import {normalizeCard} from './model/card.js';
import {localizeCard} from './localization/resolve.js';
import {CardRepository} from './data/api.js';
import {renderCard} from './rendering/cardmaker.js';
import {createPdf,pageLayout} from './printing/pdf.js';
const $=id=>document.getElementById(id);
const repository=new CardRepository();
let dictionary,overrides,items=[],busy=false,editor,controller;
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
const settings=()=>({paper:$('paper_size').value,scale:$('card_scale').value,gap:$('margin_cards').value,margin:$('margin_document').value});
function invalidate(){items=[];$('download').disabled=true;$('save-project').disabled=true;}
function refreshPreview(){
  $('preview').replaceChildren();
  items.forEach((item,index)=>{
    const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption'),edit=document.createElement('button');
    img.src=item.render.url;img.alt=item.card.text.name;img.width=240;img.height=350;
    caption.textContent=`${item.entry.quantity} × ${item.card.text.name}${item.render.diagnostics.length?' · testo piccolo':''}`;
    edit.textContent='Modifica carta';edit.addEventListener('click',()=>editor.open(index));figure.append(img,caption,edit);$('preview').append(figure);
  });
  $('download').disabled=!items.length;$('save-project').disabled=!items.length;
  status(`${items.reduce((n,x)=>n+x.entry.quantity,0)} carte pronte in ${$('language').value.toUpperCase()}.`);
}
async function generate(){
  if(busy)return;busy=true;controller=new AbortController();$('cancel').disabled=false;$('language').disabled=true;$('decklist_input').readOnly=true;$('file').disabled=true;$('project-file').disabled=true;invalidate();$('generate').disabled=true;$('preview').replaceChildren();
  try{
    pageLayout(settings());
    const parsed=parseDecklist($('decklist_input').value);
    if(parsed.errors.length)throw new Error(parsed.errors.map(e=>`Riga ${e.line}: ${e.message}`).join('; '));
    if(!parsed.entries.length)throw new Error('Inserisci almeno una carta');
    const prepared=[];
    for(const [index,entry] of parsed.entries.entries()){
      status(`Preparazione carta ${index+1} di ${parsed.entries.length}…`);
      try{
        controller.signal.throwIfAborted();const {en,it}=await repository.find(entry,controller.signal);
        const card=localizeCard(normalizeCard(en,it),$('language').value,dictionary,overrides);
        const artwork=card.artworks[entry.variant];
        if(!artwork)throw new Error(`Variante [${entry.variant}] non disponibile`);
        const render=await renderCard(card,{artworkId:artwork.id});controller.signal.throwIfAborted();
        prepared.push({entry,card,render});
      }catch(error){
        if(error.name==='AbortError')throw error;
        throw new Error(`Riga ${entry.line} (${entry.query}): ${error.message}`);
      }
    }
    items=prepared;
    refreshPreview();
  }catch(error){invalidate();status(error.name==='AbortError'?'Generazione annullata.':error.message,error.name!=='AbortError');}finally{busy=false;$('generate').disabled=false;$('cancel').disabled=true;$('language').disabled=false;$('decklist_input').readOnly=false;$('file').disabled=false;$('project-file').disabled=false;}
}
async function download(){
  if(!items.length)return;
  try{const blob=await createPdf(items,settings());window.saveAs(blob,`proxy-${$('language').value}.pdf`);status('PDF generato. Stampa al 100% per conservare le dimensioni.');}
  catch(error){status(error.message,true);}
}
$('cancel').addEventListener('click',()=>controller?.abort());
$('generate').addEventListener('click',generate);$('download').addEventListener('click',download);
$('language').addEventListener('change',invalidate);$('decklist_input').addEventListener('input',invalidate);
$('file').addEventListener('change',async e=>{const f=e.target.files[0];if(f){$('decklist_input').value=await f.text();invalidate();}});
$('decklist_input').addEventListener('dragover',e=>e.preventDefault());
$('decklist_input').addEventListener('drop',async e=>{e.preventDefault();if(busy)return;const f=e.dataTransfer.files[0];if(f){$('decklist_input').value+=await f.text();invalidate();}});
try{
  [dictionary,overrides]=await Promise.all(['dictionaries/tcg.json','text-overrides/cards.json'].map(async url=>(await fetch(appUrl(url))).json()));
  for(const lang of dictionary.languages){const option=document.createElement('option');option.value=lang;option.textContent=lang==='it'?'Italiano':'English';$('language').append(option);}
  $('language').value='it';await repository.init();
  editor=setupEditor({getItems:()=>items,getLanguage:()=>$('language').value,getDictionary:()=>dictionary,getDecklist:()=>$('decklist_input').value,
    onApply:async(index,card)=>{const selected=items[index].render.artworkId;const artworkId=card.artworks.some(x=>x.id===selected)?selected:card.artworks[0].id;const render=await renderCard(card,{artworkId});items[index]={...items[index],card,render};refreshPreview();},
    onImport:async project=>{
      if(busy)throw new Error('Attendi il completamento della generazione');
      const imported=[];
      for(const item of project.items){const render=await renderCard(item.card,{artworkId:item.artworkId});imported.push({...item,render});}
      items=imported;$('language').value=project.language;$('decklist_input').value=project.decklist||'';refreshPreview();
    }
  });$('generate').disabled=false;status('Pronto. Carte TCG in italiano e inglese.');
}catch(error){status(error.message,true);}
