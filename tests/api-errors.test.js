import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CardRepository} from '../app/js/data/api.js';
import {rowError} from '../app/js/errors.js';
import {formatError} from '../app/js/ui/i18n.js';

const query={kind:'name',query:'Unknown Card'};
const repository=()=>new CardRepository();
const messages=JSON.parse(fs.readFileSync('app/dictionaries/ui.json','utf8')).messages;

test('HTML error pages, malformed JSON and invalid payloads become translated data-service errors',async t=>{
  for(const [status,body] of [[503,'<html>Unavailable</html>'],[200,'<html>Maintenance</html>'],[400,'not json'],[200,'null'],[200,'{"data":[]}']]){
    const fetch=t.mock.method(globalThis,'fetch',async()=>new Response(body,{status}));
    const repo=repository();let error;
    try{await repo.find(query,undefined,'en');assert.fail('Expected a data service error');}catch(caught){error=caught;}
    assert.equal(error.code,'error.network',`${status}: ${body}`);
    assert.equal(repo.memory.size,0);
    for(const language of Object.keys(messages)){
      const translate=(key,params={})=>messages[language][key]?.replace(/\{(\w+)\}/g,(_,name)=>params[name]??'')||key;
      const expected=translate('error.rowCard',{line:2,card:query.query,message:messages[language]['error.network']});
      assert.equal(formatError(rowError(error,{line:2,query:query.query}),translate),expected);
    }
    fetch.mock.restore();
  }
});
test('network errors are normalized independently of browser wording; retry is not cached as failure',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{
    if(calls++===0)throw new TypeError('Load failed');
    return Response.json({data:[{id:46986414,name:'Dark Magician'}]});
  });
  const repo=repository();await assert.rejects(repo.find(query,undefined,'en'),{code:'error.network'});
  const result=await repo.find(query,undefined,'en');assert.equal(result.en.id,46986414);
  assert.equal(calls,2);assert.equal(repo.memory.size,1);
});
test('a valid API not-found response retains the card/row context and translation distinction',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:'No card matching your query was found in the database.'},{status:400}));
  await assert.rejects(repository().find(query,undefined,'en'),{code:'error.cardNotFound'});
  const repo=repository();repo.memory.set('ygoprodeck:v7:en:name:Dark Magician',{id:46986414,name:'Dark Magician'});
  await assert.rejects(repo.find({kind:'name',query:'Dark Magician'},undefined,'de'),error=>{
    assert.equal(error.code,'error.translationMissing');assert.deepEqual(error.params,{id:'46986414',language:'de'});return true;
  });
});
test('aborts during fetch or JSON body reading remain cancellations',async t=>{
  for(const duringBody of [false,true]){
    const aborted=new DOMException('Cancelled','AbortError');
    const fetch=t.mock.method(globalThis,'fetch',async()=>{
      if(!duringBody)throw aborted;
      return {ok:true,status:200,json:async()=>{throw aborted;}};
    });
    await assert.rejects(repository().find(query,undefined,'en'),error=>error===aborted);
    fetch.mock.restore();
  }
});
test('Previously bundled example cards request canonical and selected localized data from YGOProDeck',async t=>{
  const calls=[];
  t.mock.method(globalThis,'fetch',async source=>{
    const url=new URL(source);calls.push(url);
    return Response.json({data:[{id:46986414,name:url.searchParams.has('language')?'Mago Nero':'Dark Magician'}]});
  });
  const repo=repository();
  const result=await repo.find({kind:'name',query:'Dark Magician'},undefined,'it');
  assert.equal(result.localized.name,'Mago Nero');
  assert.equal(calls.length,2);
  assert.ok(calls.every(url=>url.origin==='https://db.ygoprodeck.com'));
  assert.equal(calls[0].searchParams.get('name'),'Dark Magician');
  assert.equal(calls[1].searchParams.get('id'),'46986414');
  assert.equal(calls[1].searchParams.get('language'),'it');
  await repo.find({kind:'name',query:'Dark Magician'},undefined,'it');
  assert.equal(calls.length,2);
});
