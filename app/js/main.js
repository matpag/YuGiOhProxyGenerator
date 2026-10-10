import {appError} from './errors.js';
import {appUrl} from './paths.js';
import {createAppStore,selectApp} from './state/app.js';
import {createApplication} from './application.js';
import {setupShell} from './ui/shell.js';
import {setupDecklist} from './ui/decklist.js';
import {setupPrintSettings} from './ui/print-settings.js';
import {setupStatus} from './ui/status.js';
import {setupPreview} from './ui/preview.js';
import {setupDownload} from './ui/download.js';
import {setupEditor} from './editor.js';
import {CardRepository} from './data/api.js';
import {renderCard} from './rendering/cardmaker.js';
import {createPdf} from './printing/pdf.js';
let editor;
const deck=setupDecklist({onInput:value=>application.setDecklist(value),onLanguage:value=>application.setLanguage(value),
 onGenerate:()=>application.generate(),onCancel:()=>application.cancel(),onImport:file=>application.importDeck(file)});
const print=setupPrintSettings({onChange:value=>store.dispatch({type:'SETTINGS',value})});
const store=createAppStore({decklist:deck.read(),settings:print.read()});
const resources={dictionary:null,overrides:{}},repository=new CardRepository();
const application=createApplication({store,repository,renderCard,createPdf,resources,saveAs:(...args)=>window.saveAs(...args)});
const shell=setupShell({getLanguage:()=>store.getState().uiLanguage,onLanguageChange:language=>store.dispatch({type:'UI_LANGUAGE',language})});
const status=setupStatus(),preview=setupPreview({onEdit:index=>editor?.open(index)});
const download=setupDownload({onDownload:()=>application.download(),onImport:file=>application.importProject(file),
 getState:store.getState,saveAs:(...args)=>window.saveAs(...args)});
let paintedLanguage=null;
function update(state){
 const model=selectApp(state);
 if(paintedLanguage!==state.uiLanguage){shell.update();paintedLanguage=state.uiLanguage;editor?.refreshLabels();}
 deck.update(model);print.update(model);preview.update(model);download.update(model);status.update(model);editor?.update(model);
}
try{
 const language=await shell.init();store.dispatch({type:'UI_LANGUAGE',language});
 store.subscribe(update);update(store.getState());
 [resources.dictionary,resources.overrides]=await Promise.all(['dictionaries/tcg.json','text-overrides/cards.json'].map(async url=>{
  const response=await fetch(appUrl(url));if(!response.ok)throw appError('error.network','Servizio dati non disponibile. Controlla la connessione e riprova.');return response.json();
 }));
 deck.setLanguages(resources.dictionary.languages);await repository.init();
 editor=setupEditor({getItems:()=>store.getState().items,getLanguage:()=>store.getState().input.language,getDictionary:()=>resources.dictionary,
  renderPreview:(card,artworkId)=>renderCard(card,{artworkId,cacheResult:false}),onApply:(index,card,original)=>application.applyEdit(index,card,original)});
 store.dispatch({type:'READY'});
}catch(error){store.dispatch({type:'NOTICE',notice:{error}});status.update(selectApp(store.getState()));}
