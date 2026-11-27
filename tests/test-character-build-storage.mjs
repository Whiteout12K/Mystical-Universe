import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/js/site-enhancements/character-build-storage.js',import.meta.url),'utf8').replace(/^import .*;\n/,'').replaceAll('export ','');
function runtime(account=null,{fail=false}={}) {
  let record={data:{gold:123,character_builds:{c2:{stars:6}}},revision:'r1'},cookies=new Map(),sent;
  const document={get cookie(){return [...cookies].map(([k,v])=>k+'='+v).join('; ');},set cookie(value){const [k,v]=value.split(';')[0].split('=');cookies.set(k,v);}};
  const store={localAccount:()=>account,record:()=>record,stage:(_,data)=>(record={...record,data,dirty:true}),markUploaded:(_,save,revision)=>{record={...record,revision,dirty:false};}};
  const context=vm.createContext({document,location:{protocol:'https:'},loadPlayerSession:async()=>account,PlayerStore:store,AbortSignal,fetch:async(_,request)=>{sent=JSON.parse(request.body);if(fail)throw Error('Offline');return {ok:true,json:async()=>({success:true,revision:'r2'})};}});
  vm.runInContext(source,context);
  return {context,cookies,record:()=>record,sent:()=>sent};
}
test('signed-out builds round-trip through a cookie and preserve partial edits',async()=>{
 const r=runtime();await r.context.saveCharacterBuild('c1',{stars:4,gear:{weapon:'w1'}});await r.context.saveCharacterBuild('c1',{level:8});
 const value=await r.context.loadCharacterBuild('c1');assert.equal(value.stars,4);assert.equal(value.gear.weapon,'w1');assert.equal(value.level,8);assert.equal(r.cookies.size,1);
});
test('offline accounts save in their own profile without a build cookie',async()=>{
 const r=runtime({id:'local',connected:false});await r.context.saveCharacterBuild('c1',{stars:3});
 assert.equal(r.record().data.gold,123);assert.equal(r.record().data.character_builds.c2.stars,6);assert.equal(r.record().data.character_builds.c1.stars,3);assert.equal(r.cookies.size,0);
});
test('D1 uploads retain unrelated profile data and use the cloud identity for linked local profiles',async()=>{
 const r=runtime({id:'local-id',userId:42,connected:true});await r.context.saveCharacterBuild('c1',{stars:5});
 assert.equal(r.sent().userId,42);assert.equal(r.sent().data.gold,123);assert.equal(r.record().revision,'r2');assert.equal(r.record().dirty,false);assert.equal(r.cookies.size,0);
});
test('failed D1 uploads preserve the offline profile, and queued edits preserve both characters',async()=>{
 const r=runtime({id:42,userId:42,connected:true},{fail:true});await Promise.all([r.context.saveCharacterBuild('c1',{stars:2}),r.context.saveCharacterBuild('c2',{level:7})]);
 assert.equal(r.record().dirty,true);assert.equal(r.record().data.character_builds.c1.stars,2);assert.equal(r.record().data.character_builds.c2.level,7);assert.equal(r.record().data.character_builds.c2.stars,6);
});
