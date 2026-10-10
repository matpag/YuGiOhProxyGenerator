import {appError,errorIssue} from '../errors.js';
import {appUrl} from '../paths.js';
export const UI_LANGUAGES=['en','it','de','es','fr'];
const nativeNames={en:'English',it:'Italiano',de:'Deutsch',es:'Español',fr:'Français'};
let messages={},languageProvider=()=> 'en';
export function detectUiLanguage(preferences=[]){
 return preferences.map(value=>String(value).toLowerCase().split(/[-_]/)[0]).find(value=>UI_LANGUAGES.includes(value))||'en';
}
export const getUiLanguage=()=>languageProvider();
export function t(key,params={}){
 const language=getUiLanguage();
 return (messages[language]?.[key]||messages.en?.[key]||key).replace(/[{]([a-zA-Z0-9_]+)[}]/g,(_,name)=>String(params[name]??''));
}
export function refreshFileLabels(){
 document.querySelectorAll('[data-file-name]').forEach(element=>{
  const input=document.getElementById(element.dataset.fileName);element.textContent=input.files[0]?.name||t('noFile');
 });
}
export function persistUiLanguage(language){try{localStorage.setItem('proxy-ui-language',language);}catch{}}
export function applyUiLanguage(language,{persist=true}={}){
 if(!UI_LANGUAGES.includes(language))return;
 document.documentElement.lang=language;
 document.querySelectorAll('[data-i18n]').forEach(element=>element.textContent=t(element.dataset.i18n));
 document.querySelectorAll('[data-i18n-linked]').forEach(element=>{
  const link=element.querySelector('a');if(!link)return;
  const label=link.textContent,message=t(element.dataset.i18nLinked),index=message.indexOf(label);
  if(index>=0)element.replaceChildren(message.slice(0,index),link,message.slice(index+label.length));
 });
 document.querySelectorAll('[data-i18n-aria]').forEach(element=>element.setAttribute('aria-label',t(element.dataset.i18nAria)));
 document.querySelectorAll('[data-ui-language]').forEach(button=>{
  button.setAttribute('aria-pressed',String(button.dataset.uiLanguage===language));
  button.title=t('uiLanguage')+': '+nativeNames[button.dataset.uiLanguage];button.setAttribute('aria-label',button.title);
 });
 if(persist)persistUiLanguage(language);refreshFileLabels();
}
export async function initUi({getLanguage,onChange}){
 const response=await fetch(appUrl('dictionaries/ui.json'));if(!response.ok)throw appError('error.uiTranslations','Interface translations unavailable');
 ({messages}=await response.json());languageProvider=getLanguage;
 let saved;try{saved=localStorage.getItem('proxy-ui-language');}catch{}
 const language=UI_LANGUAGES.includes(saved)?saved:detectUiLanguage(navigator.languages?.length?navigator.languages:[navigator.language]);
 document.querySelectorAll('[data-ui-language]').forEach(button=>button.addEventListener('click',()=>onChange(button.dataset.uiLanguage)));
 document.querySelectorAll('[data-file-input]').forEach(button=>{
  const input=document.getElementById(button.dataset.fileInput);
  button.addEventListener('click',()=>input.click());input.addEventListener('change',refreshFileLabels);
 });
 return language;
}
export function formatError(error,translate=t){
 const issue=errorIssue(error);
 if(issue.code==='external')return issue.params.message==='Failed to fetch'?translate('error.network'):issue.params.message;
 if(issue.code==='error.list')return issue.params.errors.map(value=>formatError(value,translate)).join('; ');
 const params={...issue.params};
 if(params.error){params.message=formatError(params.error,translate);delete params.error;}
 if(params.language)params.language=translate('language.'+params.language);
 if(params.section)params.section=translate(({name:'name',description:'description',monsterEffect:'description',pendulumEffect:'pendulumText'})[params.section]||params.section);
 const text=translate(issue.code,params);return text===issue.code?issue.fallback||text:text;
}
export const errorText=error=>formatError(error);
