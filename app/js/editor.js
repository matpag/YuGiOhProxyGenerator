import {editCard,exportProject,validateProject} from './model/project.js';
import {errorText,t,getUiLanguage,refreshFileLabels} from './ui/i18n.js';
const $=id=>document.getElementById(id);
export function setupEditor({getItems,getLanguage,getDictionary,getDecklist,onApply,onImport,renderPreview}){
 let index=0,artwork=null,lastError=null,timer,revision=0,previewStatus=null,transientUrl=null;
 const showError=message=>{lastError=message;$('edit-error').textContent=message?errorText(message):'';};
 const paintPreviewStatus=()=>{$('edit-preview-status').textContent=previewStatus?t(previewStatus):'';};
 const values=()=>({name:$('edit-name').value,description:$('edit-description').value,layout:$('edit-layout').value,attribute:$('edit-attribute').value,race:$('edit-race').value,atk:$('edit-atk').value,def:$('edit-def').value,level:$('edit-level').value,pendulum:$('edit-pendulum').checked,scale:$('edit-scale').value,pendulumText:$('edit-pendulum-text').value,artwork});
 const selectedArtwork=(card,item)=>card.artworks.some(x=>x.id===item.render.artworkId)?item.render.artworkId:card.artworks[0].id;
 function refreshFields(){
  const layout=$('edit-layout').value,monster=!['Spell','Trap'].includes(layout),link=layout==='Link';
  $('monster-fields').hidden=!monster;
  $('monster-fields').querySelectorAll('input,select').forEach(input=>input.disabled=!monster);
  $('edit-def').hidden=!monster||link;$('edit-def').disabled=!monster||link;$('def-label').hidden=!monster||link;
  $('pendulum-toggle').hidden=!monster||link;$('edit-pendulum').disabled=!monster||link;
  if(!monster||link)$('edit-pendulum').checked=false;
  const pendulum=monster&&!link&&$('edit-pendulum').checked;
  $('pendulum-fields').hidden=!pendulum;$('pendulum-fields').querySelectorAll('input,textarea').forEach(input=>input.disabled=!pendulum);
  $('level-label').dataset.i18n=layout==='Xyz'?'monsterRank':link?'monsterLink':'monsterLevel';
  $('level-label').textContent=t($('level-label').dataset.i18n);
 }
 async function updatePreview(ticket){
  const item=getItems()[index];if(!item||!$('editor').open||!$('editor-preview-details').open||ticket!==revision)return;
  try{
   if(!$('editor-form').checkValidity())throw new Error('Incomplete form');
   const card=editCard(item.card,values(),getLanguage(),getDictionary());
   previewStatus='previewUpdating';paintPreviewStatus();
   const render=await renderPreview(card,selectedArtwork(card,item));
   if(ticket!==revision||!$('editor').open){if(render.transient)URL.revokeObjectURL(render.url);return;}
   const previous=transientUrl;transientUrl=render.transient?render.url:null;
   $('edit-preview-img').src=render.url;if(previous)URL.revokeObjectURL(previous);$('edit-preview-img').alt=card.text.name;previewStatus=null;paintPreviewStatus();
  }catch{
   if(ticket===revision&&$('editor').open){previewStatus='previewInvalid';paintPreviewStatus();}
  }
 }
 function schedulePreview(){
  refreshFields();clearTimeout(timer);const ticket=++revision;
  timer=setTimeout(()=>updatePreview(ticket),450);
 }
 function open(i){
  const item=getItems()[i];if(!item)return;
  index=i;artwork=null;revision++;clearTimeout(timer);const card=item.card;
  $('edit-name').value=card.text.name;$('edit-description').value=card.text.monsterEffect||card.text.description||'';
  $('edit-layout').value=card.layout;$('edit-attribute').value=card.family==='monster'?card.attribute:'dark';$('edit-race').value=card.family==='monster'?card.race:'spellcaster';
  $('edit-atk').value=card.atk??'0';$('edit-def').value=card.def??'0';$('edit-level').value=card.linkValue??card.rank??card.level??0;
  $('edit-pendulum').checked=card.scale!==null;$('edit-scale').value=card.scale??4;$('edit-pendulum-text').value=card.text.pendulumEffect||'';
  $('edit-artwork').value='';refreshFileLabels();showError(null);refreshFields();
  $('edit-preview-img').src=item.render.url;$('edit-preview-img').alt=card.text.name;previewStatus=null;paintPreviewStatus();
  $('editor-preview-details').open=matchMedia('(min-width:761px)').matches;
  $('editor').showModal();document.querySelector('.editor-body').scrollTop=0;
 }
 $('editor-form').addEventListener('input',event=>{if(event.target.id!=='edit-artwork')schedulePreview();});
 $('editor-form').addEventListener('change',event=>{if(event.target.id!=='edit-artwork')schedulePreview();});
 $('editor-preview-details').addEventListener('toggle',()=>{if($('editor-preview-details').open&&$('editor').open)schedulePreview();});
 $('editor').addEventListener('close',()=>{
  revision++;clearTimeout(timer);$('edit-preview-img').removeAttribute('src');
  if(transientUrl)URL.revokeObjectURL(transientUrl);transientUrl=null;
 });
 $('edit-artwork').addEventListener('change',async e=>{
  const file=e.target.files[0];artwork=null;if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){showError('Usa PNG, JPEG o WebP fino a 5 MB.');return;}
  const ticket=++revision;$('apply-edit').disabled=true;
  try{
   const result=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
   if(ticket===revision&&$('editor').open){artwork=result;showError(null);schedulePreview();}
  }catch{showError('Impossibile leggere questa immagine.');}
  finally{$('apply-edit').disabled=false;}
 });
 $('editor-form').addEventListener('submit',async e=>{
  e.preventDefault();$('apply-edit').disabled=true;revision++;clearTimeout(timer);
  try{
   const item=getItems()[index];if(!item){$('editor').close();return;}
   const card=editCard(item.card,values(),getLanguage(),getDictionary());await onApply(index,card);$('editor').close();
  }catch(error){showError(error.message);}
  finally{$('apply-edit').disabled=false;}
 });
 for(const id of ['close-editor','close-editor-top'])$(id).addEventListener('click',()=>$('editor').close());
 $('save-project').addEventListener('click',()=>{const project=exportProject(getItems(),getLanguage(),getDecklist());window.saveAs(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'proxy-project.json');});
 $('project-file').addEventListener('change',async e=>{
  try{const file=e.target.files[0];artwork=null;if(!file)return;if(file.size>20*1024*1024)throw new Error('Progetto troppo grande');await onImport(validateProject(JSON.parse(await file.text())));}
  catch(error){$('status').textContent=error.message;$('status').classList.add('error');}
  finally{e.target.value='';}
 });
 function refreshLabels(){
  const dictionary=getDictionary(),uiLanguage=getUiLanguage();
  for(const [group,id] of [['attributes','edit-attribute'],['races','edit-race']]){
   const value=$(id).value;$(id).replaceChildren();
   for(const [code,labels] of Object.entries(dictionary[group])){
    if(group==='attributes'&&['spell','trap'].includes(code))continue;
    const option=document.createElement('option');option.value=code;option.textContent=labels[uiLanguage];$(id).append(option);
   }
   if(value)$(id).value=value;
  }
  for(const option of $('edit-layout').options){
   const key=option.value.toLowerCase();option.textContent=dictionary.mechanics[key]?.[uiLanguage]||dictionary.families[key]?.[uiLanguage];
  }
  refreshFields();showError(lastError);paintPreviewStatus();
 }
 refreshLabels();return {open,refreshLabels};
}
