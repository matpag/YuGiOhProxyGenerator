import {t} from './i18n.js';
import {exportProject} from '../model/project.js';
const $=id=>document.getElementById(id);
export function setupDownload({onDownload,onImport,getState,saveAs}){
 let model,previewVisible=false,downloadVisible=false;
 const shortcut=()=>{$('download-shortcut').hidden=!previewVisible||downloadVisible||!model?.canDownload;};
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){if(entry.target.id==='download-actions')downloadVisible=entry.isIntersecting;else previewVisible=entry.isIntersecting;}
  shortcut();
 });
 observer.observe(document.querySelector('.preview-section'));observer.observe($('download-actions'));
 $('download').addEventListener('click',onDownload);
 $('save-project').addEventListener('click',()=>{
  if(!model?.canSaveProject)return;
  const state=getState(),project=exportProject(state.items,state.input.language,state.input.decklist);
  saveAs(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'proxy-project.json');
 });
 $('project-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{await onImport(file);}finally{event.target.value='';}
 });
 return {update(value){
  model=value;$('download-actions').hidden=!model.items.length;
  $('download').disabled=!model.canDownload;$('download').textContent=t(model.downloading?'pdfPreparing':'download');
  $('save-project').disabled=!model.canSaveProject;$('project-file').disabled=model.busy;shortcut();
 }};
}
