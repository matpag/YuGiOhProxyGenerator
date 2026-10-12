import {initUi,applyUiLanguage,persistUiLanguage} from './i18n.js';
export function setupShell({getLanguage,onLanguageChange}){
 return {init:()=>initUi({getLanguage,onChange:language=>{onLanguageChange(language);persistUiLanguage(language);}}),
  update:()=>applyUiLanguage(getLanguage(),{persist:false})};
}
