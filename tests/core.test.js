import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDecklist} from '../app/js/decklist/parse.js';
import {normalizeCard} from '../app/js/model/card.js';
import {localizeCard} from '../app/js/localization/resolve.js';
import {pageLayout} from '../app/js/printing/pdf.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const en=read('app/fixtures/cards-en.json'),it=read('app/fixtures/cards-it.json'),dictionary=read('app/dictionaries/tcg.json');
const pair=id=>normalizeCard(en.find(c=>c.id===id),it.find(c=>c.id===id));
test('YDK comments, quantities, names, variants and padded ID survive parsing',()=>{
 const p=parseDecklist('#main\n3 Mago Nero [1]\n1861629\n!side\n// note\n0 Dark Magician');
 assert.deepEqual(p.entries.map(e=>[e.query,e.quantity,e.variant]),[['Mago Nero',3,1],['01861629',1,0]]);assert.equal(p.errors.length,1);
});
test('Italian name and exact localized type line are resolved independently',()=>{
 const c=localizeCard(pair(46986414),'it',dictionary);assert.equal(c.text.name,'Mago Nero');assert.equal(c.typeLine,'Incantatore/Normale');assert.equal(c.atk,2500);assert.equal(c.attributeLabel,'OSCURITÀ');
});
test('ID mismatch is rejected and Link/Xyz do not acquire a level or fake DEF',()=>{
 assert.throws(()=>normalizeCard(en[0],it.find(c=>c.id!==en[0].id)),/ID diversi/);
 const link=pair(1861629),xyz=pair(84013237);assert.equal(link.level,null);assert.equal(link.def,null);assert.equal(link.linkValue,3);assert.equal(localizeCard(link,'it',dictionary).typeLine,'Cyberso/Link/Effetto');assert.equal(xyz.level,null);assert.equal(xyz.rank,4);
});
test('Untranslated Italian Pendulum is rejected until its own section is overridden',()=>{
 const c=pair(16178681);assert.throws(()=>localizeCard(c,'it',dictionary),/pendulumEffect non tradotta/);
 const resolved=localizeCard(c,'it',dictionary,{version:2,cards:{'16178681':{it:{pendulumEffect:{value:'Testo italiano verificato per questa sezione.'}}}}});
 assert.equal(resolved.text.pendulumEffect,'Testo italiano verificato per questa sezione.');assert.match(resolved.text.monsterEffect,/avversario/);
});
test('A4 places nine true-size cards; impossible geometry cannot export',()=>{
 const l=pageLayout({paper:'A4',scale:1,margin:20,gap:0});assert.equal(l.capacity,9);assert.ok(Math.abs(l.width*25.4/72-59)<1e-8);assert.ok(Math.abs(l.height*25.4/72-86)<1e-8);
 assert.throws(()=>pageLayout({paper:'A4',scale:1,margin:300,gap:0}),/non entra/);assert.throws(()=>pageLayout({paper:'A4',scale:0,margin:20,gap:0}),/non validi/);
});
import {editCard,exportProject,validateProject} from '../app/js/model/project.js';
test('Local editing preserves the API model and survives project serialization',()=>{
 const original=localizeCard(pair(46986414),'it',dictionary);
 const edited=editCard(original,{name:'Mago di prova',description:'Testo di prova.',layout:'Effect',attribute:'dark',race:'spellcaster',atk:'?',def:'2000',level:'7',pendulum:false,scale:'4',pendulumText:'',artwork:null},'it',dictionary);
 assert.equal(original.text.name,'Mago Nero');assert.equal(edited.text.name,'Mago di prova');assert.equal(edited.atk,'?');assert.equal(edited.typeLine,'Incantatore/Effetto');
 const serialized=JSON.parse(JSON.stringify(exportProject([{entry:{quantity:3},card:edited,render:{artworkId:46986414}}],'it','3 Mago Nero')));
 assert.equal(validateProject(serialized).items[0].artworkId,46986414);
 serialized.language='en';assert.throws(()=>validateProject(serialized),/non valida/);
});

test('Edited Pendulum frames keep Normal/Effect last in the compact type line',()=>{
 const original=localizeCard(pair(46986414),'it',dictionary);
 const values={name:'Pendulum di prova',description:'Testo.',attribute:'dark',race:'cyberse',atk:'1000',def:'1000',level:'4',pendulum:true,scale:'5',pendulumText:'Effetto Pendulum.',artwork:null};
 for(const [layout,expected] of [['Normal','Cyberso/Pendulum/Normale'],['Effect','Cyberso/Pendulum/Effetto'],['Fusion','Cyberso/Fusione/Pendulum/Effetto']]){
  assert.equal(editCard(original,{...values,layout},'it',dictionary).typeLine,expected);
 }
});

test('Editing a Spell preserves its existing icon and subtype without monster statistics',()=>{
 const original=localizeCard(pair(55144522),'it',dictionary);
 original.icon='Continuous';original.race='continuous';
 const edited=editCard(original,{name:original.text.name,description:original.text.description,layout:'Spell',attribute:'dark',race:'spellcaster',atk:'0',def:'0',level:'0',pendulum:false,scale:'4',pendulumText:'',artwork:null},'it',dictionary);
 assert.equal(edited.icon,'Continuous');assert.equal(edited.race,'continuous');
 assert.equal(edited.level,null);assert.equal(edited.atk,null);assert.equal(edited.def,null);
});
