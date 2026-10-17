import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const coreSource=fs.readFileSync(new URL('../js/site-enhancements/core.js',import.meta.url),'utf8');
// Core has no DOM side effects. Use a harmless config response in this test process.
globalThis.fetch=async()=>({ok:true,json:async()=>({})});
const coreURL='data:text/javascript;base64,'+Buffer.from(coreSource).toString('base64');
const core=await import(coreURL);
const spoilerSource=fs.readFileSync(new URL('../js/site-enhancements/spoilers.js',import.meta.url),'utf8').replace("'./core.js'",JSON.stringify(coreURL));
const {shouldReveal}=await import('data:text/javascript;base64,'+Buffer.from(spoilerSource).toString('base64'));
test('reading progress does not reveal unknown or later spoilers',()=>{assert.equal(shouldReveal('hide',1),false);assert.equal(shouldReveal('book:1',2),false);assert.equal(shouldReveal('book:2',2),true);assert.equal(shouldReveal('book:3',null),false);assert.equal(shouldReveal('all',null),true);});
test('Alter comparison preserves own skills and costumes while sharing base stats',()=>{const roster={c1:{skills:['B1','S1'],base_stats:{health:100},costume_1:{name:'Avery'}},c1b:{base_character:'c1',skills:['B1','S1b'],costume_2:{name:'Caela'}}};const alter=core.resolveCharacter(roster,'c1b');assert.deepEqual(alter.skills,['B1','S1b']);assert.deepEqual(alter.base_stats,{health:100});assert.equal(alter.costume_1,undefined);assert.equal(alter.costume_2.name,'Caela');assert.equal(core.formURL('c1b'),'/webpages/game-c.html?char=c1#b');});
test('skill detail renderer links effects and substitutes the selected Alter nickname and gender',async()=>{
 const source=fs.readFileSync(new URL('../ml-game/apps/skill.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:''});return nodes.get(id);};let callback;
 const context={URLSearchParams,location:{search:'?char=c1&form=c1b&skill=B1&id=1'},console,document:{addEventListener:(name,fn)=>{callback=fn;},getElementById:get,querySelectorAll:()=>[]},fetch:async url=>{
  if(url.includes('site-features'))return {ok:true,json:async()=>({effectsGlossary:true})};
  if(url.includes('data-character'))return {ok:true,json:async()=>({c1:{nickname:'Avery',gender:'male'},c1b:{nickname:'Caela',gender:'female',base_character:'c1'}})};
  if(url.includes('data-effects'))return {ok:true,json:async()=>({shield:{name:'Shield',class:'shield',type:'Buff',description:'Protects the user.'}})};
  return {ok:true,json:async()=>({B1:{name:'Light Sword',type:'Basic Skill',description:'{{nickname}} raises {{possessive}} sword. {{Subject}} gains power. {{effect:shield}}',base_damage:{},max_level:10}})};
 }};vm.createContext(context);vm.runInContext(source,context);await callback();const html=get('skill-content').innerHTML;assert.match(html,/Caela raises her sword/);assert.match(html,/She gains power/);assert.match(html,/webpages\/effects.html#shield/);assert.doesNotMatch(html,/\{\{(?:nickname|possessive|Subject)/);
});

test('enhancement modules and reader have valid JavaScript syntax',async()=>{
 const {spawnSync}=await import('node:child_process');
 const folder=new URL('../js/site-enhancements/',import.meta.url);
 for(const file of [...fs.readdirSync(folder).filter(name=>name.endsWith('.js')).map(name=>new URL(name,folder)),new URL('../books/viewer.js',import.meta.url)]){
  const result=spawnSync(process.execPath,['--check',fileURLToPath(file)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 }
});
