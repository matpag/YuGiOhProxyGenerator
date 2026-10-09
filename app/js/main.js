import {appUrl} from './paths.js';
import {initUi,t,errorText,refreshFileLabels} from './ui/i18n.js';
import {setupPreview} from './ui/preview.js';
import {setupEditor} from './editor.js';
import {parseDecklist} from './decklist/parse.js';
import {normalizeCard} from './model/card.js';
import {localizeCard} from './localization/resolve.js';
import {CardRepository} from './data/api.js';
import {renderCard} from './rendering/cardmaker.js';
import {createPdf,pageLayout} from './printing/pdf.js';
const $=id=>document.getElementById(id);
const repository=new CardRepository();
let dictionary,overrides,items=[],busy=false,stale=false,pdfBusy=false,editor,preview,controller;
let statusValue={key:'loading'},statusError=false;
const paintStatus=()=>{
 $('status').textContent=typeof statusValue==='string'?errorText(statusValue):t(statusValue.key,statusValue.args);
 $('status').classList.toggle('error',statusError);
};
const status=(value,error=false)=>{statusValue=value;statusError=error;paintStatus();};
const measurement=id=>$(id).validity.valid?$(id).valueAsNumber:NaN;
const settings=()=>({paper:$('paper_size').value,scale:measurement('card_scale')/100,gap:measurement('margin_cards')*72/25.4,margin:measurement('margin_document')*72/25.4});
function refreshUi(){
 [...$('language').options].forEach(option=>option.textContent=t('language.'+option.value));
 preview?.refreshLabels();editor?.refreshLabels();paintStatus();
 if(pdfBusy){$('download').textContent=t('pdfPreparing');$('download').disabled=true;}
}
window.addEventListener('ui-language-change',refreshUi);
function invalidate(){
 stale=items.length>0;$('download').disabled=true;$('save-project').disabled=true;
 preview?.refreshGeometry();status({key:stale?'stalePreview':'ready'});
}
function refreshPreview(){
 stale=false;preview.render();$('save-project').disabled=!items.length;
 status({key:'cardsReady',args:{count:items.reduce((n,x)=>n+x.entry.quantity,0),language:$('language').value.toUpperCase()}});
}
async function generate(){
 if(busy||pdfBusy)return;
 busy=true;controller=new AbortController();items=[];stale=false;preview.render();
 $('cancel').hidden=false;$('cancel').disabled=false;$('language').disabled=true;$('decklist_input').readOnly=true;
 $('file').disabled=true;document.querySelector('[data-file-input=file]').disabled=true;$('project-file').disabled=true;
 $('generate').disabled=true;$('save-project').disabled=true;$('generation-progress').hidden=false;$('generation-progress').value=0;
 try{
  pageLayout(settings());
  const parsed=parseDecklist($('decklist_input').value);
  if(parsed.errors.length)throw new Error(parsed.errors.map(e=>`Riga ${e.line}: ${e.message}`).join('; '));
  if(!parsed.entries.length)throw new Error('Inserisci almeno una carta');
  $('generation-progress').max=parsed.entries.length;
  const prepared=[];
  for(const [index,entry] of parsed.entries.entries()){
   status({key:'preparing',args:{current:index+1,total:parsed.entries.length}});
   try{
    controller.signal.throwIfAborted();const {en,localized}=await repository.find(entry,controller.signal,$('language').value);
    const card=localizeCard(normalizeCard(en,localized,$('language').value),$('language').value,dictionary,overrides),artwork=card.artworks[entry.variant];
    if(!artwork)throw new Error(`Variante [${entry.variant}] non disponibile`);
    const render=await renderCard(card,{artworkId:artwork.id});controller.signal.throwIfAborted();
    prepared.push({entry,card,render});$('generation-progress').value=index+1;
   }catch(error){
    if(error.name==='AbortError')throw error;
    throw new Error(`Riga ${entry.line} (${entry.query}): ${error.message}`);
   }
  }
  items=prepared;refreshPreview();
 }catch(error){
  items=[];stale=false;preview.render();status(error.name==='AbortError'?{key:'cancelled'}:error.message,error.name!=='AbortError');
 }finally{
  busy=false;$('generate').disabled=false;$('cancel').disabled=true;$('cancel').hidden=true;$('generation-progress').hidden=true;
  $('language').disabled=false;$('decklist_input').readOnly=false;$('file').disabled=false;
  document.querySelector('[data-file-input=file]').disabled=false;$('project-file').disabled=false;
 }
}
async function download(){
 if(!items.length||stale||pdfBusy)return;
 const language=$('language').value;
 pdfBusy=true;$('download').disabled=true;$('download').textContent=t('pdfPreparing');$('generate').disabled=true;preview.refreshGeometry();
 try{const blob=await createPdf(items,settings());window.saveAs(blob,`proxy-${language}.pdf`);status({key:'pdfReady'});}
 catch(error){status(error.message,true);}
 finally{pdfBusy=false;$('download').textContent=t('download');$('generate').disabled=false;preview.refreshGeometry();}
}
async function importFile(file){
 if(!file||busy||pdfBusy)return;
 try{$('decklist_input').value=await file.text();invalidate();refreshFileLabels();}
 catch{status({key:'error.fileRead'},true);}
}
$('cancel').addEventListener('click',()=>controller?.abort());
$('generate').addEventListener('click',generate);$('download').addEventListener('click',download);
$('language').addEventListener('change',invalidate);
$('decklist_input').addEventListener('input',()=>{$('file').value='';refreshFileLabels();invalidate();});
$('file').addEventListener('change',e=>importFile(e.target.files[0]));
$('decklist_input').addEventListener('dragover',e=>e.preventDefault());
$('decklist_input').addEventListener('drop',async e=>{
 e.preventDefault();if(busy||pdfBusy)return;
 const file=e.dataTransfer.files[0];if(file){$('file').files=e.dataTransfer.files;await importFile(file);}
});
for(const id of ['paper_size','card_scale','margin_cards','margin_document'])$(id).addEventListener('input',()=>preview?.refreshGeometry());
try{
 await initUi();
 [dictionary,overrides]=await Promise.all(['dictionaries/tcg.json','text-overrides/cards.json'].map(async url=>(await fetch(appUrl(url))).json()));
 for(const lang of dictionary.languages){const option=document.createElement('option');option.value=lang;option.textContent=t('language.'+lang);$('language').append(option);}
 $('language').value='en';await repository.init();
 preview=setupPreview({getItems:()=>items,getSettings:settings,isStale:()=>stale,isDownloading:()=>pdfBusy,onEdit:index=>editor.open(index)});
 editor=setupEditor({getItems:()=>stale?[]:items,getLanguage:()=>$('language').value,getDictionary:()=>dictionary,getDecklist:()=>$('decklist_input').value,
  renderPreview:(card,artworkId)=>renderCard(card,{artworkId,cacheResult:false}),
  onApply:async(index,card)=>{
   const selected=items[index].render.artworkId,artworkId=card.artworks.some(x=>x.id===selected)?selected:card.artworks[0].id;
   const render=await renderCard(card,{artworkId});items[index]={...items[index],card,render};refreshPreview();
  },
  onImport:async project=>{
   if(busy||pdfBusy)throw new Error('Attendi il completamento della generazione');
   const imported=[];for(const item of project.items){const render=await renderCard(item.card,{artworkId:item.artworkId});imported.push({...item,render});}
   items=imported;$('language').value=project.language;$('decklist_input').value=project.decklist||'';refreshPreview();
  }
 });
 preview.refreshGeometry();$('generate').disabled=false;status({key:'ready'});
}catch(error){status(error.message,true);}
