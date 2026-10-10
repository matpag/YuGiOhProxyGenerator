import {t,getUiLanguage,errorText} from './i18n.js';
const $=id=>document.getElementById(id);
export function setupPrintSettings({onChange}){
 const measurement=id=>$(id).validity.valid?$(id).valueAsNumber:NaN;
 const read=()=>({paper:$('paper_size').value,scale:measurement('card_scale')/100,
  gap:measurement('margin_cards')*72/25.4,margin:measurement('margin_document')*72/25.4});
 for(const id of ['paper_size','card_scale','margin_cards','margin_document'])$(id).addEventListener('input',()=>onChange(read()));
 return {read,update({state,layout,layoutError}){
  const number=value=>new Intl.NumberFormat(getUiLanguage(),{maximumFractionDigits:1}).format(value);
  $('print-summary').textContent=layout?t('layoutSummary',{width:number(layout.width*25.4/72),height:number(layout.height*25.4/72),capacity:layout.capacity,paper:state.settings.paper}):errorText(layoutError);
  $('print-summary').classList.toggle('error',Boolean(layoutError));
 }};
}
