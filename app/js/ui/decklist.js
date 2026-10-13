import {t,refreshFileLabels} from './i18n.js';
const $=id=>document.getElementById(id);
export function setupDecklist({onInput,onLanguage,onGenerate,onCancel,onImport}){
 const input=$('decklist_input'),language=$('language'),file=$('file'),clear=$('clear-decklist');
 const updateClear=()=>{clear.disabled=input.readOnly||(!input.value&&!file.files.length);};
 clear.addEventListener('click',()=>{
  if(input.readOnly)return;
  input.value='';file.value='';refreshFileLabels();onInput('');updateClear();input.focus();
 });
 input.addEventListener('input',()=>{file.value='';refreshFileLabels();updateClear();onInput(input.value);});
 language.addEventListener('change',()=>onLanguage(language.value));
 $('generate').addEventListener('click',onGenerate);$('cancel').addEventListener('click',onCancel);
 file.addEventListener('change',()=>{updateClear();onImport(file.files[0]);});
 input.addEventListener('dragover',event=>event.preventDefault());
 input.addEventListener('drop',event=>{
  event.preventDefault();if(input.readOnly)return;
  const selected=event.dataTransfer.files[0];if(selected){file.files=event.dataTransfer.files;refreshFileLabels();updateClear();onImport(selected);}
 });
 return {
  read:()=>input.value,
  setLanguages(languages){language.replaceChildren(...languages.map(value=>{const option=document.createElement('option');option.value=value;return option;}));},
  update({state,busy,generating,canGenerate}){
   if(input.value!==state.input.decklist)input.value=state.input.decklist;
   language.value=state.input.language;
   for(const option of language.options)option.textContent=t('language.'+option.value);
   input.readOnly=busy;language.disabled=busy;file.disabled=busy;document.querySelector('[data-file-input=file]').disabled=busy;
   clear.title=t('clearDecklist');updateClear();
   $('generate').disabled=!canGenerate;$('cancel').hidden=!generating;$('cancel').disabled=!generating;
   const progress=$('generation-progress');progress.hidden=!generating;progress.max=state.operation?.total||1;progress.value=state.operation?.completed||0;
  }
 };
}
