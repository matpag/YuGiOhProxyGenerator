import {editCard} from './model/project.js';
import {appError} from './errors.js';
import {errorText,t,getUiLanguage,refreshFileLabels} from './ui/i18n.js';
const $=id=>document.getElementById(id);
const fields={name:'edit-name',description:'edit-description',layout:'edit-layout',attribute:'edit-attribute',race:'edit-race',
 atk:'edit-atk',def:'edit-def',level:'edit-level',pendulum:'edit-pendulum',scale:'edit-scale',pendulumText:'edit-pendulum-text'};
export function setupEditor({getItems,getLanguage,getDictionary,onApply,renderPreview}){
 let session=null,model,timer,transientUrl=null;
 const showError=error=>{if(session)session.error=error;$('edit-error').textContent=error?errorText(error):'';};
 const paintPreviewStatus=()=>{$('edit-preview-status').textContent=session?.previewStatus?t(session.previewStatus):'';};
 const paintBusy=()=>{$('apply-edit').disabled=Boolean(session&&(session.readingArtwork||session.saving||!model?.canEdit));};
 function refreshFields(){
  const layout=session?.draft.layout||$('edit-layout').value,monster=!['Spell','Trap'].includes(layout),link=layout==='Link';
  $('monster-fields').hidden=!monster;$('monster-fields').querySelectorAll('input,select').forEach(input=>input.disabled=!monster);
  $('edit-def').hidden=!monster||link;$('edit-def').disabled=!monster||link;$('def-label').hidden=!monster||link;
  $('pendulum-toggle').hidden=!monster||link;$('edit-pendulum').disabled=!monster||link;
  if(!monster||link){if(session)session.draft.pendulum=false;$('edit-pendulum').checked=false;}
  const pendulum=monster&&!link&&Boolean(session?.draft.pendulum);
  $('pendulum-fields').hidden=!pendulum;$('pendulum-fields').querySelectorAll('input,textarea').forEach(input=>input.disabled=!pendulum);
  $('level-label').dataset.i18n=layout==='Xyz'?'monsterRank':link?'monsterLink':'monsterLevel';
  $('level-label').textContent=t($('level-label').dataset.i18n);
 }
 const current=(target,revision)=>session===target&&$('editor').open&&target.revision===revision;
 function releasePreview(){if(transientUrl)URL.revokeObjectURL(transientUrl);transientUrl=null;}
 async function updatePreview(target,revision){
  if(!current(target,revision)||!$('editor-preview-details').open)return;
  try{
   if(!$('editor-form').checkValidity())throw appError('error.requiredText','Nome e testo sono obbligatori');
   const card=editCard(target.original.card,{...target.draft},target.language,getDictionary());
   target.previewStatus='previewUpdating';paintPreviewStatus();
   const artworkId=card.artworks.some(art=>art.id===target.original.render.artworkId)?target.original.render.artworkId:card.artworks[0].id;
   const render=await renderPreview(card,artworkId);
   if(!current(target,revision)||!$('editor-preview-details').open){if(render.transient)URL.revokeObjectURL(render.url);return;}
   releasePreview();transientUrl=render.transient?render.url:null;
   $('edit-preview-img').src=render.url;$('edit-preview-img').alt=card.text.name;target.previewStatus=null;paintPreviewStatus();
  }catch{if(current(target,revision)){target.previewStatus='previewInvalid';paintPreviewStatus();}}
 }
 function schedulePreview(){
  if(!session)return;
  refreshFields();clearTimeout(timer);const target=session,revision=++target.revision;
  if($('editor-preview-details').open)timer=setTimeout(()=>updatePreview(target,revision),450);
 }
 function open(index){
  const item=getItems()[index];if(!item||!model?.canEdit)return;
  clearTimeout(timer);releasePreview();const card=item.card;
  session={index,original:item,language:getLanguage(),revision:0,artworkRevision:0,readingArtwork:false,saving:false,error:null,previewStatus:null,
   draft:{name:card.text.name,description:card.text.monsterEffect||card.text.description||'',layout:card.layout,
    attribute:card.family==='monster'?card.attribute:'dark',race:card.family==='monster'?card.race:'spellcaster',
    atk:String(card.atk??'0'),def:String(card.def??'0'),level:String(card.linkValue??card.rank??card.level??0),
    pendulum:card.scale!==null,scale:String(card.scale??4),pendulumText:card.text.pendulumEffect||'',artwork:null}};
  for(const [key,id] of Object.entries(fields)){
   if(key==='pendulum')$(id).checked=session.draft[key];else $(id).value=session.draft[key];
  }
  $('edit-artwork').value='';refreshFileLabels();showError(null);refreshFields();paintBusy();
  $('edit-preview-img').src=item.render.url;$('edit-preview-img').alt=card.text.name;paintPreviewStatus();
  $('editor-preview-details').open=matchMedia('(min-width:761px)').matches;
  $('editor').showModal();document.querySelector('.editor-body').scrollTop=0;
 }
 function change(event){
  if(!session)return;
  const entry=Object.entries(fields).find(([,id])=>id===event.target.id);if(!entry)return;
  session.draft[entry[0]]=entry[0]==='pendulum'?event.target.checked:event.target.value;schedulePreview();
 }
 $('editor-form').addEventListener('input',change);$('editor-form').addEventListener('change',change);
 $('editor-preview-details').addEventListener('toggle',()=>{
  if(session&&$('editor').open){clearTimeout(timer);session.revision++;if($('editor-preview-details').open)schedulePreview();}
 });
 $('editor').addEventListener('close',()=>{
  clearTimeout(timer);if(session){session.revision++;session.artworkRevision++;}session=null;
  $('edit-preview-img').removeAttribute('src');releasePreview();paintBusy();
 });
 $('edit-artwork').addEventListener('change',async event=>{
  if(!session)return;const target=session,file=event.target.files[0],ticket=++target.artworkRevision;
  target.draft.artwork=null;target.readingArtwork=false;
  if(!file){schedulePreview();paintBusy();return;}
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){
   showError(appError('error.artworkFile','Usa PNG, JPEG o WebP fino a 5 MB.'));schedulePreview();paintBusy();return;
  }
  target.readingArtwork=true;paintBusy();
  try{
   const artwork=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.onabort=reject;reader.readAsDataURL(file);
   });
   if(session===target&&ticket===target.artworkRevision&&$('editor').open){target.draft.artwork=artwork;showError(null);schedulePreview();}
  }catch{if(session===target&&ticket===target.artworkRevision)showError(appError('error.artworkRead','Impossibile leggere questa immagine.'));}
  finally{if(session===target&&ticket===target.artworkRevision){target.readingArtwork=false;paintBusy();}}
 });
 $('editor-form').addEventListener('submit',async event=>{
  event.preventDefault();const target=session;if(!target||target.saving||target.readingArtwork||!model?.canEdit)return;
  target.saving=true;target.revision++;clearTimeout(timer);paintBusy();
  try{
   const card=editCard(target.original.card,{...target.draft},target.language,getDictionary());
   await onApply(target.index,card,target.original);if(session===target)$('editor').close();
  }catch(error){if(session===target)showError(error);}
  finally{if(session===target){target.saving=false;paintBusy();}}
 });
 for(const id of ['close-editor','close-editor-top'])$(id).addEventListener('click',()=>$('editor').close());
 function refreshLabels(){
  const dictionary=getDictionary(),language=getUiLanguage();
  for(const [group,id] of [['attributes','edit-attribute'],['races','edit-race']]){
   const value=session?.draft[group==='attributes'?'attribute':'race']||$(id).value;$(id).replaceChildren();
   for(const [code,labels] of Object.entries(dictionary[group])){
    if(group==='attributes'&&['spell','trap'].includes(code))continue;
    const option=document.createElement('option');option.value=code;option.textContent=labels[language];$(id).append(option);
   }
   if(value)$(id).value=value;
  }
  for(const option of $('edit-layout').options){
   const key=option.value.toLowerCase();option.textContent=dictionary.mechanics[key]?.[language]||dictionary.families[key]?.[language];
  }
  refreshFields();showError(session?.error||null);paintPreviewStatus();
 }
 refreshLabels();return {open,refreshLabels,update(value){model=value;paintBusy();}};
}
