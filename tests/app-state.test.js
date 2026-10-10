import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAppStore,selectApp} from '../app/js/state/app.js';
import {createApplication} from '../app/js/application.js';
import {appError,errorIssue,rowError,deckErrors} from '../app/js/errors.js';
import {formatError} from '../app/js/ui/i18n.js';
import {exportProject} from '../app/js/model/project.js';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const dictionary=read('app/dictionaries/tcg.json'),messages=read('app/dictionaries/ui.json').messages;
const canonical=read('app/fixtures/cards-en.json').find(card=>card.id===46986414);
const translated=read('app/fixtures/cards-it.json').find(card=>card.id===46986414);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const renderResult=id=>({url:'blob:test-'+id,pngBytes:new Uint8Array([1,2,3]),diagnostics:[],artworkId:id});
function fixture(options={}){
 const store=createAppStore({decklist:'3 Dark Magician',uiLanguage:'it'});store.dispatch({type:'READY'});
 const requests=[],downloads=[],renders=[];
 const repository=options.repository||{async find(entry,signal,language){requests.push({entry,signal,language});return {en:canonical,localized:language==='en'?null:translated};}};
 const renderCard=options.renderCard||async function(card,{artworkId}){renders.push(card);return renderResult(artworkId);};
 const createPdf=options.createPdf||async function(items,settings){return {items,settings};};
 const application=createApplication({store,repository,renderCard,createPdf,saveAs:(blob,name)=>downloads.push({blob,name}),resources:{dictionary}});
 return {store,application,requests,downloads,renders};
}
test('Print starts in English for every store regardless of UI language',()=>{
 for(const language of ['en','it','de','es','fr'])assert.equal(createAppStore({uiLanguage:language}).getState().input.language,'en');
});
test('UI language changes preserve generated data, readiness and export eligibility',async()=>{
 const {store,application}=fixture();await application.generate();
 const before=store.getState();store.dispatch({type:'UI_LANGUAGE',language:'de'});
 const after=store.getState();assert.equal(after.items,before.items);assert.equal(after.generatedInput,before.generatedInput);
 assert.equal(after.notice,before.notice);assert.equal(after.input.language,'en');assert.equal(selectApp(after).canDownload,true);
});
test('Source changes invalidate edit/export; restoring matching input restores readiness',async()=>{
 const {store,application}=fixture();await application.generate();const items=store.getState().items;
 application.setDecklist('1 Dark Magician');assert.equal(selectApp(store.getState()).stale,true);
 assert.equal(selectApp(store.getState()).canDownload,false);assert.equal(selectApp(store.getState()).canEdit,false);
 application.setDecklist('3 Dark Magician');assert.equal(selectApp(store.getState()).stale,false);assert.equal(selectApp(store.getState()).canDownload,true);
 application.setLanguage('it');assert.equal(selectApp(store.getState()).stale,true);
 application.setLanguage('en');assert.equal(store.getState().items,items);assert.equal(selectApp(store.getState()).canDownload,true);
});
test('Paper settings alter shared geometry without invalidating card data',async()=>{
 const {store,application}=fixture();await application.generate();const items=store.getState().items;
 store.dispatch({type:'SETTINGS',value:{paper:'A4',scale:.5,margin:10*72/25.4,gap:2*72/25.4}});
 const model=selectApp(store.getState());assert.equal(model.items,items);assert.equal(model.stale,false);
 assert.ok(Math.abs(model.layout.width*25.4/72-29.5)<.0001);assert.equal(model.canDownload,true);
 store.dispatch({type:'SETTINGS',value:{...store.getState().settings,margin:300*72/25.4}});
 assert.equal(selectApp(store.getState()).canDownload,false);assert.equal(selectApp(store.getState()).canEdit,true);
 assert.equal(selectApp(store.getState()).layoutError.code,'error.printFit');
});
test('Operations lock card inputs and reject completions or progress from older jobs',()=>{
 const {store}=fixture();store.dispatch({type:'BEGIN',id:1,kind:'generate'});
 const input=store.getState().input;store.dispatch({type:'INPUT',value:{decklist:'late edit'}});assert.equal(store.getState().input,input);
 store.dispatch({type:'FINISH',id:1,notice:{key:'cancelled'}});store.dispatch({type:'BEGIN',id:2,kind:'generate'});
 const current=store.getState();store.dispatch({type:'PROGRESS',id:1,current:99,total:99});store.dispatch({type:'FINISH',id:1,error:appError('error.network','late error')});
 assert.equal(store.getState(),current);assert.equal(selectApp(current).canGenerate,false);
});
test('Generation captures print language and reports progress independently of UI changes',async()=>{
 const wait=deferred(),calls=[];
 const {store,application}=fixture({repository:{async find(entry,signal,language){calls.push(language);await wait.promise;return {en:canonical,localized:translated};}}});
 application.setLanguage('it');const pending=application.generate();store.dispatch({type:'UI_LANGUAGE',language:'fr'});
 assert.equal(store.getState().operation.current,1);assert.equal(store.getState().operation.completed,0);
 wait.resolve();await pending;assert.deepEqual(calls,['it']);assert.equal(store.getState().items[0].card.text.name,'Mago Nero');
 assert.equal(store.getState().notice.args.language,'IT');assert.equal(store.getState().uiLanguage,'fr');
});
test('Cancellation allows a new generation; a late old request cannot clear its result',async()=>{
 const wait=deferred();let calls=0;
 const {store,application}=fixture({repository:{async find(){if(++calls===1)await wait.promise;return {en:canonical,localized:null};}}});
 const old=application.generate();application.cancel();assert.equal(store.getState().notice.key,'cancelled');assert.equal(selectApp(store.getState()).canGenerate,true);
 application.setDecklist('1 Dark Magician');await application.generate();const completed=store.getState();wait.resolve();await old;
 assert.equal(store.getState(),completed);assert.equal(completed.items[0].entry.quantity,1);
});
test('Cancelling while rendering also rejects the late render result',async()=>{
 const wait=deferred(),started=deferred();
 const {store,application}=fixture({renderCard:async(card,{artworkId})=>{started.resolve();await wait.promise;return renderResult(artworkId);}});
 const pending=application.generate();await started.promise;application.cancel();wait.resolve();await pending;
 assert.equal(store.getState().items.length,0);assert.equal(store.getState().notice.key,'cancelled');
});
test('Older file reads cannot overwrite typing or a newer selected file',async()=>{
 const {store,application}=fixture(),first=deferred(),second=deferred();
 const old=application.importDeck({text:()=>first.promise});application.setDecklist('typed deck');first.resolve('old file');await old;
 assert.equal(store.getState().input.decklist,'typed deck');
 const a=deferred();const firstFile=application.importDeck({text:()=>a.promise});
 const secondFile=application.importDeck({text:()=>second.promise});second.resolve('new file');await secondFile;a.resolve('older file');await firstFile;
 assert.equal(store.getState().input.decklist,'new file');
});
test('Starting an operation invalidates a pending deck file read even after completion',async()=>{
 const {store,application}=fixture(),wait=deferred();const file=application.importDeck({text:()=>wait.promise});
 await application.generate();wait.resolve('late file');await file;assert.equal(store.getState().input.decklist,'3 Dark Magician');
});
test('PDF uses a snapshot of settings and language and blocks conflicting operations',async()=>{
 const wait=deferred(),calls=[];
 const {store,application,downloads}=fixture({createPdf:async(items,settings)=>{calls.push({items,settings});await wait.promise;return 'pdf';}});
 await application.generate();const original=store.getState(),pending=application.download();
 assert.equal(selectApp(store.getState()).canEdit,false);assert.equal(selectApp(store.getState()).canGenerate,false);
 application.setLanguage('it');store.dispatch({type:'UI_LANGUAGE',language:'de'});
 store.dispatch({type:'SETTINGS',value:{...original.settings,scale:.5}});
 await application.generate();assert.equal(store.getState().operation.kind,'pdf');wait.resolve();await pending;
 assert.equal(downloads[0].name,'proxy-en.pdf');assert.deepEqual(calls[0].settings,original.settings);
 assert.equal(calls[0].items,original.items);assert.equal(store.getState().notice.key,'pdfReady');
});
test('PDF failures retain the valid preview and allow retry',async()=>{
 const {store,application}=fixture({createPdf:async()=>{throw appError('error.png','cannot export');}});
 await application.generate();const items=store.getState().items;await application.download();
 assert.equal(store.getState().items,items);assert.equal(selectApp(store.getState()).canDownload,true);assert.equal(store.getState().notice.error.code,'error.png');
});
test('Editing replaces only the selected item and rejects an obsolete editor session',async()=>{
 const {store,application}=fixture();await application.generate();const original=store.getState().items[0],edited=structuredClone(original.card);
 edited.text.name='Edited name';await application.applyEdit(0,edited,original);
 assert.equal(store.getState().items[0].card.text.name,'Edited name');assert.equal(selectApp(store.getState()).canDownload,true);
 await assert.rejects(application.applyEdit(0,edited,original),error=>error.code==='error.busy');
});
test('Hidden project import retains language, content and local artwork; bad JSON preserves cards',async()=>{
 const {store,application}=fixture();application.setLanguage('it');await application.generate();
 const project=exportProject(store.getState().items,'it','1 Dark Magician');
 const custom=project.items[0].card;custom.artworks=[{id:0,image_url_cropped:'data:image/png;base64,AA=='}];project.items[0].artworkId=0;
 await application.importProject({size:100,text:async()=>JSON.stringify(project)});
 assert.equal(store.getState().input.language,'it');assert.equal(store.getState().input.decklist,'1 Dark Magician');
 assert.equal(store.getState().items[0].render.artworkId,0);const items=store.getState().items;
 await application.importProject({size:1,text:async()=>'{'});assert.equal(store.getState().items,items);assert.equal(store.getState().notice.error.code,'error.project');
});
test('Validation and remote failures retain structured row/card context',async()=>{
 const {store,application}=fixture({repository:{async find(){throw appError('error.network','diagnostic wording');}}});
 application.setDecklist('0 Dark Magician\n0 Dark Hole');await application.generate();
 assert.equal(store.getState().notice.error.code,'error.list');assert.equal(store.getState().notice.error.params.errors.length,2);
 application.setDecklist('1 Dark Magician');await application.generate();
 const error=store.getState().notice.error;assert.equal(error.code,'error.rowCard');assert.equal(error.params.line,1);assert.equal(error.params.card,'Dark Magician');assert.equal(error.params.error.code,'error.network');
 assert.equal(selectApp(store.getState()).canGenerate,true);assert.equal(selectApp(store.getState()).canDownload,false);
});
test('Structured errors translate all contexts without matching diagnostic strings',()=>{
 for(const language of ['it','en','de','es','fr']){
  const translate=(key,params={})=>messages[language][key].replace(/[{]([a-zA-Z0-9_]+)[}]/g,(_,name)=>String(params[name]??''));
  const error=rowError(appError('error.missingText','a completely different diagnostic',{id:'46986414',section:'monsterEffect',language:'fr'}),{line:2,query:'Dark Magician'});
  const text=formatError(error,translate);assert.ok(text.includes(messages[language].description));assert.ok(text.includes(messages[language]['language.fr']));
  assert.ok(text.includes('Dark Magician'));assert.equal(text.includes('diagnostic'),false);
  const list=deckErrors([{line:1,code:'error.invalidQuantity',message:'new diagnostic'}]);assert.ok(formatError(list,translate).includes(messages[language]['error.invalidQuantity']));
 }
 assert.deepEqual(errorIssue(new Error('Vendor detail')),{code:'external',params:{message:'Vendor detail'}});
});

test('Native DOMException numeric codes remain external errors and cannot break translations',async()=>{
 const native=new DOMException('A network error occurred.','NetworkError');
 assert.equal(typeof native.code,'number');
 assert.deepEqual(errorIssue(native),{code:'external',params:{message:native.message}});
 assert.equal(formatError(rowError(native,{line:1,query:'Dark Magician'}),(key,args)=>key==='error.rowCard'?args.message:key),native.message);
 const {store,application}=fixture({renderCard:async()=>{throw native;}});
 await application.generate();assert.equal(store.getState().operation,null);assert.equal(selectApp(store.getState()).canGenerate,true);
 assert.equal(store.getState().notice.error.params.error.code,'external');
});

