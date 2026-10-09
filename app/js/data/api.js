import {appUrl} from '../paths.js';
const endpoint='https://db.ygoprodeck.com/api/v7/cardinfo.php';
export class CardRepository {
  constructor(){this.memory=new Map();this.fixtures=null;}
  async init(){
    const [en,it]=await Promise.all(['en','it'].map(async lang=>{
      const r=await fetch(appUrl(`fixtures/cards-${lang}.json`));if(!r.ok)throw new Error('Fixture locale non disponibile');return r.json();
    }));this.fixtures={en,it};
  }
  readCache(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
  async request(query,language,signal){
    const key=`ygoprodeck:v7:${language}:${query.kind}:${query.query}`;
    if(this.memory.has(key))return this.memory.get(key);
    const match=this.fixtures[language].find(c=>query.kind==='id'?String(c.id).padStart(8,'0')===query.query:c.name.toLowerCase()===query.query.toLowerCase());
    let card=match||this.readCache(key);
    if(!card){
      const url=new URL(endpoint);url.searchParams.set(query.kind==='id'?'id':'name',query.query);
      if(language==='it')url.searchParams.set('language','it');
      const response=await fetch(url,{signal});const data=await response.json();
      if(!response.ok||!data.data?.length)throw new Error(data.error||'Carta non trovata');
      card=data.data[0];try{localStorage.setItem(key,JSON.stringify(card));}catch{}
    }
    this.memory.set(key,card);return card;
  }
  async find(query,signal){
    let en;
    try{en=await this.request(query,'en',signal);}catch(englishError){
      signal?.throwIfAborted();if(query.kind==='id')throw englishError;
      const localized=await this.request(query,'it',signal);
      en=await this.request({kind:'id',query:String(localized.id).padStart(8,'0')},'en',signal);
    }
    let it=null;
    try{it=await this.request({kind:'id',query:String(en.id).padStart(8,'0')},'it',signal);}catch{signal?.throwIfAborted();}
    return {en,it};
  }
}
