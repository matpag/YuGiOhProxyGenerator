import {t,errorText} from './i18n.js';
const $=id=>document.getElementById(id);
export function setupPreview({onEdit}){
 let model,view='cards',pageIndex=0,previousItems=null;
 const enlarge=index=>{
  const item=model.items[index];if(!item)return;
  $('zoom-title').textContent=item.card.text.name;$('zoom-image').src=item.render.url;$('zoom-image').alt=item.card.text.name;$('zoom').showModal();
 };
 $('close-zoom').addEventListener('click',()=>$('zoom').close());
 function refreshCards(){
  const figures=[...$('preview').children];
  model.items.forEach((item,index)=>{
   let figure=figures[index];
   if(!figure){
    figure=document.createElement('figure');const img=document.createElement('img'),caption=document.createElement('figcaption'),edit=document.createElement('button');
    img.width=240;img.height=350;img.tabIndex=0;img.setAttribute('role','button');
    img.addEventListener('click',()=>enlarge(index));img.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();enlarge(index);}});
    edit.className='secondary';edit.addEventListener('click',()=>{if(model.canEdit)onEdit(index);});
    figure.append(img,caption,edit);$('preview').append(figure);
   }
   const img=figure.querySelector('img'),edit=figure.querySelector('button');
   if(img.getAttribute('src')!==item.render.url)img.src=item.render.url;
   img.alt=item.card.text.name;img.setAttribute('aria-label',t('zoomCard',{name:item.card.text.name}));
   edit.textContent=t('editCard');edit.disabled=!model.canEdit;
   figure.querySelector('figcaption').textContent=item.entry.quantity+' × '+item.card.text.name+(item.render.diagnostics.length?' · '+t('smallText'):'');
  });
  for(const figure of figures.slice(model.items.length))figure.remove();
 }
 function refreshGeometry(){
  if(!model)return;
  const {items,layout,pages,count,stale}=model,layoutError=model.layoutError?errorText(model.layoutError):null;
  $('preview-summary').textContent=items.length?t('previewSummary',{count,unique:items.length,pages:pages||'—',language:items[0].card.language.toUpperCase()})+(layoutError?' · '+layoutError:''):'';
  $('preview-summary').classList.toggle('error',Boolean(layoutError));
  document.querySelector('.preview-section').hidden=!items.length;
  document.querySelector('.preview-section').classList.toggle('is-stale',stale);$('preview-stale').hidden=!stale;
  $('page-preview').hidden=view!=='pages';$('preview').hidden=view!=='cards';
  $('view-cards').setAttribute('aria-pressed',String(view==='cards'));$('view-pages').setAttribute('aria-pressed',String(view==='pages'));
  pageIndex=Math.max(0,Math.min(pageIndex,pages-1));
  $('previous-page').disabled=!layout||pageIndex===0;$('next-page').disabled=!layout||pageIndex>=pages-1;
  $('page-number').textContent=pages?t('pageNumber',{current:pageIndex+1,total:pages}):'';
  $('paper-preview').replaceChildren();
  if(layout&&view==='pages'&&items.length){
   const paper=$('paper-preview');paper.style.aspectRatio=layout.size[0]+' / '+layout.size[1];
   let itemStart=0;const first=pageIndex*layout.capacity,last=first+layout.capacity;
   for(const item of items){
    const itemEnd=itemStart+item.entry.quantity;
    for(let index=Math.max(first,itemStart);index<Math.min(last,itemEnd);index++){
     const position=index-first,img=document.createElement('img');img.src=item.render.url;img.alt=item.card.text.name;
     img.style.width=100*layout.width/layout.size[0]+'%';img.style.height=100*layout.height/layout.size[1]+'%';
     img.style.left=100*(layout.margin+(position%layout.columns)*(layout.width+layout.gap))/layout.size[0]+'%';
     img.style.top=100*(layout.margin+Math.floor(position/layout.columns)*(layout.height+layout.gap))/layout.size[1]+'%';paper.append(img);
    }
    itemStart=itemEnd;if(itemStart>=last)break;
   }
  }
 }
 $('view-cards').addEventListener('click',()=>{view='cards';refreshGeometry();});
 $('view-pages').addEventListener('click',()=>{view='pages';refreshGeometry();});
 $('previous-page').addEventListener('click',()=>{pageIndex--;refreshGeometry();});
 $('next-page').addEventListener('click',()=>{pageIndex++;refreshGeometry();});
 return {update(value){
  model=value;if(model.items!==previousItems){pageIndex=0;previousItems=model.items;}
  refreshCards();refreshGeometry();
 }};
}
