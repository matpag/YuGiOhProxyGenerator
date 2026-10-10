import {appError} from '../app/js/errors.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeCard} from '../app/js/model/card.js';
import {localizeCard} from '../app/js/localization/resolve.js';
import {detectUiLanguage,UI_LANGUAGES} from '../app/js/ui/i18n.js';
import {CARD_LANGUAGES} from '../app/js/localization/languages.js';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const dictionary=read('app/dictionaries/tcg.json'),ui=read('app/dictionaries/ui.json');
const en=read('app/fixtures/cards-en.json');
test('Browser locale regions, preference order and unsupported fallback',()=>{
 assert.equal(detectUiLanguage(['de-AT']),'de');assert.equal(detectUiLanguage(['es-MX']),'es');
 assert.equal(detectUiLanguage(['pt-BR','fr-CA','en-US']),'fr');assert.equal(detectUiLanguage(['ja-JP']),'en');
});
test('Five complete UI languages are independent from the four API print languages',()=>{
 assert.deepEqual(UI_LANGUAGES,['en','it','de','es','fr']);assert.deepEqual(CARD_LANGUAGES,['en','it','de','fr']);
 const keys=Object.keys(ui.messages.en).sort();
 for(const language of UI_LANGUAGES){
  assert.deepEqual(Object.keys(ui.messages[language]).sort(),keys);
  for(const key of keys){assert.ok(ui.messages[language][key].trim());assert.deepEqual([...ui.messages[language][key].matchAll(/[{]([a-zA-Z0-9_]+)[}]/g)].map(m=>m[1]).sort(),[...ui.messages.en[key].matchAll(/[{]([a-zA-Z0-9_]+)[}]/g)].map(m=>m[1]).sort());}
 }
 const html=fs.readFileSync('app/index.html','utf8');
 for(const match of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g))assert.ok(ui.messages.en[match[1]],match[1]);
 for(const group of ['attributes','races','mechanics','families'])for(const labels of Object.values(dictionary[group]))for(const language of UI_LANGUAGES)assert.ok(labels[language]);
});
test('DE/FR translated data preserves canonical frame and compact localized type line',()=>{
 for(const [language,name,type,attribute] of [['de','Dunkler Magier','Hexer/Normal','FINSTERNIS'],['fr','Magicien Sombre','Magicien/Normal','TÉNÈBRES']]){
  const localized=read(`app/fixtures/cards-${language}.json`).find(c=>c.id===46986414);
  const c=localizeCard(normalizeCard(en.find(c=>c.id===46986414),localized,language),language,dictionary);
  assert.equal(c.text.name,name);assert.equal(c.typeLine,type);assert.equal(c.attributeLabel,attribute);assert.equal(c.layout,'Normal');assert.equal(c.atk,2500);
 }
});
test('Missing or English-only localized sections fail explicitly; Spanish print stays disabled',()=>{
 const canonical=en.find(c=>c.id===16178681);
 for(const language of ['de','fr']){
  const localized=read(`app/fixtures/cards-${language}.json`).find(c=>c.id===canonical.id);
  assert.throws(()=>localizeCard(normalizeCard(canonical,localized,language),language,dictionary),/pendulumEffect non tradotta/);
 }
 assert.throws(()=>localizeCard(normalizeCard(en[0],null,'es'),'es',dictionary),/Lingua non supportata/);
 assert.throws(()=>localizeCard(normalizeCard(en[0],null,'de'),'de',dictionary),/mancante in de/);
});

import {CardRepository} from '../app/js/data/api.js';
test('Missing selected translation identifies the language while preserving a valid English lookup',async()=>{
 const repository=new CardRepository();
 repository.request=async (_query,language)=>{if(language==='en')return {id:46986414};throw appError('error.cardNotFound','Carta non trovata');};
 await assert.rejects(repository.find({kind:'name',query:'Dark Magician'},undefined,'de'),/Traduzione non disponibile per 46986414 in de/);
});
