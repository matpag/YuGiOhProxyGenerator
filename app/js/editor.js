import {editCard,exportProject,validateProject} from './model/project.js';
const $=id=>document.getElementById(id);
export function setupEditor({getItems,getLanguage,getDictionary,getDecklist,onApply,onImport}){
 let index=0,artwork=null;
 const open=i=>{
   index=i;artwork=null;const item=getItems()[i],card=item.card;
   $('edit-name').value=card.text.name;$('edit-description').value=card.text.monsterEffect||card.text.description||'';
   $('edit-layout').value=card.layout;$('edit-attribute').value=card.attribute;$('edit-race').value=card.race;
   $('edit-atk').value=card.atk??'0';$('edit-def').value=card.def??'0';$('edit-level').value=card.linkValue??card.rank??card.level??0;
   $('edit-pendulum').checked=card.scale!==null;$('edit-scale').value=card.scale??4;$('edit-pendulum-text').value=card.text.pendulumEffect||'';
   $('edit-artwork').value='';$('edit-error').textContent='';$('editor').showModal();
 };
 $('edit-artwork').addEventListener('change',async e=>{
   const file=e.target.files[0];artwork=null;if(!file)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){$('edit-error').textContent='Usa PNG, JPEG o WebP fino a 5 MB.';return;}
   $('apply-edit').disabled=true;try{artwork=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});}catch{$('edit-error').textContent='Impossibile leggere questa immagine.';}finally{$('apply-edit').disabled=false;}
 });
 $('editor-form').addEventListener('submit',async e=>{
   e.preventDefault();$('apply-edit').disabled=true;
   try{
     const values={name:$('edit-name').value,description:$('edit-description').value,layout:$('edit-layout').value,attribute:$('edit-attribute').value,race:$('edit-race').value,atk:$('edit-atk').value,def:$('edit-def').value,level:$('edit-level').value,pendulum:$('edit-pendulum').checked,scale:$('edit-scale').value,pendulumText:$('edit-pendulum-text').value,artwork};
     const card=editCard(getItems()[index].card,values,getLanguage(),getDictionary());await onApply(index,card);$('editor').close();
   }catch(error){$('edit-error').textContent=error.message;}finally{$('apply-edit').disabled=false;}
 });
 $('close-editor').addEventListener('click',()=>$('editor').close());
 $('save-project').addEventListener('click',()=>{const project=exportProject(getItems(),getLanguage(),getDecklist());window.saveAs(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'proxy-project.json');});
 $('project-file').addEventListener('change',async e=>{
   try{const file=e.target.files[0];artwork=null;if(!file)return;if(file.size>20*1024*1024)throw new Error('Progetto troppo grande');await onImport(validateProject(JSON.parse(await file.text())));}
   catch(error){$('status').textContent=error.message;$('status').classList.add('error');}
   finally{e.target.value='';}
 });
 const dictionary=getDictionary();
 for(const [group,id] of [['attributes','edit-attribute'],['races','edit-race']])for(const [code,labels] of Object.entries(dictionary[group])){
   if(group==='attributes'&&['spell','trap'].includes(code))continue;
   const option=document.createElement('option');option.value=code;option.textContent=labels.it;$ (id).append(option);
 }
 return {open};
}
