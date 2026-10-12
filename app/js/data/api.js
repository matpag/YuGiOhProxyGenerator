import {appError} from '../errors.js';
import {appUrl} from '../paths.js';
import {CARD_LANGUAGES} from '../localization/languages.js';
const endpoint='https://db.ygoprodeck.com/api/v7/cardinfo.php';
const networkMessage='Servizio dati non disponibile. Controlla la connessione e riprova.';
async function readJson(url,{signal,allowNotFound=false}={}){
  try{
    const response=await fetch(url,{signal});
    // Card lookups use HTTP 400 for a missing card. Other HTTP failures must
    // not be parsed as API data (CDNs can return HTML maintenance/error pages).
    if(!response.ok&&!(allowNotFound&&response.status===400))throw new Error(`HTTP ${response.status}`);
    const data=await response.json();signal?.throwIfAborted();return {response,data};
  }catch(error){
    signal?.throwIfAborted();
    if(error?.name==='AbortError')throw error;
    throw appError('error.network',networkMessage,{},error);
  }
}
export class CardRepository {
  constructor(){this.memory=new Map();this.fixtures=null;}
  async init(){
    const values=await Promise.all(['en','it','de','fr'].map(async lang=>{
      const {data}=await readJson(appUrl(`fixtures/cards-${lang}.json`));
      if(!Array.isArray(data))throw appError('error.network',networkMessage);
      return [lang,data];
    }));this.fixtures=Object.fromEntries(values);
  }
  readCache(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
  async request(query,language,signal){
    if(!CARD_LANGUAGES.includes(language))throw appError('error.label','Lingua non supportata');
    const key=`ygoprodeck:v7:${language}:${query.kind}:${query.query}`;
    if(this.memory.has(key))return this.memory.get(key);
    const match=(this.fixtures[language]||[]).find(c=>query.kind==='id'?String(c.id).padStart(8,'0')===query.query:c.name.toLowerCase()===query.query.toLowerCase());
    let card=match||this.readCache(key);
    if(!card){
      const url=new URL(endpoint);url.searchParams.set(query.kind==='id'?'id':'name',query.query);
      if(language!=='en')url.searchParams.set('language',language);
      const {response,data}=await readJson(url,{signal,allowNotFound:true});
      if(response.status===400&&typeof data?.error==='string')throw appError('error.cardNotFound','Carta non trovata');
      if(!response.ok||!Array.isArray(data?.data)||!data.data.length||!data.data[0]||typeof data.data[0]!=='object')throw appError('error.network',networkMessage);
      card=data.data[0];
      try{localStorage.setItem(key,JSON.stringify(card));}catch{}
    }
    this.memory.set(key,card);return card;
  }
  async find(query,signal,language='it'){
    // English names/IDs remain canonical. Fetch only the chosen print translation.
    const en=await this.request(query,'en',signal);
    let localized=null;
    if(language!=='en')try{
      localized=await this.request({kind:'id',query:String(en.id).padStart(8,'0')},language,signal);
    }catch(error){
      if(error.code==='error.cardNotFound')throw appError('error.translationMissing',`Traduzione non disponibile per ${String(en.id).padStart(8,'0')} in ${language}`,{id:String(en.id).padStart(8,'0'),language});
      throw error;
    }
    return {en,localized};
  }
}
