import {pageLayout} from '../printing/pdf.js';
import {errorIssue} from '../errors.js';
import {CARD_LANGUAGES} from '../localization/languages.js';
const sameInput=(a,b)=>Boolean(a&&b&&a.decklist===b.decklist&&a.language===b.language);
const message=(key,args={})=>({key,args});
export function initialState({decklist='',settings,uiLanguage='en'}={}){
 return {ready:false,input:{decklist,language:'en'},inputRevision:0,uiLanguage,
  settings:settings||{paper:'A4',scale:1,gap:0,margin:7*72/25.4},
  items:[],generatedInput:null,operation:null,notice:message('loading')};
}
export const isStale=state=>state.items.length>0&&!sameInput(state.input,state.generatedInput);
export function reduceApp(state,action){
 switch(action.type){
  case 'UI_LANGUAGE':return state.uiLanguage===action.language?state:{...state,uiLanguage:action.language};
  case 'READY':return {...state,ready:true,notice:message('ready')};
  case 'INPUT':{
   if(state.operation)return state;
   const input={...state.input,...action.value};
   if(!CARD_LANGUAGES.includes(input.language)||sameInput(input,state.input))return state;
   const next={...state,input,inputRevision:state.inputRevision+1};
   return {...next,notice:message(!state.ready?'loading':isStale(next)?'stalePreview':state.items.length?'cardsReady':'ready',
    state.items.length?{count:state.items.reduce((count,item)=>count+item.entry.quantity,0),language:input.language.toUpperCase()}:{})};
  }
  case 'SETTINGS':return {...state,settings:action.value};
  case 'NOTICE':return {...state,notice:action.notice.error?{error:errorIssue(action.notice.error)}:action.notice};
  case 'BEGIN':{
   if(!state.ready||state.operation)return state;
   const generating=action.kind==='generate';
   return {...state,operation:{id:action.id,kind:action.kind,source:{...state.input},current:0,total:1,completed:0},
    ...(generating?{items:[],generatedInput:null}:{})};
  }
  case 'PROGRESS':
   if(state.operation?.id!==action.id)return state;
   return {...state,operation:{...state.operation,current:action.current,total:action.total,completed:action.completed??state.operation.completed},
    notice:message('preparing',{current:action.current,total:action.total})};
  case 'FINISH':{
   if(state.operation?.id!==action.id)return state;
   const source=action.input||state.operation.source;
   if(action.items&&!sameInput(state.input,state.operation.source))return {...state,operation:null};
   const next={...state,operation:null,...(action.items?{items:action.items,generatedInput:{...source},input:{...source}}:{})};
   return {...next,notice:action.error?{error:errorIssue(action.error)}:action.notice||
    (action.items?message('cardsReady',{count:action.items.reduce((count,item)=>count+item.entry.quantity,0),language:source.language.toUpperCase()}):state.notice)};
  }
  default:return state;
 }
}
export function selectApp(state){
 let layout=null,layoutError=null;
 try{layout=pageLayout(state.settings);}catch(error){layoutError=errorIssue(error);}
 const count=state.items.reduce((total,item)=>total+item.entry.quantity,0),stale=isStale(state),busy=Boolean(state.operation);
 return {state,items:state.items,layout,layoutError,count,pages:layout?Math.ceil(count/layout.capacity):0,stale,busy,
  generating:state.operation?.kind==='generate',downloading:state.operation?.kind==='pdf',
  canGenerate:state.ready&&!busy,canEdit:state.ready&&!busy&&!stale&&state.items.length>0,
  canDownload:state.ready&&!busy&&!stale&&state.items.length>0&&Boolean(layout),
  canSaveProject:state.ready&&!busy&&!stale&&state.items.length>0};
}
export function createAppStore(options){
 let state=initialState(options);const listeners=new Set();
 return {getState:()=>state,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  dispatch(action){const next=reduceApp(state,action);if(next===state)return state;
   const previous=state;state=next;for(const listener of listeners)listener(state,previous,action);return state;}};
}
