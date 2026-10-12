import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {normalizeCard} from '../app/js/model/card.js';
import {localizeCard} from '../app/js/localization/resolve.js';
import {editCard,exportProject,validateProject} from '../app/js/model/project.js';
import {SPECIAL_FRAMES,supportsSpecialFrame,validateSpecialFrame} from '../app/js/model/frames.js';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const dictionary=read('app/dictionaries/tcg.json'),en=read('app/fixtures/cards-en.json');
const original=localizeCard(normalizeCard(en.find(card=>card.id===46986414),null,'en'),'en',dictionary);
const values={name:original.text.name,description:original.text.description,layout:'Normal',attribute:'dark',race:'spellcaster',atk:'2500',def:'2100',level:'7',pendulum:false,scale:'4',pendulumText:'',artwork:null};
test('Special frame editing preserves card data and survives project serialization',()=>{
 const before=structuredClone(original);
 for(const specialFrame of SPECIAL_FRAMES){
  const edited=editCard(original,{...values,specialFrame},'en',dictionary);
  assert.equal(edited.specialFrame,specialFrame);assert.equal(edited.layout,original.layout);
  assert.equal(edited.typeLine,original.typeLine);assert.equal(edited.passcode,original.passcode);
  assert.equal(edited.atk,original.atk);assert.equal(edited.text.name,original.text.name);
  const project=validateProject(JSON.parse(JSON.stringify(exportProject([{entry:{quantity:1},card:edited,render:{artworkId:original.artworks[0].id}}],'en','1 Dark Magician'))));
  assert.equal(project.items[0].card.specialFrame,specialFrame);
 }
 assert.deepEqual(original,before);
});
test('Special frame selection is retained across text edits and can return to Standard',()=>{
 const selected=editCard(original,{...values,specialFrame:'obelisk'},'en',dictionary);
 assert.equal(editCard(selected,{...values,name:'Updated name'},'en',dictionary).specialFrame,'obelisk');
 assert.equal(editCard(selected,{...values,specialFrame:''},'en',dictionary).specialFrame,null);
 assert.equal(validateSpecialFrame(undefined,'Normal'),null);
});
test('Unsupported special frame combinations and untrusted frame IDs fail before rendering',()=>{
 assert.equal(supportsSpecialFrame('Effect'),true);
 for(const layout of ['Fusion','Ritual','Synchro','Xyz','Link','Spell','Trap'])
  assert.throws(()=>editCard(original,{...values,layout,specialFrame:'ra'},'en',dictionary),error=>error.code==='error.specialFrame');
 assert.equal(supportsSpecialFrame('Normal',true),false);
 assert.throws(()=>editCard(original,{...values,specialFrame:'slifer',pendulum:true,pendulumText:'Pendulum text'},'en',dictionary),error=>error.code==='error.specialFrame');
 const project=exportProject([{entry:{quantity:1},card:{...original,specialFrame:'../../outside'},render:{artworkId:original.artworks[0].id}}],'en','1 Dark Magician');
 assert.throws(()=>validateProject(project),error=>error.code==='error.specialFrame');
});
test('Native frame assets and editable SVG sources match their recorded hashes',()=>{
 const manifest=read('app/assets/templates/frames/egyptian-gods-manifest.json');
 assert.deepEqual(manifest.geometry,{width:421,height:614});
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 assert.equal(hash(manifest.source.file),manifest.source.sha256);
 assert.deepEqual(manifest.assets.map(asset=>asset.code),SPECIAL_FRAMES);
 for(const asset of manifest.assets){assert.equal(hash(asset.file),asset.sha256);assert.equal(hash(asset.sourceFile),asset.sourceSha256);}
});
