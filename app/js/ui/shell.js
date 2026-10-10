import {initUi,applyUiLanguage,persistUiLanguage} from './i18n.js';
export function setupShell({getLanguage,onLanguageChange}){
 const mobileLayout=matchMedia('(max-width:760px)'),howto=document.querySelector('.howto'),mobileHelp=document.getElementById('mobile-howto');
 function positionHelp(){
  const focus=document.activeElement,restoreFocus=howto.contains(focus);
  (mobileLayout.matches?mobileHelp:document.querySelector('.settings')).append(howto);mobileHelp.hidden=!mobileLayout.matches;
  if(restoreFocus)focus.focus({preventScroll:true});
 }
 mobileLayout.addEventListener('change',positionHelp);positionHelp();
 return {init:()=>initUi({getLanguage,onChange:language=>{onLanguageChange(language);persistUiLanguage(language);}}),
  update:()=>applyUiLanguage(getLanguage(),{persist:false})};
}
