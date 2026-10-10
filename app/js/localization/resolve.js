import {appError} from '../errors.js';
export function localizeCard(card,language,dictionary,overrides={}) {
  if(!dictionary.languages.includes(language)) throw appError('error.label','Lingua non supportata');
  const result={...card,language,text:{},diagnostics:[]};
  const original=card.texts[language]||{};
  const correction=overrides.cards?.[card.passcode]?.[language]||{};
  const required=card.scale===null?['name','description']:['name','monsterEffect','pendulumEffect'];
  for(const section of required) {
    const override=correction[section];
    const value=typeof override==='string'?override:override?.value||original[section];
    if(!value?.trim()) throw appError('error.missingText',`${card.passcode}: testo ${section} mancante in ${language}`,{id:card.passcode,section,language});
    if(language!=='en' && section!=='name' && !override && value===card.texts.en[section]) {
      throw appError('error.untranslated',`${card.passcode}: sezione ${section} non tradotta in ${language}`,{id:card.passcode,section,language});
    }
    result.text[section]=value;
  }
  const label=(group,key)=>{
    const value=dictionary[group]?.[key]?.[language];
    if(!value)throw appError('error.label',`Dicitura ${group}.${key} mancante in ${language}`,{group,key,language});
    return value;
  };
  result.attributeLabel=label('attributes',card.attribute);
  result.typeLine=card.family==='monster'?[label('races',card.race),...card.mechanics.map(x=>label('mechanics',x))].join('/'):label('families',card.family);
  result.dictionaryVersion=dictionary.version;
  result.overrideVersion=overrides.version||0;
  return result;
}
