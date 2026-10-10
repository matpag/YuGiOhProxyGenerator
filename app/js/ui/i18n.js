import {appUrl} from '../paths.js';
export const UI_LANGUAGES=['en','it','de','es','fr'];
const nativeNames={en:'English',it:'Italiano',de:'Deutsch',es:'Español',fr:'Français'};
let messages={},language='en';
export function detectUiLanguage(preferences=[]){
  return preferences.map(value=>String(value).toLowerCase().split(/[-_]/)[0]).find(value=>UI_LANGUAGES.includes(value))||'en';
}
export const getUiLanguage=()=>language;
export function t(key,params={}){
  return (messages[language]?.[key]||messages.en?.[key]||key).replace(/[{]([a-zA-Z0-9_]+)[}]/g,(_,name)=>String(params[name]??''));
}
export function refreshFileLabels(){
  document.querySelectorAll('[data-file-name]').forEach(el=>{
    const input=document.getElementById(el.dataset.fileName);el.textContent=input.files[0]?.name||t('noFile');
  });
}
export function applyUiLanguage(value,{persist=true}={}){
  if(!UI_LANGUAGES.includes(value))return;
  language=value;document.documentElement.lang=language;
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-linked]').forEach(el=>{
    const link=el.querySelector('a');if(!link)return;
    const label=link.textContent,message=t(el.dataset.i18nLinked),index=message.indexOf(label);
    if(index>=0)el.replaceChildren(message.slice(0,index),link,message.slice(index+label.length));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.i18nAria)));
  document.querySelectorAll('[data-ui-language]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.uiLanguage===language));
    button.title=`${t('uiLanguage')}: ${nativeNames[button.dataset.uiLanguage]}`;
    button.setAttribute('aria-label',button.title);
  });
  if(persist)try{localStorage.setItem('proxy-ui-language',language);}catch{}
  refreshFileLabels();
  window.dispatchEvent(new CustomEvent('ui-language-change',{detail:language}));
}
export async function initUi(){
  const response=await fetch(appUrl('dictionaries/ui.json'));if(!response.ok)throw new Error('Interface translations unavailable');
  ({messages}=await response.json());
  let saved;try{saved=localStorage.getItem('proxy-ui-language');}catch{}
  applyUiLanguage(UI_LANGUAGES.includes(saved)?saved:detectUiLanguage(navigator.languages?.length?navigator.languages:[navigator.language]),{persist:false});
  document.querySelectorAll('[data-ui-language]').forEach(button=>button.addEventListener('click',()=>applyUiLanguage(button.dataset.uiLanguage)));
  document.querySelectorAll('[data-file-input]').forEach(button=>{
    const input=document.getElementById(button.dataset.fileInput);
    button.addEventListener('click',()=>input.click());input.addEventListener('change',refreshFileLabels);
  });
}
const exactErrors={
 'Riga non valida':'invalidRow','Quantità o variante non valida':'invalidQuantity','ID carta troppo lungo':'longId',
 'Carta non trovata':'cardNotFound','Servizio dati non disponibile. Controlla la connessione e riprova.':'network','Failed to fetch':'network',
 'Nome e testo sono obbligatori':'requiredText','Le statistiche richiedono un numero oppure ?':'stats','Livello, rango o valore Link non valido':'level',
 'Valore e testo Pendulum sono obbligatori':'pendulumRequired','Questo abbinamento Pendulum non è supportato':'pendulumUnsupported','Etichetta non disponibile':'label',
 'Layout non supportato':'layout','Variante illustrazione non disponibile':'artworkVariant','Usa PNG, JPEG o WebP fino a 5 MB.':'artworkFile',
 'Impossibile leggere questa immagine.':'artworkRead','Formato o misure di stampa non validi':'printSettings','Una carta non entra nel foglio con queste impostazioni':'printFit',
 'Il testo non entra nella carta con un corpo leggibile':'textFit','PNG non esportabile':'png','Servizio illustrazioni non disponibile. Riprova.':'artworkService',
 'Impossibile scaricare l’illustrazione. Controlla la connessione e riprova.':'network','Attendi il completamento della generazione':'busy'
};
export function errorText(error){
  const message=String(error?.message||error),exact=exactErrors[message];if(message==='Inserisci almeno una carta')return t('emptyDeck');if(exact)return t('error.'+exact);
  if(message.includes('; Riga '))return message.split(/; (?=Riga )/).map(errorText).join('; ');
  let m;
  if((m=/^Riga (\d+) \((.*?)\): ([\s\S]*)$/.exec(message)))return t('error.rowCard',{line:m[1],card:m[2],message:errorText(m[3])});
  if((m=/^Riga (\d+): ([\s\S]*)$/.exec(message)))return t('error.row',{line:m[1],message:errorText(m[2])});
  if((m=/^Impossibile scaricare l’illustrazione (\d+)\./.exec(message)))return t('error.artworkDownload',{id:m[1]});
  if((m=/^Illustrazione (\d+) non disponibile/.exec(message)))return t('error.artworkUnavailable',{id:m[1]});
  if((m=/^Illustrazione (\d+): risposta non valida/.exec(message)))return t('error.invalidImage',{id:m[1]});
  if((m=/^Traduzione non disponibile per (\d+) in (\w+)/.exec(message)))return t('error.translationMissing',{id:m[1],language:t('language.'+m[2])});
  if((m=/^(\d+): (?:testo|sezione) (\w+) (mancante|non tradotta) in (\w+)/.exec(message)))return t('error.'+(m[3]==='mancante'?'missingText':'untranslated'),{id:m[1],section:t(({name:'name',description:'description',monsterEffect:'description',pendulumEffect:'pendulumText'})[m[2]]||m[2]),language:t('language.'+m[4])});
  if((m=/^Font della carta non disponibile: (.*)/.exec(message)))return t('error.font',{font:m[1]});
  if((m=/^Immagine non caricata: (.*)/.exec(message)))return t('error.image',{url:m[1]});
  if((m=/^Timeout caricamento: (.*)/.exec(message)))return t('error.imageTimeout',{url:m[1]});
  if(/^Layout .* non ancora abilitato|^Frame non supportato/.test(message))return t('error.layout');
  if(/^Variante \[\d+\] non disponibile/.test(message))return t('error.artworkVariant');
  if(/^Dicitura |^Lingua non supportata/.test(message))return t('error.label');
  return message;
}
