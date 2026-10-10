import {parseDecklist} from './decklist/parse.js';
import {normalizeCard} from './model/card.js';
import {localizeCard} from './localization/resolve.js';
import {validateProject} from './model/project.js';
import {selectApp} from './state/app.js';
import {appError,deckErrors,rowError} from './errors.js';

// Own async effects here. Each result must still own its operation before it can commit.
export function createApplication({store,repository,renderCard,createPdf,saveAs,resources}){
 let sequence=0,active=null,fileSequence=0;
 const begin=kind=>{
  if(!selectApp(store.getState()).canGenerate)return null;
  fileSequence++;
  const job={id:++sequence,kind,controller:new AbortController()};
  store.dispatch({type:'BEGIN',id:job.id,kind});active=job;return job;
 };
 const owns=job=>store.getState().operation?.id===job.id;
 const finish=(job,result)=>{
  store.dispatch({type:'FINISH',id:job.id,...result});
  if(active===job)active=null;
 };
 const check=job=>{job.controller.signal.throwIfAborted();if(!owns(job))throw new DOMException('Operation replaced','AbortError');};
 const notice=error=>store.dispatch({type:'NOTICE',notice:{error}});
 function setDecklist(decklist){fileSequence++;store.dispatch({type:'INPUT',value:{decklist}});}
 function setLanguage(language){fileSequence++;store.dispatch({type:'INPUT',value:{language}});}
 async function generate(){
  const job=begin('generate');if(!job)return;
  const source={...store.getState().input},{dictionary,overrides={}}=resources;
  try{
   if(!selectApp(store.getState()).layout)throw selectApp(store.getState()).layoutError;
   const parsed=parseDecklist(source.decklist);
   if(parsed.errors.length)throw deckErrors(parsed.errors);
   if(!parsed.entries.length)throw appError('emptyDeck','Inserisci almeno una carta');
   const items=[];
   for(const [index,entry] of parsed.entries.entries()){
    store.dispatch({type:'PROGRESS',id:job.id,current:index+1,total:parsed.entries.length});
    try{
     check(job);const {en,localized}=await repository.find(entry,job.controller.signal,source.language);check(job);
     const card=localizeCard(normalizeCard(en,localized,source.language),source.language,dictionary,overrides);
     const artwork=card.artworks[entry.variant];
     if(!artwork)throw appError('error.artworkVariant','Variante ['+entry.variant+'] non disponibile');
     const render=await renderCard(card,{artworkId:artwork.id});check(job);items.push({entry,card,render});
     store.dispatch({type:'PROGRESS',id:job.id,current:index+1,total:parsed.entries.length,completed:index+1});
    }catch(error){if(error.name==='AbortError')throw error;throw rowError(error,entry);}
   }
   check(job);finish(job,{items});
  }catch(error){finish(job,error.name==='AbortError'?{notice:{key:'cancelled'}}:{error});}
 }
 function cancel(){
  if(active?.kind!=='generate')return;
  const job=active;job.controller.abort();finish(job,{notice:{key:'cancelled'}});
 }
 async function download(){
  if(!selectApp(store.getState()).canDownload)return;
  const snapshot=store.getState(),job=begin('pdf');if(!job)return;
  try{const blob=await createPdf(snapshot.items,{...snapshot.settings});check(job);
   saveAs(blob,'proxy-'+snapshot.input.language+'.pdf');finish(job,{notice:{key:'pdfReady'}});
  }catch(error){finish(job,{error});}
 }
 async function importDeck(file){
  if(!file||store.getState().operation)return;
  const ticket=++fileSequence,revision=store.getState().inputRevision;
  try{
   const text=await file.text();
   if(ticket===fileSequence&&revision===store.getState().inputRevision&&!store.getState().operation)
    store.dispatch({type:'INPUT',value:{decklist:text}});
  }catch{if(ticket===fileSequence&&revision===store.getState().inputRevision&&!store.getState().operation)
   notice(appError('error.fileRead','Impossibile leggere il file. Riprova.'));}
 }
 async function applyEdit(index,card,original){
  if(!selectApp(store.getState()).canEdit||store.getState().items[index]!==original)
   throw appError('error.busy','Attendi il completamento della generazione');
  const snapshot=store.getState(),job=begin('edit');
  try{
   const selected=original.render.artworkId,artworkId=card.artworks.some(art=>art.id===selected)?selected:card.artworks[0].id;
   const render=await renderCard(card,{artworkId});check(job);
   const items=snapshot.items.map((item,i)=>i===index?{...item,card,render}:item);
   finish(job,{items});
  }catch(error){finish(job,{error});throw error;}
 }
 async function importProject(file){
  const job=begin('import');if(!job)return;
  try{
   if(file.size>20*1024*1024)throw appError('error.projectSize','Progetto troppo grande');
   let project;try{project=JSON.parse(await file.text());}catch{throw appError('error.project','Progetto carta non valido');}
   project=validateProject(project);check(job);const items=[];
   for(const item of project.items){const render=await renderCard(item.card,{artworkId:item.artworkId});check(job);items.push({...item,render});}
   finish(job,{items,input:{language:project.language,decklist:project.decklist||''}});
  }catch(error){finish(job,{error});}
 }
 return {generate,cancel,download,setDecklist,setLanguage,importDeck,applyEdit,importProject};
}
