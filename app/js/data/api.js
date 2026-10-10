import {appError} from '../errors.js';
import {appUrl} from '../paths.js';
import {CARD_LANGUAGES} from '../localization/languages.js';
const endpoint='https://db.ygoprodeck.com/api/v7/cardinfo.php';
export class CardRepository {
  constructor(){this.memory=new Map();this.fixtures=null;}
  async init(){
    const values=await Promise.all(['en','it','de','fr'].map(async lang=>{
      const r=await fetch(appUrl(`fixtures/cards-${lang}.json`));if(!r.ok)throw appError('error.network','Servizio dati non disponibile. Controlla la connessione e riprova.');return [lang,await r.json()];
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
      const response=await fetch(url,{signal});const data=await response.json();
      if(!response.ok||!data.data?.length)throw appError(response.status===400?'error.cardNotFound':'error.network',response.status===400?'Carta non trovata':'Servizio dati non disponibile. Controlla la connessione e riprova.');
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
