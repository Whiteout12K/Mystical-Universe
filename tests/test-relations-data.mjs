import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {validateRelations,createRelationsStore,relationLines,serializeRelations,writeRelationsFile} from '../wiki/wiki-code/relations-data.js';
const data=JSON.parse(readFileSync(new URL('../wiki/relations.json',import.meta.url),'utf8'));
test('every wiki character references a matching central record',()=>{
 validateRelations(data);const store=createRelationsStore(data);
 for(const file of readdirSync(new URL('../wiki/char/',import.meta.url)).filter(name=>name.endsWith('.html'))){
  const source=readFileSync(new URL('../wiki/char/'+file,import.meta.url),'utf8');
  assert.match(source,/^\|Relatives=\{\{CharacterRelations\}\}$/m,file);
  assert.ok(store.find('/wiki/char/'+file),file);
 }
});
test('the central store resolves routes and titles and includes characters with no page',()=>{
 const store=createRelationsStore(data);
 assert.equal(store.find('/wiki/char/lux_luces.html').id,'lux_luces');
 assert.equal(store.find('','Lux Luces').id,'lux_luces');
 const profiles=store.mapProfiles([{title:'Lux Luces',path:'/wiki/char/lux_luces'}]);
 assert.equal(profiles.filter(p=>p.title==='Lux Luces').length,1);
 assert.equal(profiles.find(p=>p.title==='Prince Aether').unpublished,true);
 assert.match(store.find('','Lux Luces').relatives,/Prince Aether \(former fiancé\)/);
 assert.match(relationLines(store.find('','Pyrus Bourn').relatives),/Relatives: .*\(subordinate\)/);
});
test('new characters can hold relationships before a wiki page exists',()=>{
 const next=structuredClone(data);next.characters.push({id:'new_character',name:'New Character',path:'',relatives:'[[Lux Luces]] (rival)'});
 const profile=createRelationsStore(next).mapProfiles([]).find(p=>p.title==='New Character');
 assert.equal(profile.unpublished,true);assert.equal(profile.relations,'Relatives: [[Lux Luces]] (rival)');
});
test('duplicate characters and invalid page destinations are rejected before saving',()=>{
 const next=structuredClone(data);next.characters.push({...next.characters[0]});assert.throws(()=>validateRelations(next),/unique/);
 const invalid=structuredClone(data);invalid.characters[0].path='https://other.example/';assert.throws(()=>validateRelations(invalid),/valid/);
});
test('saving updates only the central file and rejects concurrent changes',async()=>{
 const original=serializeRelations(data),next=structuredClone(data);next.characters[0].relatives='[[Lux Luces]] (rival)';
 let result='',closed=false,writes=0;
 const handle={getFile:async()=>({text:async()=>original}),createWritable:async()=>({write:async text=>{result=text;writes++;},close:async()=>{closed=true;},abort:async()=>{}})};
 assert.equal(await writeRelationsFile(handle,next,original),serializeRelations(next));assert.equal(result,serializeRelations(next));assert.equal(closed,true);
 await assert.rejects(()=>writeRelationsFile(handle,next,'outdated revision'),/changed outside/);assert.equal(writes,1);
});
test('failed saves abort the writer and report the failure',async()=>{
 let aborted=false;const handle={getFile:async()=>({text:async()=>serializeRelations(data)}),createWritable:async()=>({write:async()=>{throw Error('Disk full');},close:async()=>{},abort:async()=>{aborted=true;}})};
 await assert.rejects(()=>writeRelationsFile(handle,data,serializeRelations(data)),/Disk full/);assert.equal(aborted,true);
});

test('all wiki affiliations are centralized and profiles use the shared affiliation tag',()=>{
 for(const file of readdirSync(new URL('../wiki/char/',import.meta.url)).filter(name=>name.endsWith('.html'))){
  const source=readFileSync(new URL('../wiki/char/'+file,import.meta.url),'utf8');
  assert.match(source,/^\|Affiliation=\{\{CharacterAffiliations\}\}$/m,file);
  const entry=createRelationsStore(data).find('/wiki/char/'+file);assert.equal(typeof entry.affiliations,'string');
 }
});
test('central affiliations update existing profiles and characters without pages',()=>{
 const next=structuredClone(data),lux=next.characters.find(entry=>entry.id==='lux_luces'),aether=next.characters.find(entry=>entry.name==='Prince Aether');
 lux.affiliations='Guild\nAcademy (student)';aether.affiliations='Guild';
 const parse=text=>text.split('\n').map(value=>value.replace(/\s*\([^)]*\)/g,''));
 const profiles=createRelationsStore(next).mapProfiles([{title:'Lux Luces',path:'/wiki/char/lux_luces',affiliations:['Old Guild']}],parse);
 assert.deepEqual(profiles.find(entry=>entry.title==='Lux Luces').affiliations,['Guild','Academy']);
 assert.deepEqual(profiles.find(entry=>entry.title==='Prince Aether').affiliations,['Guild']);
 assert.equal(profiles.find(entry=>entry.title==='Prince Aether').unpublished,true);
});
test('affiliation markup round-trips and invalid source affiliation data is rejected',()=>{
 const next=structuredClone(data);next.characters[0].affiliations='[[Guild]] (leader)\n{{Spoiler|Secret Society}}';
 assert.equal(JSON.parse(serializeRelations(next)).characters[0].affiliations,next.characters[0].affiliations);
 next.characters[0].affiliations=[];assert.throws(()=>validateRelations(next),/affiliations must be text/);
});
