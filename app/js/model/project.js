import {CARD_LANGUAGES} from '../localization/languages.js';
const layouts=['Normal','Effect','Spell','Trap','Fusion','Ritual','Synchro','Xyz','Link'];
export function exportProject(items,language,decklist){return {projectVersion:1,language,decklist,items:items.map(({entry,card,render})=>({entry,card,artworkId:render.artworkId}))};}
export function validateProject(project){
 if(project?.projectVersion!==1||!CARD_LANGUAGES.includes(project.language)||!Array.isArray(project.items)||!project.items.length||project.items.length>200)throw new Error('Progetto carta non valido');
 for(const item of project.items){
  const c=item.card,e=item.entry;
  if(!c||c.language!==project.language||!/^\d{8}$/.test(c.passcode)||!layouts.includes(c.layout)||!Array.isArray(c.artworks)||!c.artworks.length||!c.text?.name||!Number.isSafeInteger(e?.quantity)||e.quantity<1||e.quantity>999)throw new Error('Carta o quantità del progetto non valida');
  for(const art of c.artworks){
   const url=art.image_url_cropped;
   if(typeof url!=='string'||(!url.startsWith('https://images.ygoprodeck.com/images/cards_cropped/')&&!/^data:image\/(png|jpeg|webp);base64,/.test(url)))throw new Error('Riferimento artwork non valido');
  }
 }
 return project;
}
export function editCard(original,values,language,dictionary){
 const card=structuredClone(original);
 if(!values.name.trim()||!values.description.trim())throw new Error('Nome e testo sono obbligatori');
 if(!layouts.includes(values.layout))throw new Error('Layout non supportato');
 const stat=raw=>raw.trim()==='?'?'?':/^\d+$/.test(raw.trim())&&Number(raw)<=99999?Number(raw):(()=>{throw new Error('Le statistiche richiedono un numero oppure ?')})();
 const level=Number(values.level);
 if(!Number.isInteger(level)||level<0||level>13)throw new Error('Livello, rango o valore Link non valido');
 card.layout=values.layout;card.frame=values.layout.toLowerCase();card.family=['Spell','Trap'].includes(values.layout)?values.layout.toLowerCase():'monster';
 card.attribute=card.family==='monster'?values.attribute:card.family;
 card.race=card.family==='monster'?values.race:original.family===card.family?original.race:'normal';
 card.icon=card.family!=='monster'&&original.family===card.family?original.icon:'None';
 card.mechanics=card.family==='monster'?({Normal:['normal'],Effect:['effect'],Fusion:['fusion','effect'],Ritual:['ritual','effect'],Synchro:['synchro','effect'],Xyz:['xyz','effect'],Link:['link','effect']})[values.layout]:[];
 card.scale=values.pendulum?Number(values.scale):null;
 if(card.scale!==null){if(!Number.isInteger(card.scale)||card.scale<0||card.scale>13||!values.pendulumText.trim())throw new Error('Valore e testo Pendulum sono obbligatori');if(card.family!=='monster'||card.layout==='Link')throw new Error('Questo abbinamento Pendulum non è supportato');card.mechanics.splice(card.mechanics.length-1,0,'pendulum');}
 card.level=card.family!=='monster'||['Xyz','Link'].includes(card.layout)?null:level;card.rank=card.layout==='Xyz'?level:null;card.linkValue=card.layout==='Link'?level:null;
 card.atk=card.family==='monster'?stat(values.atk):null;card.def=card.family==='monster'&&card.layout!=='Link'?stat(values.def):null;
 const label=(group,key)=>{const l=dictionary[group]?.[key]?.[language];if(!l)throw new Error('Etichetta non disponibile');return l;};
 card.language=language;card.attributeLabel=label('attributes',card.attribute);
 card.typeLine=card.family==='monster'?[label('races',card.race),...card.mechanics.map(x=>label('mechanics',x))].join('/'):label('families',card.family);
 card.text={name:values.name.trim(),description:values.description.trim(),monsterEffect:values.description.trim(),pendulumEffect:values.pendulumText.trim()};
 card.texts[language]={...card.text};card.source={...card.source,editedLocally:true};
 if(values.artwork){card.artworks=[{id:0,image_url_cropped:values.artwork}];}
 return card;
}
