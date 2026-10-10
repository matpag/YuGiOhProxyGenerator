import {t,errorText} from './i18n.js';
export function setupStatus(){
 const element=document.getElementById('status');
 return {update({state}){
  const notice=state.notice;
  element.textContent=notice.error?errorText(notice.error):t(notice.key,notice.args);
  element.classList.toggle('error',Boolean(notice.error));
 }};
}
