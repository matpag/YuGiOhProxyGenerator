import {pageLayout} from '../printing/pdf.js';
import {t,getUiLanguage,errorText} from './i18n.js';
const $=id=>document.getElementById(id);
export function setupPreview({getItems,getSettings,isStale,isDownloading,onEdit}){
 let view='cards',pageIndex=0,previewVisible=false,downloadVisible=false;
 const total=()=>getItems().reduce((n,item)=>n+item.entry.quantity,0);
 const shortcut=()=>{$('download-shortcut').hidden=!previewVisible||downloadVisible||isStale()||$('download').disabled;};
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){if(entry.target.id==='download-actions')downloadVisible=entry.isIntersecting;else previewVisible=entry.isIntersecting;}
  shortcut();
 });
 observer.observe(document.querySelector('.preview-section'));observer.observe($('download-actions'));
 const enlarge=item=>{$('zoom-title').textContent=item.card.text.name;$('zoom-image').src=item.render.url;$('zoom-image').alt=item.card.text.name;$('zoom').showModal();};
 $('close-zoom').addEventListener('click',()=>$('zoom').close());
 function refreshLabels(){
  $('preview').querySelectorAll('figure').forEach((figure,index)=>{
   const item=getItems()[index];if(!item)return;
   figure.querySelector('button').textContent=t('editCard');
   figure.querySelector('img').setAttribute('aria-label',t('zoomCard',{name:item.card.text.name}));
   figure.querySelector('figcaption').textContent=`${item.entry.quantity} × ${item.card.text.name}${item.render.diagnostics.length?' · '+t('smallText'):''}`;
  });
  refreshGeometry();
 }
 function refreshGeometry(){
  let layout,layoutError;
  try{
   layout=pageLayout(getSettings());
   const number=value=>new Intl.NumberFormat(getUiLanguage(),{maximumFractionDigits:1}).format(value);
   $('print-summary').textContent=t('layoutSummary',{width:number(layout.width*25.4/72),height:number(layout.height*25.4/72),capacity:layout.capacity,paper:$('paper_size').value});
   $('print-summary').classList.remove('error');
  }catch(error){
   // Invalid settings must block the same geometry that PDF export would reject.
   layoutError=errorText(error.message);$('print-summary').textContent=layoutError;
   $('print-summary').classList.add('error');
  }
  const items=getItems(),pages=layout?Math.ceil(total()/layout.capacity):0;
  $('preview-summary').textContent=items.length?t('previewSummary',{count:total(),unique:items.length,pages:pages||'—',language:items[0].card.language.toUpperCase()})+(layoutError?' · '+layoutError:''):'';
  $('preview-summary').classList.toggle('error',Boolean(layoutError));
  $('download').disabled=!items.length||isStale()||!layout||isDownloading();
  document.querySelector('.preview-section').classList.toggle('is-stale',isStale());
  $('preview-stale').hidden=!isStale();
  $('preview').querySelectorAll('button').forEach(button=>button.disabled=isStale()||isDownloading());
  $('page-preview').hidden=view!=='pages';$('preview').hidden=view!=='cards';
  $('view-cards').setAttribute('aria-pressed',String(view==='cards'));$('view-pages').setAttribute('aria-pressed',String(view==='pages'));
  pageIndex=Math.max(0,Math.min(pageIndex,pages-1));
  $('previous-page').disabled=!layout||pageIndex===0;$('next-page').disabled=!layout||pageIndex>=pages-1;
  $('page-number').textContent=pages?t('pageNumber',{current:pageIndex+1,total:pages}):'';
  $('paper-preview').replaceChildren();
  if(layout&&view==='pages'&&items.length){
   const paper=$('paper-preview');paper.style.aspectRatio=`${layout.size[0]} / ${layout.size[1]}`;
   let itemStart=0;const first=pageIndex*layout.capacity,last=first+layout.capacity;
   for(const item of items){
    const itemEnd=itemStart+item.entry.quantity;
    for(let index=Math.max(first,itemStart);index<Math.min(last,itemEnd);index++){
     const position=index-first,img=document.createElement('img');img.src=item.render.url;img.alt=item.card.text.name;
     img.style.width=`${100*layout.width/layout.size[0]}%`;img.style.height=`${100*layout.height/layout.size[1]}%`;
     img.style.left=`${100*(layout.margin+(position%layout.columns)*(layout.width+layout.gap))/layout.size[0]}%`;
     img.style.top=`${100*(layout.margin+Math.floor(position/layout.columns)*(layout.height+layout.gap))/layout.size[1]}%`;
     paper.append(img);
    }
    itemStart=itemEnd;if(itemStart>=last)break;
   }
  }
  shortcut();return Boolean(layout);
 }
 function render(){
  pageIndex=0;$('preview').replaceChildren();
  for(const [index,item] of getItems().entries()){
   const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption'),edit=document.createElement('button');
   img.src=item.render.url;img.alt=item.card.text.name;img.width=240;img.height=350;img.tabIndex=0;img.setAttribute('role','button');
   img.addEventListener('click',()=>enlarge(item));img.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();enlarge(item);}});
   edit.className='secondary';edit.addEventListener('click',()=>{if(!isStale()&&!isDownloading())onEdit(index);});
   figure.append(img,caption,edit);$('preview').append(figure);
  }
  const empty=!getItems().length;document.querySelector('.preview-section').hidden=empty;$('download-actions').hidden=empty;
  refreshLabels();
 }
 $('view-cards').addEventListener('click',()=>{view='cards';refreshGeometry();});
 $('view-pages').addEventListener('click',()=>{view='pages';refreshGeometry();});
 $('previous-page').addEventListener('click',()=>{pageIndex--;refreshGeometry();});
 $('next-page').addEventListener('click',()=>{pageIndex++;refreshGeometry();});
 return {render,refreshLabels,refreshGeometry};
}
